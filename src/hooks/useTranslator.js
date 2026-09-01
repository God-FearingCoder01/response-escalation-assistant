import { useState, useCallback, useEffect, useRef } from "react";
import { translateText, getPresetPhrases } from "../services/translationService";
import { fetchAgentUserDataApi, saveAgentUserDataApi } from "../services/api";

const HISTORY_KEY = "rea_translator_history_v1";

export function useTranslator({ currentAgent = null, showToast = () => {} } = {}) {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState("en"); // 'en' or 'sn'
  const [targetLang, setTargetLang] = useState("sn"); // 'sn' or 'en'
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProvider, setTranslationProvider] = useState("");
  const [presetPhrases, setPresetPhrases] = useState(getPresetPhrases());

  const agentInitials = currentAgent?.agent_initials ? currentAgent.agent_initials.toUpperCase() : "GUEST";
  const historyKey = `rea_translator_history_${agentInitials}`;

  // Persistent user-scoped translation history
  const [history, setHistory] = useState([]);

  const loadedAgentRef = useRef(agentInitials);

  // Load history whenever active agent changes (localStorage + backend server sync)
  useEffect(() => {
    if (!agentInitials) return;
    loadedAgentRef.current = agentInitials;

    let localHistory = [];
    try {
      const stored = localStorage.getItem(historyKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          localHistory = parsed;
        }
      }
    } catch (e) {}

    setHistory(localHistory);
    setSourceText("");
    setTranslatedText("");

    let mounted = true;
    async function syncHistory() {
      try {
        const serverData = await fetchAgentUserDataApi(agentInitials);
        if (serverData && Array.isArray(serverData.translation_history) && mounted && loadedAgentRef.current === agentInitials) {
          setHistory(serverData.translation_history);
          try { localStorage.setItem(historyKey, JSON.stringify(serverData.translation_history)); } catch (e) {}
        }
      } catch (err) {}
    }

    syncHistory();
    return () => {
      mounted = false;
    };
  }, [historyKey, agentInitials]);

  // Save history updates per agent to localStorage & backend DB
  useEffect(() => {
    if (!agentInitials || agentInitials === "GUEST") return;
    // Guard against saving stale history from a previous agent to a newly selected agent
    if (loadedAgentRef.current !== agentInitials) {
      return;
    }

    try {
      localStorage.setItem(historyKey, JSON.stringify(history));
    } catch (e) {}

    if (history.length > 0) {
      saveAgentUserDataApi({
        agent_initials: agentInitials,
        translation_history: history,
      });
    }
  }, [history, historyKey, agentInitials]);

  // Listen for admin preset phrases updates
  useEffect(() => {
    const updatePresets = () => {
      setPresetPhrases(getPresetPhrases());
    };
    window.addEventListener("rea_preset_phrases_updated", updatePresets);
    return () => window.removeEventListener("rea_preset_phrases_updated", updatePresets);
  }, []);

  // Helper to safely add/update translation in history
  const addToHistory = useCallback((srcText, transText, src, tgt) => {
    if (!srcText || !srcText.trim() || !transText || !transText.trim()) return;
    const historyItem = {
      id: Date.now(),
      sourceText: srcText.trim(),
      translatedText: transText.trim(),
      sourceLang: src || sourceLang,
      targetLang: tgt || targetLang,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setHistory((prev) => [
      historyItem,
      ...prev.filter(
        (h) =>
          !(
            h.sourceText.toLowerCase() === srcText.trim().toLowerCase() &&
            h.sourceLang === (src || sourceLang) &&
            h.targetLang === (tgt || targetLang)
          )
      ),
    ].slice(0, 25));
  }, [sourceLang, targetLang]);

  // Swap translation direction (e.g. EN -> ND <==> ND -> EN)
  const handleSwapLanguages = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);

    // Swap text inputs as well if translated text exists
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  }, [sourceText, translatedText, sourceLang, targetLang]);

  // Execute translation
  const handleTranslate = useCallback(async (customText, overrideSrc, overrideTgt) => {
    const textToTranslate = customText !== undefined ? customText : sourceText;
    const src = overrideSrc || sourceLang;
    const tgt = overrideTgt || targetLang;

    if (!textToTranslate || !textToTranslate.trim()) {
      setTranslatedText("");
      return;
    }

    setIsTranslating(true);
    try {
      const res = await translateText(textToTranslate, src, tgt);
      setTranslatedText(res.translatedText);
      setTranslationProvider(res.provider);

      // Add to persistent history log (keep max 25 recent items)
      if (res.translatedText && res.translatedText.trim()) {
        addToHistory(textToTranslate, res.translatedText, src, tgt);
      }
    } catch (err) {
      console.error("Translation error:", err);
      showToast?.("Failed to translate text. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  }, [sourceText, sourceLang, targetLang, addToHistory, showToast]);

  // Load preset phrase
  const handleSelectPreset = useCallback((preset) => {
    let srcT = "";
    let transT = "";

    const isNdebele = (lang) => lang === "nde" || lang === "nd";

    if (sourceLang === "en") {
      srcT = preset.en;
      transT = isNdebele(targetLang) ? (preset.nd || preset.sn) : preset.sn;
    } else if (sourceLang === "sn") {
      srcT = preset.sn;
      transT = isNdebele(targetLang) ? (preset.nd || preset.en) : preset.en;
    } else {
      srcT = preset.nd || preset.en;
      transT = targetLang === "sn" ? preset.sn : preset.en;
    }

    setSourceText(srcT);
    setTranslatedText(transT);
    setTranslationProvider("preset");
    addToHistory(srcT, transT, sourceLang, targetLang);
  }, [sourceLang, targetLang, addToHistory]);

  // Clear translation inputs
  const handleClear = useCallback(() => {
    setSourceText("");
    setTranslatedText("");
    setTranslationProvider("");
  }, []);

  // Clear history log
  const handleClearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(historyKey);
    } catch (e) {}
    showToast?.("Translation history cleared!");
  }, [historyKey, showToast]);

  return {
    sourceText,
    setSourceText,
    translatedText,
    setTranslatedText,
    sourceLang,
    setSourceLang,
    targetLang,
    setTargetLang,
    isTranslating,
    translationProvider,
    history,
    addToHistory,
    handleSwapLanguages,
    handleTranslate,
    handleSelectPreset,
    handleClear,
    handleClearHistory,
    presetPhrases,
  };
}
