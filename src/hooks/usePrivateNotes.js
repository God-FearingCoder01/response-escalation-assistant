import { useState, useEffect, useMemo, useCallback } from "react";
import {
  fetchPrivateNotesApi,
  createPrivateNoteApi,
  updatePrivateNoteApi,
  deletePrivateNoteApi,
  trackPrivateNoteUsageApi,
  createSuggestionApi,
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

export function usePrivateNotes({ currentAgent, showToast, refreshSuggestions }) {
  const [privateNotes, setPrivateNotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [promptBannerNote, setPromptBannerNote] = useState(null);

  const agentInitials = currentAgent?.agent_initials || "SA";

  const refreshPrivateNotes = useCallback(async () => {
    if (!agentInitials) return;
    setLoading(true);
    try {
      const data = await fetchPrivateNotesApi(agentInitials);
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
    } catch (e) {
      console.error("Failed to load private notes:", e);
    } finally {
      setLoading(false);
    }
  }, [agentInitials]);

  useEffect(() => {
    refreshPrivateNotes();
  }, [refreshPrivateNotes]);

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

  return {
    privateNotes,
    loading,
    frequentNotes,
    promptBannerNote,
    refreshPrivateNotes,
    createPrivateNote: handleCreateNote,
    updatePrivateNote: handleUpdateNote,
    deletePrivateNote: handleDeleteNote,
    trackPrivateNoteUsage: handleTrackUsage,
    promoteToSuggestion,
    dismissPromptBanner,
  };
}
