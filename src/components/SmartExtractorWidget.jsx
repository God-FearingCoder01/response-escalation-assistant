import { useState, useEffect, useRef } from "react";
import { fetchExtractionRules, extractStructuredData } from "../services/smartExtractorService";

export default function SmartExtractorWidget({
  onAutoFillValues,
  showToast = () => {},
  isOpen = false,
  onClose = () => {},
}) {
  const [imagePreview, setImagePreview] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [extractedResults, setExtractedResults] = useState([]);
  const [rawOcrText, setRawOcrText] = useState("");
  const [rules, setRules] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchExtractionRules().then(setRules);

    const handleRulesUpdated = () => {
      fetchExtractionRules().then(setRules);
    };
    window.addEventListener("rea_extraction_rules_updated", handleRulesUpdated);
    return () => window.removeEventListener("rea_extraction_rules_updated", handleRulesUpdated);
  }, []);

  // Listen for global Ctrl+V / Cmd+V paste events when the widget modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e) => {
      // Don't intercept paste if user is typing in an input field inside the modal
      if (
        e.target &&
        (e.target.tagName === "INPUT" ||
          e.target.tagName === "TEXTAREA" ||
          e.target.isContentEditable)
      ) {
        return;
      }

      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData || !clipboardData.items) return;

      const items = clipboardData.items;
      let foundImage = false;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type && item.type.startsWith("image/")) {
          const blob = item.getAsFile();
          if (blob) {
            foundImage = true;
            e.preventDefault();
            processImageFile(blob);
            showToast("📋 Image pasted from clipboard!", "success");
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [isOpen, rules]);

  const handlePasteButtonClick = async (e) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const clipboardItems = await navigator.clipboard.read();
        let found = false;
        for (const item of clipboardItems) {
          const imageType = item.types.find((type) => type.startsWith("image/"));
          if (imageType) {
            const blob = await item.getType(imageType);
            const file = new File([blob], "pasted-screenshot.png", { type: imageType });
            processImageFile(file);
            showToast("📋 Image pasted from clipboard!", "success");
            found = true;
            break;
          }
        }
        if (!found) {
          showToast("No image found in clipboard. Copy an image or screenshot first (Ctrl+V)!", "info");
        }
      } else {
        showToast("Press Ctrl+V (or Cmd+V) to paste your copied screenshot.", "info");
      }
    } catch (err) {
      console.warn("Clipboard read permission or API fallback:", err);
      showToast("Press Ctrl+V (or Cmd+V) to paste your copied screenshot.", "info");
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processImageFile(file);
  };

  const loadTesseractEngine = () => {
    return new Promise((resolve, reject) => {
      if (window.Tesseract) return resolve(window.Tesseract);
      const existing = document.getElementById("tesseract-cdn-script");
      if (existing) {
        existing.addEventListener("load", () => resolve(window.Tesseract));
        existing.addEventListener("error", reject);
        return;
      }
      const script = document.createElement("script");
      script.id = "tesseract-cdn-script";
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js";
      script.onload = () => resolve(window.Tesseract);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const preprocessImage = (srcData) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        // Apply grayscale & contrast enhancement for OCR accuracy
        const contrastFactor = 1.25;
        for (let i = 0; i < data.length; i += 4) {
          const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const enhanced = Math.min(255, Math.max(0, contrastFactor * (avg - 128) + 128));
          data[i] = enhanced;
          data[i + 1] = enhanced;
          data[i + 2] = enhanced;
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(srcData);
      img.src = srcData;
    });
  };

  const processImageFile = async (file) => {
    if (!file.type.startsWith("image/")) {
      showToast("Please upload a valid screenshot or image file.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const srcData = event.target.result;
      setImagePreview(srcData);
      setIsScanning(true);

      try {
        const processedSrc = await preprocessImage(srcData);
        const tesseract = await loadTesseractEngine();
        let ocrText = "";
        if (tesseract) {
          const res = await tesseract.recognize(processedSrc, "eng");
          ocrText = res?.data?.text || "";
        }
        setRawOcrText(ocrText);
        const structured = extractStructuredData(ocrText, rules);
        setExtractedResults(structured);
      } catch (err) {
        console.error("OCR extraction error:", err);
        showToast("Error processing OCR text from screenshot.", "error");
      } finally {
        setIsScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResultChange = (index, newValue) => {
    setExtractedResults((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], value: newValue };
      return updated;
    });
  };

  const handleCopyAll = () => {
    if (extractedResults.length === 0) return;
    const formatted = extractedResults.map((r) => `${r.label}: ${r.value}`).join("\n");
    navigator.clipboard.writeText(formatted);
    showToast("📋 All extracted data copied to clipboard!", "success");
  };

  const handleAutoFill = () => {
    if (!onAutoFillValues || extractedResults.length === 0) return;
    const updates = {};
    extractedResults.forEach((r) => {
      if (r.targetPlaceholder) {
        updates[r.targetPlaceholder] = r.value;
      }
      // Also map common placeholder aliases
      const lower = r.label.toLowerCase();
      if (lower.includes("transaction")) {
        updates["transaction_number"] = r.value;
        updates["reference_no"] = r.value;
      } else if (lower.includes("amount")) {
        updates["amount"] = r.value;
      } else if (lower.includes("account")) {
        updates["account_number"] = r.value;
        updates["customer_name"] = updates["customer_name"] || r.value;
      } else if (lower.includes("phone")) {
        updates["phone_number"] = r.value;
        updates["phone"] = r.value;
      }
    });

    onAutoFillValues(updates);
    showToast("⚡ Auto-filled template parameter inputs!", "success");
    if (onClose) onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
      <div
        className="w-full max-w-2xl rounded-3xl border shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        style={{ borderColor: "#4cd34c", backgroundColor: "var(--panel-bg)", color: "var(--app-text)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--field-border)" }}>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">📷</span>
            <div>
              <h3 className="font-extrabold text-lg flex items-center gap-2" style={{ color: "var(--app-text)" }}>
                Smart Information Extractor
              </h3>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                Extract structured transaction numbers, account details & receipts automatically.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-bold px-2.5 py-1 rounded-xl bg-[var(--field-bg)] border hover:bg-red-500/20 hover:text-red-400 transition"
            style={{ borderColor: "var(--field-border)" }}
          >
            ✕
          </button>
        </div>

        {/* Dropzone, Paste & Upload */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition hover:border-[#4cd34c] hover:bg-[#4cd34c]/5 space-y-2 select-none"
          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          <div className="text-3xl">📥</div>
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--app-text)" }}>
            Drop Screenshot, Paste (Ctrl+V) or Upload Image
          </div>
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            Supports PNG, JPG, WebP screenshots, receipts & pasted clipboard images
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-4 py-1.5 rounded-xl bg-[#4cd34c]/20 border border-[#4cd34c]/40 text-[#4cd34c] font-bold text-xs hover:bg-[#4cd34c] hover:text-black transition"
            >
              📁 Browse Image
            </button>
            <button
              type="button"
              onClick={handlePasteButtonClick}
              className="px-4 py-1.5 rounded-xl bg-[var(--app-bg)] border text-[var(--app-text)] font-bold text-xs hover:bg-[#4cd34c]/20 hover:text-[#4cd34c] hover:border-[#4cd34c]/50 transition flex items-center gap-1.5"
              style={{ borderColor: "var(--field-border)" }}
            >
              📋 Paste from Clipboard <span className="text-[10px] opacity-75 font-mono">(Ctrl+V)</span>
            </button>
          </div>
        </div>

        {/* Image Preview & Results Split Grid */}
        {imagePreview && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-2">
            {/* Image Preview Card */}
            <div className="md:col-span-5 rounded-2xl border p-3 bg-[var(--field-bg)] flex flex-col justify-between space-y-2" style={{ borderColor: "var(--field-border)" }}>
              <div className="text-[10px] uppercase font-bold text-[#4cd34c]">Uploaded Screenshot</div>
              <img
                src={imagePreview}
                alt="Screenshot Preview"
                className="max-h-48 object-contain rounded-xl w-full mx-auto border"
                style={{ borderColor: "var(--field-border)" }}
              />
              {isScanning && (
                <div className="text-center text-xs font-bold text-[#4cd34c] animate-pulse py-1">
                  Scanning OCR text...
                </div>
              )}
            </div>

            {/* Extracted Data Card */}
            <div className="md:col-span-7 rounded-2xl border p-4 space-y-3 bg-[var(--field-bg)]" style={{ borderColor: "var(--field-border)" }}>
              <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--field-border)" }}>
                <span className="text-xs uppercase font-extrabold text-[#4cd34c] tracking-wider">
                  Extracted Information ({extractedResults.length})
                </span>
                <span className="text-[10px] opacity-75 font-mono">Editable fields</span>
              </div>

              {extractedResults.length > 0 ? (
                <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                  {extractedResults.map((res, idx) => (
                    <div key={idx} className="space-y-1 p-2.5 rounded-xl border bg-[var(--app-bg)] shadow-sm" style={{ borderColor: "var(--field-border)" }}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-[var(--app-text)]">{res.label}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#4cd34c]/20 text-[#4cd34c] border border-[#4cd34c]/30 flex items-center gap-1">
                          ✓ Pattern Matched
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={res.value}
                          onChange={(e) => handleResultChange(idx, e.target.value)}
                          className="w-full rounded-lg border px-2.5 py-1.5 text-xs font-mono font-bold focus:outline-none focus:border-[#4cd34c]"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(res.value);
                            showToast(`Copied ${res.label}!`, "success");
                          }}
                          className="px-2.5 py-1.5 rounded-lg border text-xs font-bold hover:bg-[#4cd34c]/20 hover:text-[#4cd34c] transition"
                          style={{ borderColor: "var(--field-border)" }}
                          title="Copy field value"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs italic opacity-75" style={{ color: "var(--text-muted)" }}>
                  {isScanning ? "Scanning image for active extraction rules..." : "No matching rules found in screenshot text."}
                </div>
              )}

              {/* Action Buttons */}
              {extractedResults.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: "var(--field-border)" }}>
                  <button
                    type="button"
                    onClick={handleCopyAll}
                    className="flex-1 py-2 px-3 rounded-xl border border-[#4cd34c]/40 bg-[#4cd34c]/10 text-[#4cd34c] font-bold text-xs hover:bg-[#4cd34c] hover:text-black transition flex items-center justify-center gap-1.5"
                  >
                    📋 Copy All Extracted Data
                  </button>
                  {onAutoFillValues && (
                    <button
                      type="button"
                      onClick={handleAutoFill}
                      className="flex-1 py-2 px-3 rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-black font-extrabold text-xs shadow-md hover:opacity-90 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      ⚡ Auto-Fill Template
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
