import { useState, useEffect, useCallback } from "react";
import {
  fetchExtractionRules,
  performOcrFromImage,
  extractValuesLocally,
} from "../services/smartExtractorService";

export function useSmartExtractor(companyId = 1) {
  const [rules, setRules] = useState([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [rulesError, setRulesError] = useState(null);

  const [inputMode, setInputMode] = useState("image"); // "image" | "text"
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [pastedText, setPastedText] = useState("");
  const [rawOcrText, setRawOcrText] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [extractedResults, setExtractedResults] = useState([]);
  const [error, setError] = useState(null);

  // Load rules for the active company
  const reloadRules = useCallback(async () => {
    setLoadingRules(true);
    setRulesError(null);
    try {
      const data = await fetchExtractionRules(companyId, true);
      setRules(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading extraction rules:", err);
      setRules([]);
      setRulesError(err.message || "Failed to load extraction rules.");
    } finally {
      setLoadingRules(false);
    }
  }, [companyId]);

  useEffect(() => {
    reloadRules();
  }, [reloadRules]);

  // Handle Image File selection
  const selectImage = useCallback((file) => {
    setError(null);
    setExtractedResults([]);
    setRawOcrText("");
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (PNG, JPG, WebP, GIF).");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview(e.target.result);
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle Drag & Drop / Clipboard Paste
  const handleDropOrPaste = useCallback((event) => {
    event.preventDefault();
    setError(null);

    const items = event.clipboardData ? event.clipboardData.items : event.dataTransfer ? event.dataTransfer.files : [];
    
    if (event.clipboardData) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const blob = items[i].getAsFile();
          selectImage(blob);
          setInputMode("image");
          return;
        }
      }
      // If plain text pasted
      const text = event.clipboardData.getData("text");
      if (text) {
        setPastedText(text);
        setInputMode("text");
      }
    } else if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      selectImage(event.dataTransfer.files[0]);
      setInputMode("image");
    }
  }, [selectImage]);

  // Process Extraction from Image
  const processImageExtraction = useCallback(async () => {
    if (!imagePreview) {
      setError("Please upload or drag & drop a screenshot image first.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setExtractedResults([]);

    try {
      setProcessingStatus({ step: 1, message: "✓ Image loaded & ready", details: "Initializing OCR Engine..." });
      
      const ocrResult = await performOcrFromImage(imagePreview, (progressInfo) => {
        setProcessingStatus({
          step: 2,
          message: progressInfo.message,
          details: `Progress: ${Math.round((progressInfo.progress || 0) * 100)}%`,
        });
      });

      const text = ocrResult.rawText || "";
      setRawOcrText(text);

      setProcessingStatus({ step: 3, message: "✓ OCR Complete", details: "Identifying structured values..." });

      if (!text.trim()) {
        setError("No recognizable text was found in the image. Try uploading a clearer screenshot or paste text manually.");
        setIsProcessing(false);
        setProcessingStatus(null);
        return;
      }

      // Run extraction rules locally
      if (rulesError) throw new Error(`Could not load the current extraction rules: ${rulesError}`);
      if (rules.length === 0) throw new Error("No enabled extraction rules are configured for this organization.");
      const results = extractValuesLocally(text, rules);

      setExtractedResults(results);

      if (results.length === 0) {
        setError("No matching information found based on configured extraction rules.");
      }
    } catch (err) {
      console.error("Extraction error:", err);
      setError(err.message || "Failed to extract information from image.");
    } finally {
      setIsProcessing(false);
      setProcessingStatus(null);
    }
  }, [imagePreview, rules, rulesError]);

  // Process Extraction from Pasted Text
  const processTextExtraction = useCallback(() => {
    if (!pastedText || !pastedText.trim()) {
      setError("Please paste or type text first before requesting extraction.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setExtractedResults([]);

    try {
      setProcessingStatus({ step: 1, message: "✓ Pasted text received", details: "Applying extraction rules..." });

      if (rulesError) throw new Error(`Could not load the current extraction rules: ${rulesError}`);
      if (rules.length === 0) throw new Error("No enabled extraction rules are configured for this organization.");
      const results = extractValuesLocally(pastedText, rules);

      setExtractedResults(results);
      setRawOcrText(pastedText);

      if (results.length === 0) {
        setError("No matching information found in the pasted text.");
      }
    } catch (err) {
      setError(err.message || "Text extraction failed.");
    } finally {
      setIsProcessing(false);
      setProcessingStatus(null);
    }
  }, [pastedText, rules, rulesError]);

  // Update Extracted Value (e.g. agent corrects OCR typo)
  const updateExtractedValue = useCallback((index, newValue) => {
    setExtractedResults((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          value: newValue,
          is_valid: Boolean(newValue && newValue.trim()),
          warning: null, // Agent manual correction overrides warning
        };
      }
      return updated;
    });
  }, []);

  // Reset Extractor State
  const resetExtractor = useCallback(() => {
    setImageFile(null);
    setImagePreview(null);
    setPastedText("");
    setRawOcrText("");
    setExtractedResults([]);
    setError(null);
    setIsProcessing(false);
    setProcessingStatus(null);
  }, []);

  return {
    rules,
    loadingRules,
    rulesError,
    reloadRules,

    inputMode,
    setInputMode,

    imageFile,
    imagePreview,
    selectImage,

    pastedText,
    setPastedText,

    rawOcrText,

    isProcessing,
    processingStatus,

    extractedResults,
    updateExtractedValue,

    error,
    setError,

    handleDropOrPaste,
    processImageExtraction,
    processTextExtraction,
    resetExtractor,
  };
}
