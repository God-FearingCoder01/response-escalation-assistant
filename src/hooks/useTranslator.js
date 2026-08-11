import { useState, useCallback } from "react";
import { translateText, PRESET_TRANSLATION_PHRASES } from "../services/translationService";

export function useTranslator({ showToast = () => {} } = {}) {
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState("en"); // 'en' or 'sn'
  const [targetLang, setTargetLang] = useState("sn"); // 'sn' or 'en'
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProvider, setTranslationProvider] = useState("");
  const [history, setHistory] = useState([]);

  // Swap translation direction (EN -> SN <==> SN -> EN)
  const handleSwapLanguages = useCallback(() => {
    setSourceLang((prevSrc) => (prevSrc === "en" ? "sn" : "en"));
    setTargetLang((prevTgt) => (prevTgt === "en" ? "sn" : "en"));
    
    // Swap text inputs as well if translated text exists
    setSourceText(translatedText);
    setTranslatedText(sourceText);
  }, [sourceText, translatedText]);

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

      // Add to history log (keep max 10 recent items)
      if (res.translatedText && res.translatedText.trim()) {
        const historyItem = {
          id: Date.now(),
          sourceText: textToTranslate.trim(),
          translatedText: res.translatedText,
          sourceLang: src,
          targetLang: tgt,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setHistory((prev) => [historyItem, ...prev.filter((h) => h.sourceText !== textToTranslate.trim())].slice(0, 10));
      }
    } catch (err) {
      console.error("Translation error:", err);
      showToast?.("Failed to translate text. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  }, [sourceText, sourceLang, targetLang, showToast]);

  // Load preset phrase
  const handleSelectPreset = useCallback((preset) => {
    if (sourceLang === "en") {
      setSourceText(preset.en);
      setTranslatedText(preset.sn);
    } else {
      setSourceText(preset.sn);
      setTranslatedText(preset.en);
    }
    setTranslationProvider("preset");
  }, [sourceLang]);

  // Clear translation inputs
  const handleClear = useCallback(() => {
    setSourceText("");
    setTranslatedText("");
    setTranslationProvider("");
  }, []);

  return {
    sourceText,
    setSourceText,
    translatedText,
    setTranslatedText,
    sourceLang,
    targetLang,
    isTranslating,
    translationProvider,
    history,
    handleSwapLanguages,
    handleTranslate,
    handleSelectPreset,
    handleClear,
    presetPhrases: PRESET_TRANSLATION_PHRASES,
  };
}
