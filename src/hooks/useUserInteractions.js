import { useState, useEffect } from "react";
import {
  API_BASE,
  fetchFavoritesApi,
  toggleFavoriteApi,
  fetchHistoryApi,
  recordHistoryApi,
} from "../services/api";

export function useUserInteractions({ currentAgent, apiStatus }) {
  const [toast, setToast] = useState({ show: false, message: "" });
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [usageCounts, setUsageCounts] = useState({});
  const [recentlyUsed, setRecentlyUsed] = useState([]);

  function showToast(message = "Copied to clipboard!") {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: "" });
    }, 2800);
  }

  // Sync agent user data when active agent profile changes
  useEffect(() => {
    if (!currentAgent?.agent_initials) return;
    const initials = currentAgent.agent_initials;

    // Load local agent-scoped storage immediately
    try {
      const favStored = localStorage.getItem(`REA_FAVORITES_${initials}`);
      setFavoriteIds(favStored ? JSON.parse(favStored) : []);

      const countsStored = localStorage.getItem(`REA_USAGE_COUNTS_${initials}`);
      setUsageCounts(countsStored ? JSON.parse(countsStored) : {});

      const recentsStored = localStorage.getItem(`REA_RECENTLY_USED_${initials}`);
      setRecentlyUsed(recentsStored ? JSON.parse(recentsStored) : []);
    } catch (e) {}

    if (apiStatus === "offline") return;
    let mounted = true;

    async function syncAgentUserData() {
      try {
        const [favData, histData] = await Promise.all([
          fetchFavoritesApi(initials),
          fetchHistoryApi(initials),
        ]);

        if (Array.isArray(favData) && mounted) {
          setFavoriteIds(favData);
          try { localStorage.setItem(`REA_FAVORITES_${initials}`, JSON.stringify(favData)); } catch (e) {}
        }

        if (histData && mounted) {
          if (histData.counts) {
            setUsageCounts(histData.counts);
            try { localStorage.setItem(`REA_USAGE_COUNTS_${initials}`, JSON.stringify(histData.counts)); } catch (e) {}
          }
          if (Array.isArray(histData.recents)) {
            setRecentlyUsed(histData.recents);
            try { localStorage.setItem(`REA_RECENTLY_USED_${initials}`, JSON.stringify(histData.recents)); } catch (e) {}
          }
        }
      } catch (err) {
        // Keeps loaded localStorage intact
      }
    }

    syncAgentUserData();
    return () => {
      mounted = false;
    };
  }, [currentAgent, apiStatus]);

  async function toggleFavorite(id) {
    if (!id) return;
    const initials = currentAgent?.agent_initials || "DEFAULT";
    const isFav = favoriteIds.includes(id);
    const next = isFav ? favoriteIds.filter((item) => item !== id) : [...favoriteIds, id];
    setFavoriteIds(next);
    try {
      localStorage.setItem(`REA_FAVORITES_${initials}`, JSON.stringify(next));
    } catch (e) {}

    if (currentAgent?.agent_initials && apiStatus !== "offline") {
      try {
        const updatedFavs = await toggleFavoriteApi(initials, id);
        if (Array.isArray(updatedFavs)) {
          setFavoriteIds(updatedFavs);
          try { localStorage.setItem(`REA_FAVORITES_${initials}`, JSON.stringify(updatedFavs)); } catch (e) {}
        }
      } catch (err) {}
    }
    showToast(isFav ? "Removed from Favorites ⭐" : "Added to Favorites ⭐");
  }

  async function recordCopyAction(templateId) {
    if (!templateId) return;
    const initials = currentAgent?.agent_initials || "DEFAULT";

    // Update usage counts
    const nextCounts = { ...usageCounts, [templateId]: (usageCounts[templateId] || 0) + 1 };
    setUsageCounts(nextCounts);
    try { localStorage.setItem(`REA_USAGE_COUNTS_${initials}`, JSON.stringify(nextCounts)); } catch (e) {}

    // Update recently used
    const filteredRecents = recentlyUsed.filter((item) => item.templateId !== templateId);
    const nextRecents = [{ templateId, timestamp: Date.now() }, ...filteredRecents].slice(0, 30);
    setRecentlyUsed(nextRecents);
    try { localStorage.setItem(`REA_RECENTLY_USED_${initials}`, JSON.stringify(nextRecents)); } catch (e) {}

    if (currentAgent?.agent_initials && apiStatus !== "offline") {
      try {
        await recordHistoryApi(initials, templateId);
      } catch (err) {}
    }
  }

  async function copyText(text, customMessage = "Message copied to clipboard! 📋", templateId = null) {
    if (!text) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      }
      showToast(customMessage);
      if (templateId) {
        recordCopyAction(templateId);
      }
    } catch (e) {
      showToast("Copy action triggered");
    }
  }

  return {
    toast,
    showToast,
    favoriteIds,
    setFavoriteIds,
    usageCounts,
    setUsageCounts,
    recentlyUsed,
    setRecentlyUsed,
    toggleFavorite,
    recordCopyAction,
    copyText,
  };
}
