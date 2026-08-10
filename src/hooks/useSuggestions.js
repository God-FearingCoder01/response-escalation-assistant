import { useState, useEffect } from "react";
import {
  API_BASE,
  fetchSuggestionsApi,
  createSuggestionApi,
  approveSuggestionApi,
  rejectSuggestionApi,
} from "../services/api";

export function useSuggestions({ activeScreen, apiStatus, currentAgent, refreshTemplates, showToast, setError }) {
  const [suggestions, setSuggestions] = useState(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("REA_SUGGESTIONS");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [sugName, setSugName] = useState("");
  const [sugBody, setSugBody] = useState("");
  const [sugType, setSugType] = useState("customer_reply");
  const [sugCat, setSugCat] = useState("");
  const [sugSubcat, setSugSubcat] = useState("");
  const [sugSubmitting, setSugSubmitting] = useState(false);
  const [sugFilterStatus, setSugFilterStatus] = useState("all"); // "all" | "pending" | "approved" | "rejected"

  async function refreshSuggestions() {
    try {
      const data = await fetchSuggestionsApi();
      if (Array.isArray(data)) {
        setSuggestions(data);
        try { localStorage.setItem("REA_SUGGESTIONS", JSON.stringify(data)); } catch (e) {}
      }
    } catch (err) {}
  }

  // Auto-refresh suggestions with 5-second polling interval whenever on suggestions screen
  useEffect(() => {
    if (activeScreen === "suggestions") {
      refreshSuggestions();
      const timer = setInterval(() => {
        refreshSuggestions();
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [activeScreen, apiStatus]);

  async function handleSubmitSuggestion(e) {
    if (e) e.preventDefault();
    if (!sugName.trim() || !sugBody.trim()) {
      setError("Please enter a template name and body text");
      return;
    }
    setSugSubmitting(true);
    setError("");
    try {
      const payload = {
        name: sugName.trim(),
        body: sugBody.trim(),
        category_type: sugType,
        category: sugCat.trim() || null,
        subcategory: sugSubcat.trim() || null,
        suggested_by_name: currentAgent?.agent_name || "Support Agent",
        suggested_by_initials: currentAgent?.agent_initials || "SA",
        status: "pending",
      };

      let success = false;
      if (apiStatus !== "offline") {
        try {
          await createSuggestionApi(payload);
          success = true;
          await refreshSuggestions();
          showToast("Template suggestion submitted for review! 💡");
        } catch (fetchErr) {
          if (fetchErr instanceof Error && fetchErr.message && fetchErr.message !== "Failed to fetch") {
            throw fetchErr;
          }
        }
      }

      if (!success) {
        const next = { id: Date.now(), ...payload, created_at: new Date().toISOString() };
        setSuggestions((curr) => {
          const list = [next, ...curr];
          try { localStorage.setItem("REA_SUGGESTIONS", JSON.stringify(list)); } catch (e) {}
          return list;
        });
        showToast("Template suggestion saved locally (Offline Mode) 💡");
      }

      setSugName("");
      setSugBody("");
      setSugCat("");
      setSugSubcat("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit suggestion");
    } finally {
      setSugSubmitting(false);
    }
  }

  async function handleApproveSuggestion(sugId) {
    setError("");
    try {
      if (apiStatus !== "offline") {
        try {
          await approveSuggestionApi(sugId);
          await Promise.all([refreshTemplates(), refreshSuggestions()]);
          showToast("Suggestion approved & added to template library! 🎉");
          return;
        } catch (err) {
          if (err instanceof Error && err.message === "Failed to fetch") {
            // Fallback to local offline mode
          } else {
            const msg = err instanceof Error ? err.message : "Failed to approve suggestion";
            setError(msg);
            showToast(`Error: ${msg} ⚠️`);
            return;
          }
        }
      }

      const sug = suggestions.find((s) => s.id === sugId);
      if (sug) {
        setSuggestions((curr) => {
          const list = curr.map((s) => (s.id === sugId ? { ...s, status: "approved" } : s));
          try { localStorage.setItem("REA_SUGGESTIONS", JSON.stringify(list)); } catch (e) {}
          return list;
        });
        showToast("Suggestion approved locally 🎉");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve suggestion");
    }
  }

  async function handleRejectSuggestion(sugId) {
    setError("");
    try {
      if (apiStatus !== "offline") {
        try {
          await rejectSuggestionApi(sugId);
          await refreshSuggestions();
          showToast("Suggestion rejected ❌");
          return;
        } catch (err) {
          if (err instanceof Error && err.message === "Failed to fetch") {
            // Fallback to local offline mode
          } else {
            const msg = err instanceof Error ? err.message : "Failed to reject suggestion";
            setError(msg);
            showToast(`Error: ${msg} ⚠️`);
            return;
          }
        }
      }

      setSuggestions((curr) => {
        const list = curr.map((s) => (s.id === sugId ? { ...s, status: "rejected" } : s));
        try { localStorage.setItem("REA_SUGGESTIONS", JSON.stringify(list)); } catch (e) {}
        return list;
      });
      showToast("Suggestion rejected locally ❌");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject suggestion");
    }
  }

  return {
    suggestions,
    setSuggestions,
    refreshSuggestions,
    sugName,
    setSugName,
    sugBody,
    setSugBody,
    sugType,
    setSugType,
    sugCat,
    setSugCat,
    sugSubcat,
    setSugSubcat,
    sugSubmitting,
    sugFilterStatus,
    setSugFilterStatus,
    handleSubmitSuggestion,
    handleApproveSuggestion,
    handleRejectSuggestion,
  };
}
