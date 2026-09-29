import React, { useState } from "react";
import {
  validateExtractionPattern,
  extractValuesFromPattern,
  transformExtractedValue,
} from "../services/extractableFieldService";

export default function ExtractableFieldEditor({
  ph,
  cfg,
  extractedPlaceholders = [],
  updatePlaceholderConfig,
}) {
  const isExtractable = Boolean(cfg?.is_extractable);
  const extractionConfig = cfg?.extraction_config || {
    example_input: "MP260831.1923.T7382831",
    pattern: "MP[260831].[1923].T7382831",
    extractions: [],
  };

  const exampleInput = extractionConfig.example_input || "";
  const pattern = extractionConfig.pattern || "";

  // Target candidate fields (excluding the source field itself)
  const availableTargetFields = extractedPlaceholders.filter((p) => p !== ph);

  const validation = validateExtractionPattern(pattern);
  const [testInput, setTestInput] = useState("");
  const [testResults, setTestResults] = useState(null);

  const updateExtractionConfig = (updates) => {
    updatePlaceholderConfig(ph, {
      is_extractable: true,
      extraction_config: {
        ...extractionConfig,
        ...updates,
      },
    });
  };

  const handleToggleExtractable = (enabled) => {
    if (enabled) {
      const defaultPattern = pattern || "MP[260831].[1923].T7382831";
      const initialVal = validateExtractionPattern(defaultPattern);
      const defaultExtractions = initialVal.extractions.map((ext, idx) => {
        const targetField = availableTargetFields[idx] || availableTargetFields[0] || "";
        const isTimeField = targetField.toLowerCase().includes("time");
        const isDateField = targetField.toLowerCase().includes("date");
        return {
          id: `ext_${idx + 1}`,
          index: idx,
          sample_val: ext.sample_val,
          target_field: targetField,
          transform_type: isTimeField ? "time" : isDateField ? "date" : "none",
          date_input_format: "YYMMDD",
          date_output_format: "YYYY-MM-DD",
          time_input_format: "HHmm",
          time_output_format: "HH:mm",
        };
      });

      updatePlaceholderConfig(ph, {
        is_extractable: true,
        extraction_config: {
          example_input: exampleInput || "MP260831.1923.T7382831",
          pattern: defaultPattern,
          extractions: defaultExtractions,
        },
      });
    } else {
      updatePlaceholderConfig(ph, {
        is_extractable: false,
      });
    }
  };

  const handlePatternChange = (newPattern) => {
    const valResult = validateExtractionPattern(newPattern);
    let updatedExtractions = [];

    if (valResult.isValid) {
      const currentExtractions = extractionConfig.extractions || [];
      updatedExtractions = valResult.extractions.map((ext, idx) => {
        const existing = currentExtractions[idx] || {};
        const targetField = existing.target_field || availableTargetFields[idx] || availableTargetFields[0] || "";
        const isTimeField = targetField.toLowerCase().includes("time");
        const isDateField = targetField.toLowerCase().includes("date");
        return {
          id: existing.id || `ext_${idx + 1}`,
          index: idx,
          sample_val: ext.sample_val,
          target_field: targetField,
          transform_type: existing.transform_type || (isTimeField ? "time" : isDateField ? "date" : "none"),
          date_input_format: existing.date_input_format || "YYMMDD",
          date_output_format: existing.date_output_format || "YYYY-MM-DD",
          time_input_format: existing.time_input_format || "HHmm",
          time_output_format: existing.time_output_format || "HH:mm",
        };
      });
    }

    updateExtractionConfig({
      pattern: newPattern,
      extractions: updatedExtractions,
    });
  };

  const handleUpdateExtractionItem = (index, itemUpdates) => {
    const current = [...(extractionConfig.extractions || [])];
    if (current[index]) {
      current[index] = { ...current[index], ...itemUpdates };
      updateExtractionConfig({ extractions: current });
    }
  };

  const handleRunTest = (e) => {
    e.preventDefault();
    const testVal = testInput.trim() || exampleInput || "MP260929.1942.T9876543";
    const rawValues = extractValuesFromPattern(pattern, testVal);

    const extractions = extractionConfig.extractions || [];
    const results = extractions.map((ext, idx) => {
      const rawExtracted = rawValues[idx] ?? "N/A";
      const transformed = rawExtracted !== "N/A" ? transformExtractedValue(rawExtracted, ext) : "N/A";
      return {
        index: idx + 1,
        rawExtracted,
        transformed,
        target_field: ext.target_field || "(Unmapped)",
        transform_type: ext.transform_type || "none",
      };
    });

    setTestResults({
      inputTested: testVal,
      matchFound: rawValues.length > 0,
      results,
    });
  };

  const isSilent = Boolean(cfg?.is_silent);

  return (
    <div className="pt-2 border-t mt-2 space-y-3" style={{ borderColor: "var(--field-border)" }}>
      {/* Toggles: Silent Parameter & Extractable Field */}
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs font-bold text-amber-400 cursor-pointer">
          <input
            type="checkbox"
            checked={isSilent}
            onChange={(e) => updatePlaceholderConfig(ph, { is_silent: e.target.checked })}
            className="accent-amber-400 h-4 w-4 rounded"
          />
          <span>🤫 Silent Parameter ({`{${ph}}`})</span>
        </label>

        <label className="flex items-center gap-2 text-xs font-bold text-[#4cd34c] cursor-pointer">
          <input
            type="checkbox"
            checked={isExtractable}
            onChange={(e) => handleToggleExtractable(e.target.checked)}
            className="accent-[#4cd34c] h-4 w-4 rounded"
          />
          <span>☑ Make this field extractable</span>
        </label>
      </div>

      {isSilent && (
        <p className="text-[11px] text-amber-300/90 font-medium bg-amber-500/10 p-2 rounded-xl border border-amber-500/20">
          ℹ️ <strong>Silent Parameter:</strong> This parameter accepts agent input on forms and can populate other fields via extraction, but will <strong>NOT</strong> appear as a placeholder in the final message.
        </p>
      )}

      {isExtractable && (
        <div
          className="rounded-2xl border p-4 space-y-4 bg-[var(--app-bg)] shadow-inner"
          style={{ borderColor: "var(--field-border)" }}
        >
          <p className="text-[11px] text-[var(--text-muted)] font-normal">
            When enabled, values entered into this field can be used to automatically populate other template fields.
          </p>

          {/* STEP 1 & 2: Example Input & Pattern */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase font-bold block mb-1 text-[var(--text-muted)]">
                Step 1: Example Input
              </label>
              <input
                type="text"
                value={exampleInput}
                onChange={(e) => updateExtractionConfig({ example_input: e.target.value })}
                placeholder="e.g. MP260831.1923.T7382831"
                className="w-full rounded-xl border p-2 text-xs font-mono font-semibold"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
              />
              <span className="text-[9px] text-[var(--text-muted)] mt-0.5 block">
                Representative example value received by this field.
              </span>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold block mb-1 text-[var(--text-muted)]">
                Step 2: Define Extraction (Square Brackets)
              </label>
              <input
                type="text"
                value={pattern}
                onChange={(e) => handlePatternChange(e.target.value)}
                placeholder="e.g. MP[260831].[1923].T7382831"
                className="w-full rounded-xl border p-2 text-xs font-mono font-bold focus:outline-none focus:border-[#4cd34c]"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
              />
              <span className="text-[9px] text-[var(--text-muted)] mt-0.5 block">
                Wrap the portions you want REA to extract in [square brackets].
              </span>
            </div>
          </div>

          {/* Pattern Validation Feedback */}
          {!validation.isValid ? (
            <div className="p-2.5 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 text-xs font-semibold">
              ⚠️ Invalid Extraction Definition: {validation.error}
            </div>
          ) : (
            <div className="p-3 rounded-xl border border-[#4cd34c]/30 bg-[#4cd34c]/10 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#4cd34c]">
                <span>✓ {validation.extractions.length} extractable value(s) detected</span>
                <span className="text-[10px] opacity-80">Extraction Preview</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                {validation.segments.map((seg, i) =>
                  seg.type === "literal" ? (
                    <span key={i} className="text-[var(--text-muted)]">
                      {seg.value}
                    </span>
                  ) : (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg bg-[#4cd34c] text-black font-extrabold shadow-sm flex items-center gap-1"
                    >
                      <span className="text-[9px] opacity-75">#{seg.index + 1}</span>
                      <span>[{seg.value}]</span>
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          {/* STEP 3: MAP EXTRACTIONS & CONFIG TRANSFORMATONS */}
          {validation.isValid && (
            <div className="space-y-3">
              <h5 className="text-xs uppercase font-bold text-[#4cd34c] border-b pb-1" style={{ borderColor: "var(--field-border)" }}>
                Step 3: Map Extractions & Transformations
              </h5>

              {(extractionConfig.extractions || []).map((ext, idx) => {
                const sampleVal = ext.sample_val;
                const transformType = ext.transform_type || "none";
                const previewVal = transformExtractedValue(sampleVal, ext);

                return (
                  <div
                    key={ext.id || idx}
                    className="p-3 rounded-xl border space-y-3 bg-[var(--field-bg)]"
                    style={{ borderColor: "var(--field-border)" }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-[var(--app-text)]">
                        <span className="h-5 w-5 rounded-full bg-[#4cd34c] text-black flex items-center justify-center text-[10px] font-extrabold">
                          {idx + 1}
                        </span>
                        <span>Extracted Value:</span>
                        <code className="px-2 py-0.5 rounded bg-black/30 text-[#4cd34c] font-mono">
                          {sampleVal}
                        </code>
                      </div>

                      <div className="text-xs font-mono text-[var(--text-muted)]">
                        Result Preview: <span className="font-bold text-[#4cd34c]">{previewVal}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] block mb-1 font-bold text-[var(--text-muted)]">
                          Auto-fill Target Field:
                        </label>
                        <select
                          value={ext.target_field || ""}
                          onChange={(e) => handleUpdateExtractionItem(idx, { target_field: e.target.value })}
                          className="w-full rounded-lg border p-1.5 text-xs font-semibold focus:outline-none focus:border-[#4cd34c]"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                        >
                          <option value="">-- Select Target Field --</option>
                          {availableTargetFields.map((t) => (
                            <option key={t} value={t}>
                              {`{${t}}`}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] block mb-1 font-bold text-[var(--text-muted)]">
                          Transformation:
                        </label>
                        <select
                          value={transformType}
                          onChange={(e) => handleUpdateExtractionItem(idx, { transform_type: e.target.value })}
                          className="w-full rounded-lg border p-1.5 text-xs font-semibold focus:outline-none focus:border-[#4cd34c]"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                        >
                          <option value="none">No transformation (Raw text)</option>
                          <option value="date">Date Format Transform</option>
                          <option value="time">Time Format Transform</option>
                        </select>
                      </div>

                      {/* Transform Details */}
                      {transformType === "date" && (
                        <div className="col-span-full md:col-span-1 grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] block mb-0.5 text-[var(--text-muted)]">Input Date Format:</label>
                            <select
                              value={ext.date_input_format || "YYMMDD"}
                              onChange={(e) => handleUpdateExtractionItem(idx, { date_input_format: e.target.value })}
                              className="w-full rounded-lg border p-1 text-[11px] font-mono"
                              style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                            >
                              <option value="YYMMDD">YYMMDD (260831)</option>
                              <option value="YYYYMMDD">YYYYMMDD (20260831)</option>
                              <option value="DDMMYY">DDMMYY (310826)</option>
                              <option value="DDMMYYYY">DDMMYYYY (31082026)</option>
                              <option value="MMDDYY">MMDDYY (083126)</option>
                              <option value="MMDDYYYY">MMDDYYYY (08312026)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] block mb-0.5 text-[var(--text-muted)]">Output Format:</label>
                            <select
                              value={ext.date_output_format || "YYYY-MM-DD"}
                              onChange={(e) => handleUpdateExtractionItem(idx, { date_output_format: e.target.value })}
                              className="w-full rounded-lg border p-1 text-[11px] font-mono"
                              style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                            >
                              <option value="YYYY-MM-DD">YYYY-MM-DD (2026-08-31)</option>
                              <option value="DD/MM/YYYY">DD/MM/YYYY (31/08/2026)</option>
                              <option value="DD.MM.YYYY">DD.MM.YYYY (31.08.2026)</option>
                              <option value="YYYY/MM/DD">YYYY/MM/DD (2026/08/31)</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {transformType === "time" && (
                        <div className="col-span-full md:col-span-1 grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] block mb-0.5 text-[var(--text-muted)]">Input Time Format:</label>
                            <select
                              value={ext.time_input_format || "HHmm"}
                              onChange={(e) => handleUpdateExtractionItem(idx, { time_input_format: e.target.value })}
                              className="w-full rounded-lg border p-1 text-[11px] font-mono"
                              style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                            >
                              <option value="HHmm">HHmm (1923)</option>
                              <option value="HHmmss">HHmmss (192345)</option>
                              <option value="HH:mm">HH:mm (19:23)</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] block mb-0.5 text-[var(--text-muted)]">Output Format:</label>
                            <select
                              value={ext.time_output_format || "HH:mm"}
                              onChange={(e) => handleUpdateExtractionItem(idx, { time_output_format: e.target.value })}
                              className="w-full rounded-lg border p-1 text-[11px] font-mono"
                              style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                            >
                              <option value="HH:mm">HH:mm (19:23)</option>
                              <option value="HH:mm:ss">HH:mm:ss (19:23:00)</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* STEP 4: INTERACTIVE TEST EXTRACTION AREA */}
          {validation.isValid && (
            <div className="p-3.5 rounded-2xl border bg-[var(--field-bg)] space-y-3" style={{ borderColor: "var(--field-border)" }}>
              <div className="flex items-center justify-between">
                <h5 className="text-xs uppercase font-bold text-[#4cd34c]">
                  Step 4: Live Test Extraction
                </h5>
                <span className="text-[10px] text-[var(--text-muted)]">Test with real runtime sample inputs</span>
              </div>

              <form onSubmit={handleRunTest} className="flex gap-2">
                <input
                  type="text"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  placeholder={`e.g. ${exampleInput || "MP260929.1942.T9876543"}`}
                  className="flex-1 rounded-xl border p-2 text-xs font-mono"
                  style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#4cd34c] text-black font-extrabold text-xs shadow hover:opacity-90 transition cursor-pointer"
                >
                  Test Extraction
                </button>
              </form>

              {testResults && (
                <div className="p-3 rounded-xl border bg-[var(--app-bg)] space-y-2 text-xs" style={{ borderColor: "var(--field-border)" }}>
                  <div className="font-bold flex justify-between text-[var(--app-text)]">
                    <span>Tested Input: <code className="text-[#4cd34c] font-mono">{testResults.inputTested}</code></span>
                    <span className={testResults.matchFound ? "text-[#4cd34c]" : "text-red-400"}>
                      {testResults.matchFound ? "✓ Match Found" : "❌ No Pattern Match"}
                    </span>
                  </div>

                  {testResults.results.map((res) => (
                    <div key={res.index} className="flex items-center justify-between border-t pt-1 font-mono text-[11px]" style={{ borderColor: "var(--field-border)" }}>
                      <span>Extraction #{res.index}: <strong className="text-[var(--app-text)]">{res.rawExtracted}</strong></span>
                      <span>➔</span>
                      <span>Transform: <strong className="text-[var(--app-text)]">{res.transformed}</strong></span>
                      <span>➔</span>
                      <span className="text-[#4cd34c] font-bold">Target: {`{${res.target_field}}`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 5: EXTRACTION SUMMARY CARD */}
          {validation.isValid && (
            <div className="p-3.5 rounded-2xl border bg-black/20 space-y-2 text-xs" style={{ borderColor: "var(--field-border)" }}>
              <h5 className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
                Extractable Field Summary
              </h5>
              <div className="text-xs font-mono text-[var(--app-text)] space-y-1">
                <div>Source Field: <strong className="text-[#4cd34c]">{`{${ph}}`}</strong></div>
                <div>Pattern: <code className="text-[#4cd34c] bg-black/30 px-1.5 py-0.5 rounded">{pattern}</code></div>
                {(extractionConfig.extractions || []).map((ext, idx) => (
                  <div key={idx} className="text-[11px] text-[var(--text-muted)] pl-2 border-l-2 border-[#4cd34c]">
                    Extraction {idx + 1}: <strong className="text-[var(--app-text)]">{ext.sample_val}</strong> ➔ Target: <strong className="text-[#4cd34c]">{`{${ext.target_field}}`}</strong> ({ext.transform_type === "none" ? "Raw" : ext.transform_type})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
