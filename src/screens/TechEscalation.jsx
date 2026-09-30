import { useState } from "react";
import { getDateAutoValues, resolveConditionalMappings, formatDateTimeString, sanitizeAccountNumber, toHTMLDateValue, toHTMLTimeValue } from "../services/api";
import { processExtractableFields } from "../services/extractableFieldService";
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

  const handleFieldChange = (ph, newText) => {
    let textToSet = newText;
    if (ph === "account_number" || ph.toLowerCase().includes("account_number")) {
      textToSet = sanitizeAccountNumber(newText);
    }

    let parsedCfgMap = {};
    if (activeTemplate?.placeholder_config) {
      try {
        parsedCfgMap = typeof activeTemplate.placeholder_config === "string"
          ? JSON.parse(activeTemplate.placeholder_config)
          : activeTemplate.placeholder_config;
      } catch (e) {}
    }

    const updates = processExtractableFields(ph, textToSet, parsedCfgMap);

    setValues((prev) => ({
      ...prev,
      [ph]: textToSet,
      ...updates,
    }));
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: "var(--app-text)" }}>
              <img src="/Lightning.png" alt="Tech Escalation" className="h-6 w-6 shrink-0 object-contain" />
              Tech Escalation Builder
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Escalation requests targeted exclusively for Telegram resolution.
            </p>
          </div>
          <span className="text-xs uppercase font-bold text-[#4cd34c] bg-[#4cd34c]/10 border border-[#4cd34c]/30 px-3 py-1 rounded-full flex items-center gap-1.5 shrink-0 w-fit">
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
            const { resolvedValues, mappedTargetKeys, dynamicOptionsMap, silencedTargetKeys } = resolveConditionalMappings(placeholders, parsedCfgMap, values);
            const isAgentPh = (ph) => {
              if (!ph) return false;
              const clean = ph.trim().toLowerCase().replace(/\?$/, "");
              if (["agent_name", "agent_initials", "agent", "agent_fullname", "agent_name_or_initials"].includes(clean)) return true;
              const cfg = parsedCfgMap[ph] || parsedCfgMap[clean];
              if (cfg?.auto_fill_type && ["agent_name", "agent_initials", "agent_fullname", "agent"].includes(cfg.auto_fill_type)) return true;
              return false;
            };
            const combinedPlaceholdersSet = new Set(placeholders || []);
            if (parsedCfgMap && typeof parsedCfgMap === "object") {
              Object.keys(parsedCfgMap).forEach((k) => {
                if (parsedCfgMap[k]?.is_silent || parsedCfgMap[k]?.is_extractable) {
                  combinedPlaceholdersSet.add(k);
                }
              });
            }
            const allPlaceholdersList = Array.from(combinedPlaceholdersSet);
            const visiblePlaceholders = allPlaceholdersList.filter((ph) => {
              if (isAgentPh(ph)) return false;
              const cleanKey = ph.startsWith(":") ? ph.slice(1) : ph;
              const colonKey = ph.startsWith(":") ? ph : `:${ph}`;
              const isMappedTarget = mappedTargetKeys.has(ph) || mappedTargetKeys.has(cleanKey) || mappedTargetKeys.has(colonKey) || ph.startsWith(":");

              if (isMappedTarget) {
                const hasDynamicOpts = (dynamicOptionsMap[ph] && dynamicOptionsMap[ph].length > 0) ||
                                       (dynamicOptionsMap[cleanKey] && dynamicOptionsMap[cleanKey].length > 0) ||
                                       (dynamicOptionsMap[colonKey] && dynamicOptionsMap[colonKey].length > 0);
                return Boolean(hasDynamicOpts);
              }
              return true;
            });

            const getAutoVal = (ph, customCfg) => {
              const dateAuto = getDateAutoValues();
              const isAgentField = ph === "agent_name" || ph === "agent_initials" || ph === "agent";
              const isDateField = dateAuto[ph] !== undefined || dateAuto[ph.toLowerCase()] !== undefined;
              const isTimeUnitField = /^time_unit/i.test(ph);

              if (customCfg?.auto_fill_type === "date_day") return dateAuto.day;
              if (customCfg?.auto_fill_type === "date_month") return dateAuto.month_number;
              if (customCfg?.auto_fill_type === "date_year") return dateAuto.year;
              if (customCfg?.auto_fill_type === "date_time") return dateAuto.time;
              if (customCfg?.auto_fill_type === "greeting" || customCfg?.auto_fill_type === "time_of_day") return dateAuto.greeting;
              if (customCfg?.auto_fill_type === "Greeting" || customCfg?.auto_fill_type === "greeting_cap") return dateAuto.Greeting;
              if (customCfg?.auto_fill_type === "good_greeting") return dateAuto.good_greeting;
              if (customCfg?.auto_fill_type === "agent_name") return currentAgent?.agent_name ?? "";
              if (customCfg?.auto_fill_type === "agent_fullname" || customCfg?.auto_fill_type === "agent") return (currentAgent?.agent || currentAgent?.agent_name) ?? "";
              if (customCfg?.auto_fill_type === "agent_initials") return currentAgent?.agent_initials ?? "";
              if (customCfg?.auto_fill_type === "custom") return customCfg.custom_default ?? "";
              if (customCfg?.auto_fill_type === "formatted_date") return "";
              if (isAgentField) return ph === "agent_initials" ? currentAgent?.agent_initials : (ph === "agent" ? (currentAgent?.agent || currentAgent?.agent_name) : currentAgent?.agent_name);
              if (isDateField) return dateAuto[ph] ?? dateAuto[ph.toLowerCase()];
              if (isTimeUnitField) return "hour(s)";
              return "";
            };

            const hiddenByConfigCount = visiblePlaceholders.filter((ph) => {
              const cfg = parsedCfgMap[ph] || {};
              const mode = cfg.visibility_mode || "show";
              if (mode === "always_hidden") return true;
              if (mode === "hide_if_autofilled") {
                const autoVal = getAutoVal(ph, cfg);
                const val = (values[ph] !== undefined && values[ph] !== null)
                  ? values[ph]
                  : (resolvedValues[ph] !== undefined && resolvedValues[ph] !== null && String(resolvedValues[ph]).trim() !== ""
                      ? resolvedValues[ph]
                      : autoVal);
                return Boolean(String(val).trim());
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
                    const customCfg = parsedCfgMap[ph] || null;
                    const isReasonField = ph.toLowerCase().includes("reason") || ph.toLowerCase().includes("details") || ph.toLowerCase().includes("note") || ph.toLowerCase().includes("description");
                    const isTimeUnitField = /^time_unit/i.test(ph);
                    const isDayField = ph === "day" || ph === "day_number" || ph === "day_num" || ph === "dd";
                    const isMonthNumberField = ph === "month_number" || ph === "month_num" || ph === "month" || ph === "mm";

                    const cleanKey = ph.startsWith(":") ? ph.slice(1) : ph;
                    const colonKey = ph.startsWith(":") ? ph : `:${ph}`;
                    const dynamicOpts = dynamicOptionsMap[ph] || dynamicOptionsMap[cleanKey] || dynamicOptionsMap[colonKey];

                    let controlType = dynamicOpts ? "combobox" : customCfg?.control_type || (
                      ph.endsWith("?") ? "combobox" :
                      isReasonField ? "textarea" :
                      isTimeUnitField ? "time_units_select" :
                      isDayField || isMonthNumberField ? "number" :
                      "text"
                    );

                    const autoVal = getAutoVal(ph, customCfg);
                    const visMode = customCfg?.visibility_mode || "show";
                    const effectiveVal = (values[ph] !== undefined && values[ph] !== null)
                      ? values[ph]
                      : (resolvedValues[ph] !== undefined && resolvedValues[ph] !== null && String(resolvedValues[ph]).trim() !== ""
                          ? resolvedValues[ph]
                          : autoVal);
                    const hasVal = Boolean(String(effectiveVal).trim());

                    if (!showHiddenFields) {
                      if (visMode === "always_hidden") return null;
                      if (visMode === "hide_if_autofilled" && hasVal) return null;
                    }

                    let options = dynamicOpts || (Array.isArray(customCfg?.options) ? customCfg.options : []);
                    if (options.length === 0 && ph.endsWith("?")) {
                      options = ["Elephant", "Rhino", "Lion", "Buffalo", "Leopard"];
                    }

                    return (
                      <div key={ph} className={controlType === "textarea" ? "col-span-full md:col-span-2" : ""}>
                        <div className="mb-1">
                          <span className="text-xs capitalize font-medium flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
                            {ph.replace("_", " ")}:
                          </span>
                        </div>

                    {controlType === "combobox" ? (
                      <select
                        value={effectiveVal || (options[0] || autoVal)}
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
                              effectiveVal
                                ? String(parseInt(effectiveVal, 10) || 1).padStart(2, "0")
                                : ""
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
                                const current = parseInt(effectiveVal || "1", 10) || 1;
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
                                const current = parseInt(effectiveVal || "1", 10) || 1;
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
                          value={effectiveVal}
                          onChange={(e) => handleFieldChange(ph, e.target.value)}
                          placeholder={autoVal ? `Auto: ${autoVal}` : `Enter ${ph.replace("_", " ")}`}
                          className="w-full rounded-xl border p-2.5 text-sm font-semibold"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                      )
                    ) : controlType === "date" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="date"
                          value={toHTMLDateValue(effectiveVal)}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw) {
                              const [y, m, d] = raw.split("-");
                              handleFieldChange(ph, `${d}/${m}/${y}`);
                            }
                          }}
                          className="rounded-xl border p-2 text-sm font-medium shrink-0 cursor-pointer"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                        <input
                          type="text"
                          value={effectiveVal ? formatDateTimeString(effectiveVal, "date", customCfg?.date_format) : ""}
                          onChange={(e) => handleFieldChange(ph, e.target.value)}
                          placeholder={customCfg?.date_format || "DD/MM/YYYY"}
                          className="w-full rounded-xl border p-2.5 text-sm font-semibold font-mono tracking-wider"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                      </div>
                    ) : controlType === "time" ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={toHTMLTimeValue(effectiveVal)}
                          onChange={(e) => {
                            const clean = (e.target.value || "").replace(/:/g, "");
                            handleFieldChange(ph, clean);
                          }}
                          className="rounded-xl border p-2 text-sm font-medium shrink-0 cursor-pointer"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                        <input
                          type="text"
                          maxLength={4}
                          value={(effectiveVal ?? "").toString().replace(/:/g, "")}
                          onChange={(e) => {
                            const clean = e.target.value.replace(/:/g, "").replace(/\D/g, "").slice(0, 4);
                            handleFieldChange(ph, clean);
                          }}
                          placeholder="HHMM (e.g. 0945)"
                          className="w-full rounded-xl border p-2.5 text-sm font-semibold font-mono tracking-wider"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                      </div>
                    ) : controlType === "datetime" ? (
                      <input
                        type="datetime-local"
                        value={effectiveVal}
                        onChange={(e) => handleFieldChange(ph, e.target.value)}
                        className="w-full rounded-xl border p-2.5 text-sm font-medium"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      />
                    ) : controlType === "time_units_select" ? (
                      <select
                        value={effectiveVal || "hour(s)"}
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
                        value={effectiveVal}
                        onChange={(e) => handleFieldChange(ph, e.target.value)}
                        placeholder={autoVal ? `Auto: ${autoVal}` : `Enter ${ph.replace("_", " ")}...`}
                        className="w-full rounded-xl border p-2.5 text-sm resize-y font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      />
                    ) : (
                      <input
                        value={
                          customCfg?.auto_fill_type === "formatted_date"
                            ? formatDateTimeString(effectiveVal, "date", customCfg?.date_format)
                            : effectiveVal
                        }
                        onChange={(e) => handleFieldChange(ph, e.target.value)}
                        placeholder={customCfg?.auto_fill_type === "formatted_date" ? (customCfg?.date_format || "DD/MM/YYYY") : (autoVal ? `Auto: ${autoVal}` : `Enter ${ph.replace("_", " ")}...`)}
                        className="w-full rounded-xl border p-2.5 text-sm font-mono"
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
