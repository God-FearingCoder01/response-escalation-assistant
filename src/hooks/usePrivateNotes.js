import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  fetchPrivateNotesApi,
  createPrivateNoteApi,
  updatePrivateNoteApi,
  deletePrivateNoteApi,
  trackPrivateNoteUsageApi,
  createSuggestionApi,
  fetchPrivateNoteCategoriesApi,
  createPrivateNoteCategoryApi,
  deletePrivateNoteCategoryApi,
} from "../services/api";

function getRawId(id) {
  if (typeof id === "number") return id;
  if (typeof id === "string" && id.startsWith("priv_")) {
    const parsed = parseInt(id.replace("priv_", ""), 10);
    return isNaN(parsed) ? id : parsed;
  }
  return id;
}

function formatNote(n) {
  if (!n) return n;
  const rawId = typeof n.id === "number" ? n.id : (n.raw_id ?? getRawId(n.id));
  return {
    ...n,
    raw_id: rawId,
    id: `priv_${rawId}`,
    is_private_note: true,
  };
}

const DAILY_SUGGESTION_THRESHOLD = 150;

function getTodayDateStr() {
  return new Date().toISOString().split("T")[0];
}

const NO_NOTES = [];
const NO_CATEGORIES = [];
const LOAD_ATTEMPTS = 3;

