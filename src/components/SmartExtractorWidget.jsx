import { useState, useEffect, useMemo } from "react";
import { useSmartExtractor } from "../hooks/useSmartExtractor";

export default function SmartExtractorWidget({
  companyId = 1,
  availableFields = [],
  templates = [],
  activeTemplate = null,
  onInsertIntoTemplate = () => {},
  onApplyToTemplate = () => {},
  showToast = () => {},
  isOpen = false,
  onClose = () => {},
}) {
  const extractor = useSmartExtractor(companyId);

  // The widget stays mounted while hidden; refresh rules each time it opens
  // so changes made in Admin Dashboard take effect without a page reload.
  useEffect(() => {
    if (isOpen) extractor.reloadRules();
  }, [isOpen, extractor.reloadRules]);

  const [showRawText, setShowRawText] = useState(false);
  const [selectedTargetTemplateId, setSelectedTargetTemplateId] = useState("");
  const [insertModal, setInsertModal] = useState({
    isOpen: false,
    value: "",
    resultField: "",
    selectedField: "",
    targetTemplateId: "",
  });

  const [selectedFieldValues, setSelectedFieldValues] = useState({});

  const handleSelectFieldValue = (fieldKey, val, vIdx) => {
    const fk = (fieldKey || "").toLowerCase();

    setSelectedFieldValues((prev) => {
      const nextMap = { ...prev, [fieldKey]: val };

      // Synchronize reference_number <-> amount by index vIdx
      if (fk.includes("reference") || fk.includes("ref") || fk.includes("tx")) {
        const amtResult = extractor.extractedResults.find(
          (r) => (r.result_field || "").toLowerCase().includes("amount") || (r.result_field || "").toLowerCase().includes("price")
        );
        if (amtResult) {
          const amtVals = amtResult.all_values && amtResult.all_values.length > 0 ? amtResult.all_values : [amtResult.value];
          if (amtVals[vIdx]) {
            nextMap[amtResult.result_field || "amount"] = amtVals[vIdx];
          }
        }
      } else if (fk.includes("amount") || fk.includes("price")) {
        const refResult = extractor.extractedResults.find(
          (r) => (r.result_field || "").toLowerCase().includes("reference") || (r.result_field || "").toLowerCase().includes("tx")
        );
        if (refResult) {
          const refVals = refResult.all_values && refResult.all_values.length > 0 ? refResult.all_values : [refResult.value];
          if (refVals[vIdx]) {
            nextMap[refResult.result_field || "reference_number"] = refVals[vIdx];
          }
        }
      }

      return nextMap;
    });
  };

  // Sync default selected field values whenever extracted results change
  useEffect(() => {
    if (extractor.extractedResults && extractor.extractedResults.length > 0) {
      const initialMap = {};
      extractor.extractedResults.forEach((res) => {
        const fieldKey = res.result_field || res.rule_name;
        const vals = res.all_values && res.all_values.length > 0 ? res.all_values : [res.value];
        if (!selectedFieldValues[fieldKey] || !vals.includes(selectedFieldValues[fieldKey])) {
          initialMap[fieldKey] = vals[0];
        } else {
          initialMap[fieldKey] = selectedFieldValues[fieldKey];
        }
      });
      setSelectedFieldValues(initialMap);
    }
  }, [extractor.extractedResults]);

  // Extract placeholder names from template body string
  const getTemplatePlaceholders = (body = "") => {
    const matches = body.match(/\{([a-zA-Z0-9_]+)\}/g) || [];
    return Array.from(new Set(matches.map((m) => m.replace(/[{}]/g, ""))));
  };

  // List of all currently extracted result fields
  const extractedFieldsList = useMemo(() => {
    return (extractor.extractedResults || [])
      .map((r) => (r.result_field || "").toLowerCase().trim())
      .filter(Boolean);
  }, [extractor.extractedResults]);

  // Categorize & Rank Templates based on how many extracted fields they require
  const rankedTemplates = useMemo(() => {
    if (extractedFieldsList.length === 0 || !Array.isArray(templates) || templates.length === 0) {
      return { tier1: [], tier2: [], all: templates || [] };
    }

    const tier1 = []; // Requires exactly the fields found in the extraction
    const tier2 = []; // Uses extracted fields but also needs other inputs

    templates.forEach((t) => {
      const phs = getTemplatePlaceholders(t.body || "").map((p) => p.toLowerCase());
      const matching = extractedFieldsList.filter((ef) => phs.includes(ef));

      const extraFields = phs.filter((field) => !extractedFieldsList.includes(field));
      const missingExtractedFields = extractedFieldsList.filter((field) => !phs.includes(field));
      const matchData = {
        ...t,
        matchingFields: matching,
        extraFields,
        missingExtractedFields,
        placeholderList: phs,
      };

      if (matching.length === extractedFieldsList.length && extraFields.length === 0) {
        tier1.push(matchData);
      } else if (matching.length > 0) {
        tier2.push(matchData);
      }
    });

    // Within partial matches, prefer templates that include every extracted
    // field, then those with fewer additional required fields.
    tier2.sort((a, b) =>
      a.missingExtractedFields.length - b.missingExtractedFields.length ||
      a.extraFields.length - b.extraFields.length ||
      a.name.localeCompare(b.name)
    );

    return { tier1, tier2, all: templates };
  }, [templates, extractedFieldsList]);

  // Set default target template whenever ranked templates change
  useEffect(() => {
    if (rankedTemplates.tier1.length > 0) {
      setSelectedTargetTemplateId(rankedTemplates.tier1[0].id);
    } else if (rankedTemplates.tier2.length > 0) {
      setSelectedTargetTemplateId(rankedTemplates.tier2[0].id);
    } else if (activeTemplate) {
      setSelectedTargetTemplateId(activeTemplate.id);
    } else if (templates.length > 0) {
      setSelectedTargetTemplateId(templates[0].id);
    }
  }, [rankedTemplates, activeTemplate, templates]);

  // Global Clipboard Paste listener when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleWindowPaste = (e) => {
      if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")) {
        return;
      }

      if (e.clipboardData && e.clipboardData.items) {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf("image") !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            extractor.selectImage(file);
            extractor.setInputMode("image");
            showToast("Pasted image from clipboard! 📋");
            return;
          }
        }
        const text = e.clipboardData.getData("text");
        if (text && text.trim()) {
          extractor.setPastedText(text);
          extractor.setInputMode("text");
          showToast("Pasted text from clipboard! 📝");
        }
      }
    };

    window.addEventListener("paste", handleWindowPaste);
    return () => window.removeEventListener("paste", handleWindowPaste);
  }, [isOpen, extractor, showToast]);

  if (!isOpen) return null;

  const targetTemplate =
    templates.find((t) => String(t.id) === String(selectedTargetTemplateId)) ||
    activeTemplate ||
    templates[0];

  const handleCopy = (val, label) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    showToast(`Copied ${label || "value"} to clipboard!`);
  };

  const handleOpenInsertModal = (res) => {
    let defaultTarget = res.result_field;
    const currentPlaceholders = targetTemplate ? getTemplatePlaceholders(targetTemplate.body) : availableFields;

    if (!currentPlaceholders.includes(defaultTarget)) {
      const match = currentPlaceholders.find(
        (f) => f.toLowerCase() === res.result_field.toLowerCase() || f.toLowerCase().includes(res.result_field.toLowerCase())
      );
      if (match) defaultTarget = match;
      else if (currentPlaceholders.length > 0) defaultTarget = currentPlaceholders[0];
    }

    setInsertModal({
      isOpen: true,
      value: res.value,
      resultField: res.result_field,
      selectedField: defaultTarget,
      targetTemplateId: selectedTargetTemplateId || (targetTemplate?.id ?? ""),
    });
  };

  const handleConfirmSingleInsert = () => {
    if (!insertModal.selectedField || !insertModal.value) return;

    const chosenTpl = templates.find((t) => String(t.id) === String(insertModal.targetTemplateId)) || targetTemplate;

    if (chosenTpl) {
      onApplyToTemplate(chosenTpl, { [insertModal.selectedField]: insertModal.value });
    } else {
      onInsertIntoTemplate(insertModal.selectedField, insertModal.value);
    }

    showToast(`Inserted "${insertModal.value}" into {${insertModal.selectedField}} control!`);
    setInsertModal({ isOpen: false, value: "", resultField: "", selectedField: "", targetTemplateId: "" });
  };

  const handleApplyAllToTargetTemplate = () => {
    if (!targetTemplate || extractor.extractedResults.length === 0) return;

    const tplPlaceholders = getTemplatePlaceholders(targetTemplate.body || "");
    const map = {};
    extractor.extractedResults.forEach((res) => {
      let fieldKey = res.result_field || res.rule_name;
      const chosen = selectedFieldValues[fieldKey] || res.value;

      if (fieldKey && chosen) {
        // Map exact or fuzzy placeholder name in the target template
        if (tplPlaceholders.length > 0 && !tplPlaceholders.includes(fieldKey)) {
          const fuzzyMatch = tplPlaceholders.find((p) => {
            const pLower = p.toLowerCase();
            const fkLower = fieldKey.toLowerCase();
            return pLower === fkLower || pLower.includes(fkLower) || fkLower.includes(pLower);
          });
          if (fuzzyMatch) fieldKey = fuzzyMatch;
        }
        map[fieldKey] = chosen;
      }
    });

    onApplyToTemplate(targetTemplate, map);
  };

  const singleInsertTemplate = templates.find((t) => String(t.id) === String(insertModal.targetTemplateId)) || targetTemplate;
  const singleInsertPlaceholders = singleInsertTemplate ? getTemplatePlaceholders(singleInsertTemplate.body) : availableFields;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        className="w-full max-w-2xl rounded-3xl border shadow-2xl transition-all overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          borderColor: "var(--panel-border, #374151)",
          backgroundColor: "var(--card-bg, #1f2937)",
          color: "var(--app-text, #f9fafb)",
        }}
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: "var(--panel-border, #374151)" }}>
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#4cd34c]/10 text-xl text-[#4cd34c]">
              🔍
            </span>
            <div>
              <h3 className="text-lg font-bold text-white">Smart Extractor</h3>
              <p className="text-xs text-gray-400">Extract structured reference data from screenshots, images, or text.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white transition"
          >
            ✕
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-xs text-gray-400">
            <span>
              {extractor.loadingRules
                ? "Loading current organization rules..."
                : extractor.rulesError
                  ? `Could not load rules: ${extractor.rulesError}`
                  : `${extractor.rules.length} enabled rule${extractor.rules.length === 1 ? "" : "s"} loaded`}
            </span>
            {extractor.rulesError && (
              <button onClick={extractor.reloadRules} className="text-[#4cd34c] hover:underline">
                Retry
              </button>
            )}
          </div>
          {/* TAB SWITCHER */}
          <div className="flex rounded-xl bg-black/30 p-1 border border-white/10">
            <button
              onClick={() => extractor.setInputMode("image")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
                extractor.inputMode === "image"
                  ? "bg-[#4cd34c] text-black shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              🖼️ Upload / Drag / Paste Screenshot (Ctrl+V)
            </button>
            <button
              onClick={() => extractor.setInputMode("text")}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
                extractor.inputMode === "text"
                  ? "bg-[#4cd34c] text-black shadow-md"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              📝 Paste Customer Text
            </button>
          </div>

          {/* IMAGE MODE CONTENT */}
          {extractor.inputMode === "image" && (
            <div className="space-y-4">
              {!extractor.imagePreview ? (
                <div
                  onDrop={extractor.handleDropOrPaste}
                  onDragOver={(e) => e.preventDefault()}
                  className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition border-white/20 hover:border-[#4cd34c]/50 bg-black/20"
                >
                  <span className="mb-3 text-4xl">📥</span>
                  <p className="text-sm font-semibold text-white">Drag & Drop Screenshot Here</p>
                  <p className="text-xs text-[#4cd34c] mt-1 font-medium">✨ Or simply press Ctrl+V anywhere to paste screenshot from clipboard!</p>

                  <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#4cd34c]/20 px-4 py-2 text-xs font-bold text-[#4cd34c] border border-[#4cd34c]/30 hover:bg-[#4cd34c]/30 transition">
                    📁 Browse Image File
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => extractor.selectImage(e.target.files[0])}
                    />
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border p-4 bg-black/20 border-white/10">
                    <img
                      src={extractor.imagePreview}
                      alt="Source Preview"
                      className="h-36 max-w-full sm:max-w-[200px] object-contain rounded-xl border border-white/10 bg-black/40"
                    />
                    <div className="flex-1 space-y-2 text-center sm:text-left">
                      <p className="text-xs font-semibold text-white">Source Screenshot Loaded</p>
                      <p className="text-[11px] text-gray-400">Ready to run OCR optical character recognition and pattern rules.</p>

                      <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-2">
                        <button
                          onClick={extractor.processImageExtraction}
                          disabled={extractor.isProcessing || extractor.loadingRules}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#4cd34c] px-4 py-2 text-xs font-bold text-black shadow-lg hover:bg-[#42be42] disabled:opacity-50 transition cursor-pointer"
                        >
                          {extractor.isProcessing ? "Extracting..." : "🔍 Extract Information"}
                        </button>
                        <button
                          onClick={extractor.resetExtractor}
                          disabled={extractor.isProcessing}
                          className="rounded-xl border border-white/10 px-3 py-2 text-xs text-gray-300 hover:bg-white/10 transition"
                        >
                          Change Image
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TEXT MODE CONTENT */}
          {extractor.inputMode === "text" && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2">Customer Message / Ticket Text:</label>
                <textarea
                  rows={5}
                  value={extractor.pastedText}
                  onChange={(e) => extractor.setPastedText(e.target.value)}
                  onPaste={extractor.handleDropOrPaste}
                  placeholder="Paste customer text containing transaction reference, date, amount, or phone numbers..."
                  className="w-full rounded-2xl border bg-black/30 p-4 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#4cd34c]/50 border-white/10"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={extractor.processTextExtraction}
                  disabled={extractor.isProcessing || extractor.loadingRules || !extractor.pastedText.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#4cd34c] px-5 py-2.5 text-xs font-bold text-black shadow-lg hover:bg-[#42be42] disabled:opacity-50 transition cursor-pointer"
                >
                  {extractor.isProcessing ? "Processing..." : "🔍 Extract Information"}
                </button>
              </div>
            </div>
          )}

          {/* PROCESSING STATUS ANIMATION */}
          {extractor.isProcessing && (
            <div className="rounded-2xl border border-[#4cd34c]/30 bg-[#4cd34c]/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[#4cd34c]">
                <span className="animate-spin text-sm">⏳</span>
                <span>{extractor.processingStatus?.message || "Processing..."}</span>
              </div>
              <p className="text-[11px] text-gray-300">{extractor.processingStatus?.details || "Please wait while values are identified..."}</p>
            </div>
          )}

          {/* ERROR DISPLAY */}
          {extractor.error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300 flex items-start gap-2">
              <span>⚠️</span>
              <span>{extractor.error}</span>
            </div>
          )}

          {/* TARGET TEMPLATE PICKER & EXTRACTED RESULTS DISPLAY */}
          {extractor.extractedResults.length > 0 && (
            <div className="space-y-4 pt-2">
              {/* TARGET TEMPLATE SELECTOR BANNER */}
              <div className="rounded-2xl border p-4 bg-[#4cd34c]/10 border-[#4cd34c]/30 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-[#4cd34c] uppercase tracking-wider flex items-center gap-1.5">
                      <span>🎯</span> Select Target Message Template
                    </h4>
                    <p className="text-[11px] text-gray-300 mt-0.5">
                      Exact matches use only extracted fields. Partial matches also need other fields:
                    </p>
                  </div>

                  <select
                    value={selectedTargetTemplateId}
                    onChange={(e) => setSelectedTargetTemplateId(e.target.value)}
                    className="rounded-xl border bg-black/60 px-3 py-2 text-xs font-bold text-white border-[#4cd34c]/40 focus:outline-none focus:ring-2 focus:ring-[#4cd34c] max-w-full truncate"
                  >
                    {rankedTemplates.tier1.length > 0 && (
                      <optgroup label="🌟 Best Match (Requires Only Extracted Fields)">
                        {rankedTemplates.tier1.map((t) => (
                          <option key={t.id} value={t.id}>
                            ✓ {t.name} ({t.matchingFields.map((f) => `{${f}}`).join(", ")})
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {rankedTemplates.tier2.length > 0 && (
                      <optgroup label="⚡ Partial Match (Also Requires Other Fields)">
                        {rankedTemplates.tier2.map((t) => (
                          <option key={t.id} value={t.id}>
                            • {t.name} (Uses {t.matchingFields.map((f) => `{${f}}`).join(", ")}{t.extraFields.length ? `; also needs ${t.extraFields.map((f) => `{${f}}`).join(", ")}` : ""}{t.missingExtractedFields.length ? `; missing ${t.missingExtractedFields.map((f) => `{${f}}`).join(", ")}` : ""})
                          </option>
                        ))}
                      </optgroup>
                    )}

                    {rankedTemplates.tier1.length === 0 && rankedTemplates.tier2.length === 0 && (
                      <optgroup label="All System Templates">
                        {templates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.category_type === "tech_escalation" ? "Tech Escalation" : "Customer Reply"})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={handleApplyAllToTargetTemplate}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#4cd34c] px-4 py-2 text-xs font-bold text-black shadow-lg hover:bg-[#42be42] transition cursor-pointer"
                  >
                    🎯 Apply Extracted Fields to "{targetTemplate?.name || "Selected Template"}"
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">Extracted Field Groups ({extractor.extractedResults.length})</h4>
                <p className="text-[11px] text-gray-400">Pick one choice for each field group if multiple matches were found.</p>
              </div>

              <div className="space-y-4">
                {extractor.extractedResults.map((res, idx) => {
                  const fieldKey = res.result_field || res.rule_name;
                  const allVals = res.all_values && res.all_values.length > 0 ? res.all_values : [res.value];
                  const hasMultiple = allVals.length > 1;
                  const currentSelected = selectedFieldValues[fieldKey] || allVals[0];

                  return (
                    <div key={idx} className="rounded-2xl border p-4 bg-black/30 space-y-3 border-white/10">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{res.is_valid ? "✓" : "⚠️"}</span>
                          <span>{res.rule_name}</span>
                          <span className="text-[10px] text-[#4cd34c] font-mono">{`{${fieldKey}}`}</span>
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border ${
                            hasMultiple
                              ? "border-purple-500/30 bg-purple-500/10 text-purple-400"
                              : res.is_valid
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                              : "border-amber-500/30 bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {hasMultiple ? `Multi-Match (${allVals.length} values)` : res.is_valid ? "Valid Format" : "Format Warning"}
                        </span>
                      </div>

                      {/* MULTI-VALUE CHECKED LIST / RADIO BOX */}
                      {hasMultiple ? (
                        <div className="space-y-2">
                          <p className="text-[11px] text-gray-300 font-medium">
                            Multiple values found for <span className="text-[#4cd34c] font-mono">{`{${fieldKey}}`}</span>. Select your choice:
                          </p>
                          <div className="space-y-1.5 rounded-xl border bg-black/40 p-2.5 border-white/10">
                            {allVals.map((val, vIdx) => {
                              const isChecked = currentSelected === val;

                              let pairedBadge = null;
                              const fkLower = fieldKey.toLowerCase();
                              if (fkLower.includes("reference") || fkLower.includes("ref") || fkLower.includes("tx")) {
                                const amtResult = extractor.extractedResults.find(
                                  (r) => (r.result_field || "").toLowerCase().includes("amount") || (r.result_field || "").toLowerCase().includes("price")
                                );
                                if (amtResult) {
                                  const amtVals = amtResult.all_values && amtResult.all_values.length > 0 ? amtResult.all_values : [amtResult.value];
                                  if (amtVals[vIdx]) {
                                    pairedBadge = `Amount: ${amtVals[vIdx]}`;
                                  }
                                }
                              } else if (fkLower.includes("amount") || fkLower.includes("price")) {
                                const refResult = extractor.extractedResults.find(
                                  (r) => (r.result_field || "").toLowerCase().includes("reference") || (r.result_field || "").toLowerCase().includes("tx")
                                );
                                if (refResult) {
                                  const refVals = refResult.all_values && refResult.all_values.length > 0 ? refResult.all_values : [refResult.value];
                                  if (refVals[vIdx]) {
                                    pairedBadge = `Ref: ${refVals[vIdx]}`;
                                  }
                                }
                              }

                              return (
                                <div
                                  key={vIdx}
                                  onClick={() => handleSelectFieldValue(fieldKey, val, vIdx)}
                                  className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition border text-xs font-mono ${
                                    isChecked
                                      ? "bg-[#4cd34c]/20 border-[#4cd34c] text-white font-bold"
                                      : "bg-black/20 border-transparent text-gray-300 hover:bg-white/5"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 flex-wrap">
                                    <input
                                      type="radio"
                                      name={`field_group_${fieldKey}`}
                                      checked={isChecked}
                                      onChange={() => handleSelectFieldValue(fieldKey, val, vIdx)}
                                      className="accent-[#4cd34c] h-4 w-4 cursor-pointer"
                                    />
                                    <span>{val}</span>
                                    {pairedBadge && (
                                      <span className="text-[10px] text-amber-300 font-mono bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded-md">
                                        🔗 {pairedBadge}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopy(val, `${res.rule_name} #${vIdx + 1}`);
                                    }}
                                    className="text-[10px] text-gray-400 hover:text-white px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 transition"
                                  >
                                    📋 Copy
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        /* SINGLE VALUE DISPLAY (No popup modal needed) */
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            value={currentSelected}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              setSelectedFieldValues((prev) => ({ ...prev, [fieldKey]: newVal }));
                              extractor.updateExtractedValue(idx, newVal);
                            }}
                            className="flex-1 rounded-xl border bg-black/40 px-3 py-2 text-xs font-mono text-[#4cd34c] focus:outline-none focus:ring-1 focus:ring-[#4cd34c] border-white/10"
                            title="Click to edit value if OCR contains a typo"
                          />
                          <button
                            onClick={() => handleCopy(currentSelected, res.rule_name)}
                            className="rounded-xl border px-3 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10 border-white/10 transition"
                          >
                            📋 Copy
                          </button>
                        </div>
                      )}

                      {res.warning && <p className="text-[11px] text-amber-400">{res.warning}</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* RAW OCR TEXT INSPECTOR ACCORDION */}
          {extractor.rawOcrText && (
            <div className="border-t pt-4 border-white/10">
              <button
                onClick={() => setShowRawText(!showRawText)}
                className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
              >
                <span>{showRawText ? "▼" : "▶"}</span>
                <span>Inspect Raw OCR / Text Result</span>
              </button>
              {showRawText && (
                <div className="mt-2 rounded-xl bg-black/40 p-3 font-mono text-[11px] text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto border border-white/10">
                  {extractor.rawOcrText}
                </div>
              )}
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="flex items-center justify-between border-t px-6 py-4 bg-black/20" style={{ borderColor: "var(--panel-border, #374151)" }}>
          <button
            onClick={extractor.resetExtractor}
            className="text-xs text-gray-400 hover:text-white transition"
          >
            Clear & Reset
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 px-5 py-2 text-xs font-semibold text-gray-300 hover:bg-white/10 transition"
          >
            Close
          </button>
        </div>
      </div>

      {/* SINGLE FIELD INSERTION MODAL */}
      {insertModal.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border p-6 shadow-2xl space-y-4 bg-gray-900 border-gray-700 text-white">
            <h4 className="text-base font-bold text-white">Use Extracted Value in Template</h4>

            <div className="rounded-xl bg-black/40 p-3 border border-gray-800 space-y-1">
              <p className="text-[11px] text-gray-400">Extracted Value ({insertModal.resultField}):</p>
              <p className="text-xs font-mono font-bold text-[#4cd34c] break-all">{insertModal.value}</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Target Message Template:</label>
                <select
                  value={insertModal.targetTemplateId}
                  onChange={(e) => setInsertModal((prev) => ({ ...prev, targetTemplateId: e.target.value }))}
                  className="w-full rounded-xl border bg-black/50 p-2.5 text-xs text-white border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                >
                  {rankedTemplates.tier1.length > 0 && (
                    <optgroup label="🌟 Best Match (Requires Only Extracted Fields)">
                      {rankedTemplates.tier1.map((t) => (
                        <option key={t.id} value={t.id}>
                          ✓ {t.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {rankedTemplates.tier2.length > 0 && (
                    <optgroup label="⚡ Partial Match (Also Requires Other Fields)">
                      {rankedTemplates.tier2.map((t) => (
                        <option key={t.id} value={t.id}>
                          • {t.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {rankedTemplates.tier1.length === 0 && rankedTemplates.tier2.length === 0 && (
                    <optgroup label="All System Templates">
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">Target Template Parameter Field:</label>
                <select
                  value={insertModal.selectedField}
                  onChange={(e) => setInsertModal((prev) => ({ ...prev, selectedField: e.target.value }))}
                  className="w-full rounded-xl border bg-black/50 p-2.5 text-xs text-white border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                >
                  {(singleInsertPlaceholders.length > 0 ? singleInsertPlaceholders : availableFields).map((f) => (
                    <option key={f} value={f}>
                      {`{${f}}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setInsertModal({ isOpen: false, value: "", resultField: "", selectedField: "", targetTemplateId: "" })}
                className="rounded-xl border border-gray-700 px-4 py-2 text-xs text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSingleInsert}
                className="rounded-xl bg-[#4cd34c] px-4 py-2 text-xs font-bold text-black hover:bg-[#42be42]"
              >
                🎯 Insert Only This Value
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
