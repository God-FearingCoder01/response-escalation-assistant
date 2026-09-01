import { useState, useEffect, useRef } from "react";
import {
  API_BASE,
  fetchAgentUserDataApi,
  saveAgentUserDataApi,
} from "../services/api";

function getTodayDateStr() {
  return new Date().toISOString().split("T")[0];
}

export function useUserInteractions({ currentAgent, apiStatus }) {
  const [toast, setToast] = useState({ show: false, message: "" });
  const [favoriteIds, setFavoriteIds] = useState([]);
  const [usageCounts, setUsageCounts] = useState({});
  const [recentlyUsed, setRecentlyUsed] = useState([]);
  const toastTimerRef = useRef(null);

  function showToast(message = "Copied to clipboard!") {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ show: true, message });
    toastTimerRef.current = setTimeout(() => {
      setToast({ show: false, message: "" });
    }, 2800);
  }

  // Sync agent user data when active agent profile changes
  useEffect(() => {
    if (!currentAgent?.agent_initials) {
      setFavoriteIds([]);
      setUsageCounts({});
      setRecentlyUsed([]);
      return;
    }
    const initials = currentAgent.agent_initials.toUpperCase();
    const today = getTodayDateStr();

    // 1. Instant reset & agent-scoped local storage load
    let favs = [];
    let counts = {};
    let recents = [];

    try {
      const favStored = localStorage.getItem(`REA_FAVORITES_${initials}`);
      if (favStored) favs = JSON.parse(favStored);

      const storedDate = localStorage.getItem(`REA_USAGE_DATE_${initials}`);
      if (storedDate === today) {
        const countsStored = localStorage.getItem(`REA_USAGE_COUNTS_${initials}`);
        if (countsStored) counts = JSON.parse(countsStored);
      } else {
        localStorage.setItem(`REA_USAGE_DATE_${initials}`, today);
        localStorage.setItem(`REA_USAGE_COUNTS_${initials}`, JSON.stringify({}));
      }

      const recentsStored = localStorage.getItem(`REA_RECENTLY_USED_${initials}`);
      if (recentsStored) recents = JSON.parse(recentsStored);
    } catch (e) {}

    setFavoriteIds(favs);
    setUsageCounts(counts);
    setRecentlyUsed(recents);

    let mounted = true;

    // 2. Cross-computer backend server database sync
    async function syncAgentUserData() {
      try {
        const serverData = await fetchAgentUserDataApi(initials);
        if (serverData && mounted) {
          if (Array.isArray(serverData.favorites)) {
            setFavoriteIds(serverData.favorites);
            try { localStorage.setItem(`REA_FAVORITES_${initials}`, JSON.stringify(serverData.favorites)); } catch (e) {}
          }
          if (serverData.usage_counts) {
            setUsageCounts(serverData.usage_counts);
            try {
              localStorage.setItem(`REA_USAGE_COUNTS_${initials}`, JSON.stringify(serverData.usage_counts));
              localStorage.setItem(`REA_USAGE_DATE_${initials}`, serverData.usage_date || today);
            } catch (e) {}
          }
          if (Array.isArray(serverData.recently_used)) {
            setRecentlyUsed(serverData.recently_used);
            try { localStorage.setItem(`REA_RECENTLY_USED_${initials}`, JSON.stringify(serverData.recently_used)); } catch (e) {}
          }
        }
      } catch (err) {
        console.error("Error syncing agent user data from backend:", err);
      }
    }

    syncAgentUserData();
    return () => {
      mounted = false;
    };
  }, [currentAgent]);

  async function toggleFavorite(id) {
    if (!id) return;
    const initials = currentAgent?.agent_initials || "DEFAULT";
    const isFav = favoriteIds.includes(id);
    const next = isFav ? favoriteIds.filter((item) => item !== id) : [...favoriteIds, id];
    setFavoriteIds(next);
    try {
      localStorage.setItem(`REA_FAVORITES_${initials}`, JSON.stringify(next));
    } catch (e) {}

    saveAgentUserDataApi({
      agent_initials: initials,
      favorites: next,
    });

    showToast(isFav ? "Removed from Favorites ⭐" : "Added to Favorites ⭐");
  }

  async function recordCopyAction(templateId) {
    if (!templateId) return;
    const initials = currentAgent?.agent_initials || "DEFAULT";
    const today = getTodayDateStr();

    const storedDate = localStorage.getItem(`REA_USAGE_DATE_${initials}`);
    const baseCounts = storedDate === today ? usageCounts : {};

    const nextCounts = { ...baseCounts, [templateId]: (baseCounts[templateId] || 0) + 1 };
    setUsageCounts(nextCounts);
    try {
      localStorage.setItem(`REA_USAGE_COUNTS_${initials}`, JSON.stringify(nextCounts));
      localStorage.setItem(`REA_USAGE_DATE_${initials}`, today);
    } catch (e) {}

    const filteredRecents = recentlyUsed.filter((item) => item.templateId !== templateId);
    const nextRecents = [{ templateId, timestamp: Date.now() }, ...filteredRecents].slice(0, 30);
    setRecentlyUsed(nextRecents);
    try { localStorage.setItem(`REA_RECENTLY_USED_${initials}`, JSON.stringify(nextRecents)); } catch (e) {}

    saveAgentUserDataApi({
      agent_initials: initials,
      usage_counts: nextCounts,
      recently_used: nextRecents,
    });
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
    setToast,
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