export function usePrivateNotes({ currentAgent, showToast, refreshSuggestions }) {
  const [rawNotes, setPrivateNotes] = useState([]);
  const [rawCategories, setDbCustomCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [promptBannerNote, setPromptBannerNote] = useState(null);
  // Which agent the notes/categories in state belong to. Anything not owned by the
  // signed-in agent is hidden immediately, so one agent's data can never render
  // for another agent, even for the single render before the reset effect runs.
  const [dataOwner, setDataOwner] = useState("");
  // Incremented on every load and every agent change; a response from an older
  // request (e.g. the previous agent's slow fetch) is discarded.
  const loadSeqRef = useRef(0);

  const agentInitials = currentAgent?.agent_initials || "";
  const ownsData = !!agentInitials && dataOwner === agentInitials;
  const privateNotes = ownsData ? rawNotes : NO_NOTES;
  const dbCustomCategories = ownsData ? rawCategories : NO_CATEGORIES;

  const refreshPrivateNotes = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    if (!agentInitials) {
      setPrivateNotes([]);
      setDbCustomCategories([]);
      setPromptBannerNote(null);
      setDataOwner("");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      let data = null;
      let catsData = [];
      // The API helper returns null on timeout or error (e.g. a cold server start).
      // Retry a couple of times so a slow first request doesn't leave an empty list.
      for (let attempt = 0; attempt < LOAD_ATTEMPTS; attempt++) {
        [data, catsData] = await Promise.all([
          fetchPrivateNotesApi(agentInitials),
          fetchPrivateNoteCategoriesApi(agentInitials).catch(() => []),
        ]);
        // The agent changed (or a newer load started) while this request was in flight.
        if (seq !== loadSeqRef.current) return;
        if (Array.isArray(data)) break;
        if (attempt < LOAD_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          if (seq !== loadSeqRef.current) return;
        }
      }

      if (Array.isArray(data)) {
        const today = getTodayDateStr();
        const formatted = data.map((n) => {
          const note = formatNote(n);
          if (note.updated_at) {
            const noteDate = new Date(note.updated_at).toISOString().split("T")[0];
            if (noteDate !== today) {
              note.use_count = 0;
            }
          }
          return note;
        });
        setPrivateNotes(formatted);
      }

      if (Array.isArray(catsData)) {
        const names = catsData.map((c) => (typeof c === "string" ? c : c.name)).filter(Boolean);
        setDbCustomCategories(names);
      }
      setDataOwner(agentInitials);
    } catch (e) {
      console.error("Failed to load private notes:", e);
    } finally {
      // Only the latest request controls the loading flag.
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, [agentInitials]);

  // Start every agent with a clean slate: drop the previous agent's notes, categories
  // and prompt banner before their own data loads. This effect is declared before the
  // load effect so it always runs first. A failed or slow load can therefore leave an
  // agent with an empty list, but never with someone else's notes.
  useEffect(() => {
    setPrivateNotes([]);
    setDbCustomCategories([]);
    setPromptBannerNote(null);
    setDataOwner(agentInitials);
  }, [agentInitials]);

  useEffect(() => {
    refreshPrivateNotes();
  }, [refreshPrivateNotes]);

  const handleCreateCategory = async (categoryName) => {
    const trimmed = (categoryName || "").trim();
    if (!trimmed) return;
    try {
      await createPrivateNoteCategoryApi(trimmed, agentInitials);
      setDbCustomCategories((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
      if (showToast) showToast(`📁 Custom category "${trimmed}" saved to DB!`, "success");
      return trimmed;
    } catch (e) {
      console.warn("Failed to create category on DB, storing locally:", e);
      setDbCustomCategories((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
      return trimmed;
    }
  };

  const handleDeleteCategory = async (categoryName) => {
    const trimmed = (categoryName || "").trim();
    if (!trimmed) return;
    try {
      await deletePrivateNoteCategoryApi(trimmed, agentInitials);
      setDbCustomCategories((prev) => prev.filter((c) => c !== trimmed));
      if (showToast) showToast(`Removed custom category "${trimmed}"`, "info");
    } catch (e) {
      console.warn("Failed to delete category from DB:", e);
      setDbCustomCategories((prev) => prev.filter((c) => c !== trimmed));
    }
  };

  // High-frequency private notes (used 150+ times in a single day, not yet submitted as team suggestion)
  const frequentNotes = useMemo(() => {
    return privateNotes.filter((n) => (n.use_count || 0) >= DAILY_SUGGESTION_THRESHOLD && !n.submitted_as_suggestion);
  }, [privateNotes]);

  const handleCreateNote = async (payload) => {
    try {
      const fullPayload = {
        agent_initials: agentInitials,
        category: "Personal Notes",
        category_type: "customer_reply",
        ...payload,
      };
      const rawRes = await createPrivateNoteApi(fullPayload, agentInitials);
      const newNote = formatNote(rawRes);
      setPrivateNotes((prev) => [newNote, ...prev]);
      if (showToast) showToast("🔒 Private note created!", "success");
      return newNote;
    } catch (e) {
      if (showToast) showToast(e.message || "Failed to create private note", "error");
      throw e;
    }
  };

  const handleUpdateNote = async (id, payload) => {
    const numericId = getRawId(id);
    try {
      const rawRes = await updatePrivateNoteApi(numericId, payload, agentInitials);
      const updated = formatNote(rawRes);
      setPrivateNotes((prev) => prev.map((n) => (getRawId(n.id) === numericId ? updated : n)));
      if (showToast) showToast("🔒 Private note updated!", "success");
      return updated;
    } catch (e) {
      if (showToast) showToast(e.message || "Failed to update private note", "error");
      throw e;
    }
  };

  const handleDeleteNote = async (id) => {
    const numericId = getRawId(id);
    try {
      await deletePrivateNoteApi(numericId, agentInitials);
      setPrivateNotes((prev) => prev.filter((n) => getRawId(n.id) !== numericId));
      if (promptBannerNote && getRawId(promptBannerNote.id) === numericId) setPromptBannerNote(null);
      if (showToast) showToast("🗑️ Private note deleted", "info");
    } catch (e) {
      if (showToast) showToast(e.message || "Failed to delete private note", "error");
      throw e;
    }
  };

  const handleTrackUsage = async (id) => {
    const numericId = getRawId(id);
    try {
      const rawRes = await trackPrivateNoteUsageApi(numericId);
      const updated = formatNote(rawRes);
      setPrivateNotes((prev) => prev.map((n) => (getRawId(n.id) === numericId ? updated : n)));
      
      // If note reaches daily usage threshold (150 uses today) and hasn't been submitted yet, trigger prompt banner!
      if ((updated.use_count || 0) >= DAILY_SUGGESTION_THRESHOLD && !updated.submitted_as_suggestion) {
        setPromptBannerNote(updated);
      }
      return updated;
    } catch (e) {
      console.error("Failed to track private note usage:", e);
    }
  };

  const promoteToSuggestion = async (noteOrId) => {
    const numericId = getRawId(typeof noteOrId === "object" ? noteOrId.id : noteOrId);
    const note = typeof noteOrId === "object" ? noteOrId : privateNotes.find((n) => getRawId(n.id) === numericId);
    if (!note) return;

    try {
      const payload = {
        name: note.name,
        body: note.body,
        category_type: note.category_type || "customer_reply",
        category: note.category || "General",
        subcategory: note.subcategory || null,
        suggested_by_name: currentAgent?.agent_name || currentAgent?.agent || "Agent",
        suggested_by_initials: agentInitials,
      };

      await createSuggestionApi(payload);
      const rawRes = await updatePrivateNoteApi(numericId, { submitted_as_suggestion: true }, agentInitials);
      const updated = formatNote(rawRes);
      
      setPrivateNotes((prev) => prev.map((n) => (getRawId(n.id) === numericId ? updated : n)));
      if (promptBannerNote && getRawId(promptBannerNote.id) === numericId) setPromptBannerNote(null);

      if (refreshSuggestions) refreshSuggestions();
      if (showToast) showToast(`🚀 Suggested "${note.name}" to Team Suggestion Hub!`, "success");
    } catch (e) {
      if (showToast) showToast(e.message || "Failed to submit template suggestion", "error");
    }
  };

  const dismissPromptBanner = () => {
    setPromptBannerNote(null);
  };

  const exportPrivateNotes = (format = "json") => {
    if (!privateNotes || privateNotes.length === 0) {
      if (showToast) showToast("No personal notes to export", "info");
      return;
    }
    const cleanNotes = privateNotes.map((n) => ({
      name: n.name,
      category: n.category || "Personal Notes",
      category_type: n.category_type || "customer_reply",
      body: n.body,
      placeholder_config: n.placeholder_config || null,
    }));

    const dateStr = getTodayDateStr();
    const fileName = `personal_notes_${agentInitials}_${dateStr}`;

    if (format === "csv") {
      const headers = ["Name", "Category", "Category Type", "Body"];
      const rows = cleanNotes.map((n) => [
        `"${(n.name || "").replace(/"/g, '""')}"`,
        `"${(n.category || "").replace(/"/g, '""')}"`,
        `"${(n.category_type || "").replace(/"/g, '""')}"`,
        `"${(n.body || "").replace(/"/g, '""')}"`,
      ]);
      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      if (showToast) showToast("📤 Personal notes exported to CSV!", "success");
    } else {
      const jsonStr = JSON.stringify(cleanNotes, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.json`;
      link.click();
      URL.revokeObjectURL(url);
      if (showToast) showToast("📤 Personal notes exported to JSON!", "success");
    }
  };

  const importPrivateNotes = async (importedList) => {
    if (!Array.isArray(importedList) || importedList.length === 0) {
      if (showToast) showToast("No valid personal notes found in file", "error");
      return;
    }
    setLoading(true);
    let successCount = 0;
    try {
      for (const item of importedList) {
        if (!item.name || !item.body) continue;
        const cat = (item.category || "Personal Notes").trim();
        if (cat !== "Personal Notes" && !dbCustomCategories.includes(cat)) {
          await handleCreateCategory(cat);
        }
        await handleCreateNote({
          name: item.name,
          body: item.body,
          category: cat,
          category_type: item.category_type || "customer_reply",
          placeholder_config: item.placeholder_config || null,
        });
        successCount++;
      }
      await refreshPrivateNotes();
      if (showToast) showToast(`📥 Successfully imported ${successCount} personal notes!`, "success");
    } catch (e) {
      console.error("Error importing private notes:", e);
      if (showToast) showToast(`Imported ${successCount} notes with some errors`, "warning");
    } finally {
      setLoading(false);
    }
  };

  return {
    privateNotes,
    customCategories: dbCustomCategories,
    loading,
    frequentNotes,
    promptBannerNote,
    refreshPrivateNotes,
    createPrivateNote: handleCreateNote,
    updatePrivateNote: handleUpdateNote,
    deletePrivateNote: handleDeleteNote,
    createCustomCategory: handleCreateCategory,
    deleteCustomCategory: handleDeleteCategory,
    trackPrivateNoteUsage: handleTrackUsage,
    promoteToSuggestion,
    dismissPromptBanner,
    exportPrivateNotes,
    importPrivateNotes,
  };
}

export function parseNotesFile(fileContent, fileName = "") {
  const isCsv = fileName.toLowerCase().endsWith(".csv") || (!fileContent.trim().startsWith("[") && !fileContent.trim().startsWith("{"));
  if (!isCsv) {
    try {
      const parsed = JSON.parse(fileContent);
      return Array.isArray(parsed) ? parsed : (parsed.notes || parsed.private_notes || []);
    } catch (e) {
      console.error("Error parsing JSON notes file:", e);
      return [];
    }
  } else {
    const lines = fileContent.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
    const nameIdx = headers.findIndex((h) => h.includes("name") || h.includes("title"));
    const bodyIdx = headers.findIndex((h) => h.includes("body") || h.includes("content") || h.includes("message") || h.includes("template"));
    const catIdx = headers.findIndex((h) => h.includes("category"));
    const typeIdx = headers.findIndex((h) => h.includes("type"));

    const result = [];
    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map((cell) => cell.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
      const name = nameIdx !== -1 ? row[nameIdx] : row[0];
      const body = bodyIdx !== -1 ? row[bodyIdx] : row[row.length - 1];
      if (name && body) {
        result.push({
          name,
          body,
          category: catIdx !== -1 && row[catIdx] ? row[catIdx] : "Personal Notes",
          category_type: typeIdx !== -1 && row[typeIdx] ? row[typeIdx] : "customer_reply",
        });
      }
    }
    return result;
  }
}
