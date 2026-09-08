import { useState, useEffect } from "react";
import { getDateAutoValues, resolveConditionalMappings, formatDateTimeString, sanitizeAccountNumber } from "../services/api";
import { fetchExtractionRules, autoExtractFieldsFromText } from "../services/smartExtractorService";
import SentenceSnippetSelector from "../components/SentenceSnippetSelector";

export default function TechEscalation({
  activeScreen,
  currentAgent,
  techTemplates,
  selectedTechId,
  setSelectedTechId,
  favoriteIds,
  toggleFavorite,
  activeTemplate,
  placeholders,
  values,
  setValues,
  generatedMsg,
  copyText,
  privateNotesHook,
}) {
  const [showHiddenFields, setShowHiddenFields] = useState(false);
  const [extractionRules, setExtractionRules] = useState([]);

  useEffect(() => {
    fetchExtractionRules().then(setExtractionRules);
    const handleRulesUpdated = () => fetchExtractionRules().then(setExtractionRules);
    window.addEventListener("rea_extraction_rules_updated", handleRulesUpdated);
    return () => window.removeEventListener("rea_extraction_rules_updated", handleRulesUpdated);
  }, []);

  const handleFieldChange = (ph, newText, visiblePlaceholders, parsedCfgMap = {}) => {
    let textToSet = newText;
    if (ph === "account_number" || ph.toLowerCase().includes("account_number")) {
      textToSet = sanitizeAccountNumber(newText);
    }
    setValues((prev) => {
      const updated = { ...prev, [ph]: textToSet };
      if (textToSet && textToSet.trim().length >= 3) {
        const { updates: autoUpdates } = autoExtractFieldsFromText(
          textToSet,
          extractionRules,
          visiblePlaceholders,
          ph,
          parsedCfgMap
        );
        if (Object.keys(autoUpdates).length > 0) {
          return { ...updated, ...autoUpdates };
        }
      }
      return updated;
    });
  };

  const { createPrivateNote, trackPrivateNoteUsage, showToast } = privateNotesHook || {};
  if (activeScreen !== "tech_escalation" || !currentAgent) return null;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
      {/* Left Panel: Template & Inputs */}
      <div
        className="lg:col-span-7 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-5"
        style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--app-text)" }}>
              <img src="/Lightning.png" alt="Tech Escalation" className="h-6 w-6 shrink-0 object-contain" />
              Tech Escalation Builder
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Escalation requests targeted exclusively for Telegram resolution.
            </p>
          </div>
          <span className="text-xs uppercase font-bold text-[#4cd34c] bg-[#4cd34c]/10 border border-[#4cd34c]/30 px-3 py-1 rounded-full flex items-center gap-1.5">
            <img src="/telegram.png" alt="Telegram Logo" className="h-4 w-4 shrink-0 object-contain" />
            Telegram Exclusive
          </span>
        </div>

        {/* Template Select */}
        <div className="space-y-2">
          <label className="text-xs uppercase tracking-wider font-semibold opacity-75">Select Escalation Template</label>
          <select
            value={selectedTechId || ""}
            onChange={(e) => setSelectedTechId(Number(e.target.value))}
            className="w-full rounded-2xl border p-3 font-medium outline-none transition focus:ring-2 focus:ring-[#4cd34c]"
            style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
          >
            {(techTemplates || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic Inputs */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#4cd34c]">
              Fill Required Parameters
            </h3>
            {activeTemplate && (
              <button
                type="button"
                onClick={() => toggleFavorite(activeTemplate.id)}
                className="text-xs font-semibold flex items-center gap-1.5 transition hover:scale-105"
                style={{ color: (favoriteIds || []).includes(activeTemplate.id) ? "#facc15" : "var(--neutral-text)" }}
              >
                {(favoriteIds || []).includes(activeTemplate.id) ? "★ Favorite" : "☆ Add to Favorites"}
              </button>
            )}
          </div>

          {/* Dynamic Parameters */}
          {(() => {
            let parsedCfgMap = {};
            if (activeTemplate?.placeholder_config) {
              try {
                parsedCfgMap = typeof activeTemplate.placeholder_config === "string"
                  ? JSON.parse(activeTemplate.placeholder_config)
                  : activeTemplate.placeholder_config;
              } catch (e) {}
            }
            const { resolvedValues, mappedTargetKeys } = resolveConditionalMappings(placeholders, parsedCfgMap, values);
            const isAgentPh = (ph) => {
              if (!ph) return false;
              const clean = ph.trim().toLowerCase().replace(/\?$/, "");
              if (["agent_name", "agent_initials", "agent", "agent_fullname", "agent_name_or_initials"].includes(clean)) return true;
              const cfg = parsedCfgMap[ph] || parsedCfgMap[clean];
              if (cfg?.auto_fill_type && ["agent_name", "agent_initials", "agent_fullname", "agent"].includes(cfg.auto_fill_type)) return true;
              return false;
            };
            const visiblePlaceholders = (placeholders || []).filter((ph) => !ph.startsWith(":") && !mappedTargetKeys.has(ph) && !isAgentPh(ph));

            const hiddenByConfigCount = visiblePlaceholders.filter((ph) => {
              const cfg = parsedCfgMap[ph] || {};
              const mode = cfg.visibility_mode || "show";
              if (mode === "always_hidden") return true;
              if (mode === "hide_if_autofilled") {
                const currentVal = values[ph] ?? resolvedValues[ph];
                return Boolean(currentVal);
              }
              return false;
            }).length;

            return visiblePlaceholders.length > 0 ? (
              <div className="space-y-3">
                {hiddenByConfigCount > 0 && (
                  <div className="flex justify-end pb-1">
                    <button
                      type="button"
                      onClick={() => setShowHiddenFields((prev) => !prev)}
                      className="text-xs font-semibold text-[#4cd34c] bg-[#4cd34c]/10 border border-[#4cd34c]/30 px-3 py-1 rounded-full hover:bg-[#4cd34c]/20 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{showHiddenFields ? "👁️ Hide Auto-Filled Fields" : `🙈 ${hiddenByConfigCount} Field${hiddenByConfigCount > 1 ? "s" : ""} Hidden by Config`}</span>
                    </button>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {visiblePlaceholders.map((ph) => {
                    const dateAuto = getDateAutoValues();
                    const customCfg = parsedCfgMap[ph] || null;

                    const isAgentField = ph === "agent_name" || ph === "agent_initials" || ph === "agent";
                    const isDateField = dateAuto[ph] !== undefined || dateAuto[ph.toLowerCase()] !== undefined;
                    const isTimeUnitField = /^time_unit/i.test(ph);
                    const isReasonField = ph.toLowerCase().includes("reason") || ph.toLowerCase().includes("details") || ph.toLowerCase().includes("note") || ph.toLowerCase().includes("description");
                    const isDayField = ph === "day" || ph === "day_number" || ph === "day_num" || ph === "dd";
                    const isMonthNumberField = ph === "month_number" || ph === "month_num" || ph === "month" || ph === "mm";

                    let controlType = customCfg?.control_type || (
                      ph.endsWith("?") ? "combobox" :
                      isReasonField ? "textarea" :
                      isTimeUnitField ? "time_units_select" :
                      isDayField || isMonthNumberField ? "number" :
                      "text"
                    );

                    let autoVal = "";
                    if (customCfg?.auto_fill_type === "date_day") autoVal = dateAuto.day;
                    else if (customCfg?.auto_fill_type === "date_month") autoVal = dateAuto.month_number;
                    else if (customCfg?.auto_fill_type === "date_year") autoVal = dateAuto.year;
                    else if (customCfg?.auto_fill_type === "date_time") autoVal = dateAuto.time;
                    else if (customCfg?.auto_fill_type === "greeting" || customCfg?.auto_fill_type === "time_of_day") autoVal = dateAuto.greeting;
                    else if (customCfg?.auto_fill_type === "Greeting" || customCfg?.auto_fill_type === "greeting_cap") autoVal = dateAuto.Greeting;
                    else if (customCfg?.auto_fill_type === "good_greeting") autoVal = dateAuto.good_greeting;
                    else if (customCfg?.auto_fill_type === "agent_name") autoVal = currentAgent?.agent_name ?? "";
                    else if (customCfg?.auto_fill_type === "agent_fullname" || customCfg?.auto_fill_type === "agent") autoVal = (currentAgent?.agent || currentAgent?.agent_name) ?? "";
                    else if (customCfg?.auto_fill_type === "agent_initials") autoVal = currentAgent?.agent_initials ?? "";
                    else if (customCfg?.auto_fill_type === "custom") autoVal = customCfg.custom_default ?? "";
                    else if (isAgentField) autoVal = ph === "agent_initials" ? currentAgent?.agent_initials : (ph === "agent" ? (currentAgent?.agent || currentAgent?.agent_name) : currentAgent?.agent_name);
                    else if (isDateField) autoVal = dateAuto[ph] ?? dateAuto[ph.toLowerCase()];
                    else if (isTimeUnitField) autoVal = "hour(s)";

                    const visMode = customCfg?.visibility_mode || "show";
                    const hasVal = values[ph] !== undefined ? Boolean(values[ph]) : Boolean(autoVal);

                    if (!showHiddenFields) {
                      if (visMode === "always_hidden") return null;
                      if (visMode === "hide_if_autofilled" && hasVal) return null;
                    }

                    let options = Array.isArray(customCfg?.options) ? customCfg.options : [];
                  if (options.length === 0 && ph.endsWith("?")) {
                    options = ["Elephant", "Rhino", "Lion", "Buffalo", "Leopard"];
                  }

                  const isTrigger = ph.endsWith("?") || (Boolean(customCfg?.mapped_target) && customCfg.mapped_target.trim() !== "");
                  const targetKey = isTrigger ? (customCfg?.mapped_target || `:${ph.replace(/\?$/, "")}`) : null;
                  const autoMappedVal = targetKey ? resolvedValues[targetKey] : null;

                  return (
                    <div key={ph} className={controlType === "textarea" ? "col-span-full md:col-span-2" : ""}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs capitalize font-medium flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                          {ph.replace("_", " ")}:
                        </span>
                        <div className="flex items-center gap-1.5">
                          {(isReasonField || controlType === "textarea" || (values[ph] && values[ph].length >= 4)) && (
                            <button
                              type="button"
                              onClick={() => {
                                const val = values[ph] ?? autoVal;
                                const { updates: autoUpdates, extractedList } = autoExtractFieldsFromText(val, extractionRules, visiblePlaceholders, ph, parsedCfgMap);
                                if (Object.keys(autoUpdates).length > 0) {
                                  setValues((s) => ({ ...s, ...autoUpdates }));
                                  if (showToast) {
                                    const names = extractedList.map((e) => `${e.label} ("${e.value}")`).join(", ");
                                    showToast(`⚡ Auto-extracted fields: ${names}`, "success");
                                  }
                                } else if (showToast) {
                                  showToast("No extractable pattern (e.g. MP..., INN..., ACC..., 07..., $...) found in text.", "info");
                                }
                              }}
                              className="text-[10px] text-[#4cd34c] font-bold bg-[#4cd34c]/10 border border-[#4cd34c]/30 px-2 py-0.5 rounded-md hover:bg-[#4cd34c] hover:text-black transition cursor-pointer"
                              title="Auto-extract values for other placeholders from this field's text"
                            >
                              ⚡ Auto-Extract Fields
                            </button>
                          )}
                          {targetKey && autoMappedVal ? (
                            <span className="text-[10px] text-[#4cd34c] font-extrabold bg-[#4cd34c]/15 px-2 py-0.5 rounded-full border border-[#4cd34c]/30">
                              ⚡ Auto-maps {targetKey} ➔ "{autoMappedVal}"
                            </span>
                          ) : customCfg ? (
                            <span className="text-[10px] text-[#4cd34c] font-semibold">Configured: {controlType}</span>
                          ) : isAgentField ? (
                            <span className="text-[10px] text-[#4cd34c] font-semibold">Auto-filled from profile</span>
                          ) : isDayField || isMonthNumberField ? (
                            <span className="text-[10px] text-[#4cd34c] font-semibold">Numeric up/down (Auto-filled)</span>
                          ) : isDateField ? (
                            <span className="text-[10px] text-[#4cd34c] font-semibold">Auto-filled from date</span>
                          ) : isTimeUnitField ? (
                            <span className="text-[10px] text-[#4cd34c] font-semibold">Preset dropdown</span>
                          ) : isReasonField ? (
                            <span className="text-[10px] text-[#4cd34c] font-semibold">Multi-line resizable text</span>
                          ) : null}
                        </div>
                      </div>

                    {controlType === "combobox" ? (
                      <select
                        value={values[ph] ?? (options[0] || autoVal)}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        className="w-full rounded-xl border p-2.5 text-sm font-medium"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      >
                        {options.length > 0 ? (
                          options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))
                        ) : (
                          <option value={autoVal || "Default"}>{autoVal || "Default"}</option>
                        )}
                      </select>
                    ) : controlType === "number" ? (
                      (isMonthNumberField || isDayField || customCfg?.auto_fill_type === "month_number" || customCfg?.auto_fill_type === "day_number" || ["month_number", "month_num", "month", "mm", "day_number", "day_num", "day", "dd"].includes(ph.toLowerCase())) ? (
                        <div className="flex items-center rounded-xl border overflow-hidden" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                          <input
                            type="text"
                            maxLength={2}
                            value={
                              values[ph] !== undefined
                                ? (values[ph] ? String(parseInt(values[ph], 10) || 1).padStart(2, "0") : "")
                                : (autoVal ? String(parseInt(autoVal, 10) || 1).padStart(2, "0") : "01")
                            }
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "");
                              if (!digits) {
                                setValues((s) => ({ ...s, [ph]: "" }));
                                return;
                              }
                              let n = parseInt(digits, 10);
                              const maxVal = (isMonthNumberField || customCfg?.auto_fill_type === "month_number" || ["month_number", "month_num", "month", "mm"].includes(ph.toLowerCase())) ? 12 : 31;
                              if (n > maxVal) n = maxVal;
                              setValues((s) => ({ ...s, [ph]: String(n).padStart(2, "0") }));
                            }}
                            placeholder="01"
                            className="w-full p-2.5 text-sm font-bold font-mono tracking-wider text-center bg-transparent focus:outline-none"
                            style={{ color: "var(--app-text)" }}
                          />
                          <div className="flex flex-col border-l" style={{ borderColor: "var(--field-border)" }}>
                            <button
                              type="button"
                              onClick={() => {
                                const maxVal = (isMonthNumberField || customCfg?.auto_fill_type === "month_number" || ["month_number", "month_num", "month", "mm"].includes(ph.toLowerCase())) ? 12 : 31;
                                const current = parseInt(values[ph] ?? autoVal ?? "1", 10) || 1;
                                let next = current + 1;
                                if (next > maxVal) next = 1;
                                setValues((s) => ({ ...s, [ph]: String(next).padStart(2, "0") }));
                              }}
                              className="px-2.5 py-1 text-[10px] font-black hover:bg-[#4cd34c]/20 transition select-none"
                              style={{ color: "var(--app-text)" }}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const maxVal = (isMonthNumberField || customCfg?.auto_fill_type === "month_number" || ["month_number", "month_num", "month", "mm"].includes(ph.toLowerCase())) ? 12 : 31;
                                const current = parseInt(values[ph] ?? autoVal ?? "1", 10) || 1;
                                let next = current - 1;
                                if (next < 1) next = maxVal;
                                setValues((s) => ({ ...s, [ph]: String(next).padStart(2, "0") }));
                              }}
                              className="px-2.5 py-1 text-[10px] font-black hover:bg-[#4cd34c]/20 transition border-t select-none"
                              style={{ borderColor: "var(--field-border)", color: "var(--app-text)" }}
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      ) : (
                        <input
                          type="number"
                          min={1}
                          max={999999}
                          value={values[ph] ?? autoVal}
                          onChange={(e) => handleFieldChange(ph, e.target.value, visiblePlaceholders, parsedCfgMap)}
                          placeholder={autoVal ? `Auto: ${autoVal}` : `Enter ${ph.replace("_", " ")}`}
                          className="w-full rounded-xl border p-2.5 text-sm font-semibold"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                      )
                    ) : controlType === "date" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw) {
                              const [y, m, d] = raw.split("-");
                              handleFieldChange(ph, `${d}/${m}/${y}`, visiblePlaceholders, parsedCfgMap);
                            }
                          }}
                          className="rounded-xl border p-2 text-sm font-medium shrink-0 cursor-pointer"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                        <input
                          type="text"
                          value={formatDateTimeString(values[ph] ?? autoVal, "date", customCfg?.date_format)}
                          onChange={(e) => handleFieldChange(ph, e.target.value, visiblePlaceholders, parsedCfgMap)}
                          placeholder={customCfg?.date_format || "DD/MM/YYYY"}
                          className="w-full rounded-xl border p-2.5 text-sm font-semibold font-mono tracking-wider"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                      </div>
                    ) : controlType === "time" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          onChange={(e) => {
                            const clean = (e.target.value || "").replace(/:/g, "");
                            handleFieldChange(ph, clean, visiblePlaceholders, parsedCfgMap);
                          }}
                          className="rounded-xl border p-2 text-sm font-medium shrink-0 cursor-pointer"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                        <input
                          type="text"
                          maxLength={4}
                          value={(values[ph] ?? autoVal ?? "").toString().replace(/:/g, "")}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/:/g, "").replace(/\D/g, "").slice(0, 4);
                            handleFieldChange(ph, clean, visiblePlaceholders, parsedCfgMap);
                          }}
                          placeholder="HHMM (e.g. 0945)"
                          className="w-full rounded-xl border p-2.5 text-sm font-semibold font-mono tracking-wider"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                      </div>
                    ) : controlType === "datetime" ? (
                      <input
                        type="datetime-local"
                        value={values[ph] ?? autoVal}
                        onChange={(e) => handleFieldChange(ph, e.target.value, visiblePlaceholders, parsedCfgMap)}
                        className="w-full rounded-xl border p-2.5 text-sm font-medium"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      />
                    ) : controlType === "time_units_select" ? (
                      <select
                        value={values[ph] ?? "hour(s)"}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        className="w-full rounded-xl border p-2.5 text-sm font-medium"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      >
                        <option value="minute(s)">minute(s)</option>
                        <option value="hour(s)">hour(s)</option>
                        <option value="day(s)">day(s)</option>
                        <option value="week(s)">week(s)</option>
                      </select>
                    ) : controlType === "textarea" ? (
                      <textarea
                        rows={3}
                        value={values[ph] ?? autoVal}
                        onChange={(e) => handleFieldChange(ph, e.target.value, visiblePlaceholders, parsedCfgMap)}
                        placeholder={autoVal ? `Auto: ${autoVal}` : `Enter ${ph.replace("_", " ")}...`}
                        className="w-full rounded-xl border p-2.5 text-sm resize-y font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      />
                    ) : (
                      <input
                        value={values[ph] ?? autoVal}
                        onChange={(e) => handleFieldChange(ph, e.target.value, visiblePlaceholders, parsedCfgMap)}
                        placeholder={autoVal ? `Auto: ${autoVal}` : `Enter ${ph.replace("_", " ")}...`}
                        className="w-full rounded-xl border p-2.5 text-sm"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      />
                    )}
                  </div>
                );
              })}
                </div>
              </div>
          ) : (
            <div className="p-4 text-center rounded-xl border text-xs italic" style={{ borderColor: "var(--field-border)", color: "var(--text-muted)" }}>
              No parameters required for this escalation template.
            </div>
          );
        })()}
        </div>
      </div>

      {/* Right Panel: Output & Instant Copy */}
      <div
        className="lg:col-span-5 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur flex flex-col justify-between min-w-0"
        style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
      >
        <div className="space-y-4 min-w-0">
          <h2 className="text-xl font-bold" style={{ color: "var(--app-text)" }}>
            Telegram Escalation Preview
          </h2>

          <SentenceSnippetSelector
            generatedMsg={generatedMsg}
            activeTemplate={activeTemplate}
            copyText={copyText}
            trackPrivateNoteUsage={trackPrivateNoteUsage}
            createPrivateNote={createPrivateNote}
            showToast={showToast}
          />

          <p className="text-xs italic mt-2" style={{ color: "var(--text-muted)" }}>
            💡 Tech Escalation messages automatically end with signature <code className="text-[#4cd34c]">#{currentAgent?.agent_name || ""}</code>.
          </p>
        </div>

        <div className="space-y-2 mt-4">

          <button
            type="button"
            onClick={() => setValues({})}
            className="w-full rounded-xl border py-2 text-sm font-medium transition hover:opacity-90"
            style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
          >
            Clear Input Parameters
          </button>
        </div>
      </div>
    </section>
  );
}
