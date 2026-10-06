import { useState, useEffect, useRef } from "react";
import { getDateAutoValues, resolveConditionalMappings, formatDateTimeString, sanitizeAccountNumber, toHTMLDateValue, toHTMLTimeValue } from "../services/api";
import { processExtractableFields } from "../services/extractableFieldService";
import { translateText } from "../services/translationService";
import SentenceSnippetSelector from "../components/SentenceSnippetSelector";

export default function CustomerReply({
  activeScreen,
  currentAgent,
  replyChannel,
  setReplyChannel,
  searchQuery,
  setSearchQuery,
  customerCategories,
  selectedCategory,
  setSelectedCategory,
  customerSubcategories,
  selectedSubcategory,
  setSelectedSubcategory,
  filteredCustomerTemplates,
  setSelectedCustId,
  activeTemplate,
  favoriteIds,
  toggleFavorite,
  placeholders,
  values,
  setValues,
  generatedMsg,
  generateMessage,
  copyText,
  privateNotesHook,
}) {
  const [translatedText, setTranslatedText] = useState("");
  const [translatedLangLabel, setTranslatedLangLabel] = useState("Shona");
  const [isTranslating, setIsTranslating] = useState(false);
  const [viewMode, setViewMode] = useState("english"); // 'english' | 'translated'
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

  const prevTemplateIdRef = useRef(activeTemplate?.id);

  // Automatically reset view mode to English preview whenever a new template is selected
  useEffect(() => {
    if (activeTemplate?.id !== prevTemplateIdRef.current) {
      prevTemplateIdRef.current = activeTemplate?.id;
      setViewMode("english");
      setTranslatedText("");
    }
  }, [activeTemplate?.id]);

  const handleInlineTranslate = async (targetLang = "sn") => {
    if (!generatedMsg) return;
    setIsTranslating(true);
    try {
      const res = await translateText(generatedMsg, "en", targetLang);
      setTranslatedText(res.translatedText);
      setTranslatedLangLabel(targetLang === "nd" ? "IsiNdebele" : "Shona");
      setViewMode("translated");
    } catch (e) {
      console.error(e);
    } finally {
      setIsTranslating(false);
    }
  };

  const { createPrivateNote, trackPrivateNoteUsage, showToast } = privateNotesHook || {};

  const categoriesList = customerCategories || [];
  const subcategoriesList = customerSubcategories || [];
  const templatesList = filteredCustomerTemplates || [];
  const placeholderList = placeholders || [];
  const favIds = favoriteIds || [];
  const valMap = values || {};

  if (activeScreen !== "customer_reply" || !currentAgent) return null;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
      {/* Left Panel: Hierarchical Category Browser & Inputs */}
      <div
        className="lg:col-span-7 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-5"
        style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
      >
        <div>
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2" style={{ color: "var(--app-text)" }}>
            <img src="/chat.png" alt="Customer Reply" className="h-6 w-6 shrink-0 object-contain" />
            Customer Reply Center
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Browse categorized response templates for Signed and Unsigned customer replies.
          </p>
        </div>



        {/* SEARCH & CATEGORY BROWSER */}
        <div className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--field-border)" }}>
          {/* Search Bar */}
          <div className="relative flex items-center">
            <img src="/search.png" alt="Search" className="absolute left-3 h-4 w-4 shrink-0 object-contain pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer reply templates..."
              className="w-full rounded-xl border p-2.5 text-sm pl-9 placeholder:text-[var(--field-placeholder)]"
              style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
            />
          </div>

          {/* Level 1: Category Pills (Always Alphabetical) */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
              Primary Category:
            </label>
            <div className="flex flex-wrap gap-2">
              {(["All", ...categoriesList.filter((c) => c !== "All").sort((a, b) => a.localeCompare(b))]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSelectedSubcategory("All");
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    selectedCategory === cat
                      ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] border-[#4cd34c] shadow-sm"
                      : "hover:bg-[var(--neutral-bg)] text-[var(--neutral-text)]"
                  }`}
                  style={{ borderColor: selectedCategory === cat ? "#4cd34c" : "var(--badge-border)" }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Level 2: Subcategory Chips (Collapsible - Hover to Reveal All Options) */}
          {subcategoriesList.length > 1 ? (
            <div className="group space-y-1 rounded-2xl border p-2.5 transition-all duration-300" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider block" style={{ color: "var(--text-muted)" }}>
                  Subcategory ({subcategoriesList.length}):
                </label>
                <span className="text-[10px] text-[#4cd34c] font-semibold transition-opacity duration-200 opacity-70 group-hover:opacity-100 flex items-center gap-1">
                  <span>Hover to reveal options</span>
                  <span className="transition-transform duration-300 group-hover:rotate-180">▾</span>
                </span>
              </div>
              <div className="relative overflow-hidden transition-all duration-300 max-h-[2.8rem] group-hover:max-h-[24rem]">
                <div className="flex flex-wrap gap-1.5 pb-1 pt-0.5">
                  {subcategoriesList.map((subcat) => (
                    <button
                      key={subcat}
                      type="button"
                      onClick={() => setSelectedSubcategory(subcat)}
                      className={`rounded-xl border px-2.5 py-1 text-[11px] transition ${
                        selectedSubcategory === subcat
                          ? "border-[#4cd34c] bg-[#4cd34c]/20 text-[#4cd34c] font-bold"
                          : "hover:bg-[var(--neutral-bg)] text-[var(--text-muted)]"
                      }`}
                      style={{ borderColor: selectedSubcategory === subcat ? "#4cd34c" : "var(--field-border)" }}
                    >
                      {subcat}
                    </button>
                  ))}
                </div>
                {/* Visual fade hint at bottom when collapsed */}
                <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-[var(--field-bg)] to-transparent pointer-events-none transition-opacity duration-200 group-hover:opacity-0" />
              </div>
            </div>
          ) : null}

          {/* Categorized Template List Cards */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
              Select Response Template ({templatesList.length}):
            </label>
            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {templatesList.length === 0 ? (
                <div className="text-xs italic p-3 rounded-xl border" style={{ borderColor: "var(--field-border)", color: "var(--text-muted)" }}>
                  No templates found matching your category filter.
                </div>
              ) : (
                templatesList.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      setSelectedCustId(t.id);
                      setValues({});
                      setViewMode("english");
                      setTranslatedText("");
                      const msgToCopy = generateMessage ? generateMessage({}, t) : (t.body || "");
                      if (msgToCopy && copyText) {
                        copyText(msgToCopy, "Customer reply copied to clipboard! 📋", t.id);
                      }
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                      String(t.id) === String(activeTemplate?.id)
                        ? "border-[#4cd34c] ring-1 ring-[#4cd34c]/30 bg-[#4cd34c]/5"
                        : "hover:border-[#4cd34c]/50"
                    }`}
                    style={{ borderColor: String(t.id) === String(activeTemplate?.id) ? "#4cd34c" : "var(--field-border)", backgroundColor: "var(--field-bg)" }}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="font-semibold text-sm truncate">{t.name}</div>
                      <div className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
                        {t.body}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-[10px] rounded-full border px-2 py-0.5" style={{ borderColor: "var(--badge-border)", color: "var(--badge-text)" }}>
                        {t.category ?? "General"}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(t.id);
                        }}
                        className="p-1 text-sm hover:scale-125 transition"
                        title={favIds.includes(t.id) ? "Remove from Favorites" : "Add to Favorites"}
                      >
                        {favIds.includes(t.id) ? "⭐" : "☆"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Dynamic Parameters for Customer Reply */}
          {(() => {
            let parsedCfgMap = {};
            if (activeTemplate?.placeholder_config) {
              try {
                parsedCfgMap = typeof activeTemplate.placeholder_config === "string"
                  ? JSON.parse(activeTemplate.placeholder_config)
                  : activeTemplate.placeholder_config;
              } catch (e) {}
            }
            const { resolvedValues, mappedTargetKeys, dynamicOptionsMap, silencedTargetKeys } = resolveConditionalMappings(placeholderList, parsedCfgMap, values);
            const isAgentPh = (ph) => {
              if (!ph) return false;
              const clean = ph.trim().toLowerCase().replace(/\?$/, "");
              if (["agent_name", "agent_initials", "agent", "agent_fullname", "agent_name_or_initials"].includes(clean)) return true;
              const cfg = parsedCfgMap[ph] || parsedCfgMap[clean];
              if (cfg?.auto_fill_type && ["agent_name", "agent_initials", "agent_fullname", "agent"].includes(cfg.auto_fill_type)) return true;
              return false;
            };
            const combinedPlaceholdersSet = new Set(placeholderList || []);
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
              const cleanKey = ph.replace(/^:/, "");
              const colonKey = ":" + cleanKey;

              const isSilenced =
                silencedTargetKeys.has(ph) ||
                silencedTargetKeys.has(cleanKey) ||
                silencedTargetKeys.has(colonKey);

              if (isSilenced) return false;

              const isMappedTarget =
                mappedTargetKeys.has(ph) ||
                mappedTargetKeys.has(cleanKey) ||
                mappedTargetKeys.has(colonKey) ||
                ph.startsWith(":");

              if (isMappedTarget) {
                const hasDynamicOpts =
                  (dynamicOptionsMap[ph] && dynamicOptionsMap[ph].length > 0) ||
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
              <div className="pt-3 border-t space-y-3" style={{ borderColor: "var(--field-border)" }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                    Response Parameters:
                  </h3>
                  {hiddenByConfigCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowHiddenFields((prev) => !prev)}
                      className="text-xs font-semibold text-[#4cd34c] bg-[#4cd34c]/10 border border-[#4cd34c]/30 px-3 py-1 rounded-full hover:bg-[#4cd34c]/20 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{showHiddenFields ? "👁️ Hide Auto-Filled Fields" : `🙈 ${hiddenByConfigCount} Field${hiddenByConfigCount > 1 ? "s" : ""} Hidden by Config`}</span>
                    </button>
                  )}
                </div>
                <div className="space-y-3">
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
                      <div key={ph}>
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
                            placeholder={`Enter ${ph.replace("_", " ")}`}
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
                          <option value="hour(s)">hour(s)</option>
                          <option value="minutes">minutes</option>
                        </select>
                      ) : controlType === "textarea" ? (
                        <textarea
                          rows={3}
                          value={effectiveVal}
                          onChange={(e) => handleFieldChange(ph, e.target.value)}
                          placeholder={`Enter ${ph.replace("_", " ")}...`}
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
                          placeholder={customCfg?.auto_fill_type === "formatted_date" ? (customCfg?.date_format || "DD/MM/YYYY") : `Enter ${ph.replace("_", " ")}`}
                          className="w-full rounded-xl border p-2.5 text-sm placeholder:text-[var(--field-placeholder)] font-mono"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null;
        })()}
        </div>
      </div>

      {/* Right Panel: Live Message Preview */}
      <div
        className="lg:col-span-5 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur flex flex-col justify-between min-w-0"
        style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
      >
        <div className="space-y-4 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold" style={{ color: "var(--app-text)" }}>
              Customer Reply Preview
            </h2>
            <div className="flex items-center gap-2">
              {translatedText && (
                <div className="flex items-center rounded-xl border p-1 text-xs" style={{ borderColor: "var(--badge-border)" }}>
                  <button
                    type="button"
                    onClick={() => setViewMode("english")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${viewMode === "english" ? "bg-[#4cd34c] text-[#071007]" : "opacity-70"}`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("translated")}
                    className={`px-2.5 py-1 rounded-lg font-bold transition ${viewMode === "translated" ? "bg-[#4cd34c] text-[#071007]" : "opacity-70"}`}
                  >
                    {translatedLangLabel === "IsiNdebele" ? "ND" : "SN"}
                  </button>
                </div>
              )}
              <span className="text-xs uppercase font-bold text-[#4cd34c] bg-[#4cd34c]/10 border border-[#4cd34c]/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                {replyChannel === "signed" ? (
                  <>
                    <img src="/signed.png" alt="Signed" className="h-3.5 w-3.5 object-contain" />
                    Signed
                  </>
                ) : (
                  <>
                    <img src="/unsigned.png" alt="Unsigned" className="h-3.5 w-3.5 object-contain" />
                    Unsigned
                  </>
                )}
              </span>
            </div>
          </div>

          <SentenceSnippetSelector
            generatedMsg={viewMode === "translated" && translatedText ? translatedText : generatedMsg}
            activeTemplate={activeTemplate}
            copyText={copyText}
            trackPrivateNoteUsage={trackPrivateNoteUsage}
            createPrivateNote={createPrivateNote}
            showToast={showToast}
            replyChannel={replyChannel}
            setReplyChannel={setReplyChannel}
            currentAgent={currentAgent}
          />

          {replyChannel === "signed" ? (
            <p className="text-xs italic mt-2" style={{ color: "var(--text-muted)" }}>
              💡 Signed format automatically appends agent initials signature <code className="text-[#4cd34c]">^{currentAgent?.agent_initials || ""}</code>.
            </p>
          ) : (
            <p className="text-xs italic mt-2" style={{ color: "var(--text-muted)" }}>
              💡 Unsigned format presents clean customer-facing response text without trailing signature.
            </p>
          )}
        </div>

        <div className="space-y-2 mt-4">

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleInlineTranslate("sn")}
              disabled={!generatedMsg || isTranslating}
              className="rounded-xl border border-[#4cd34c]/40 bg-[#4cd34c]/10 py-2.5 text-xs font-bold text-[#4cd34c] hover:bg-[#4cd34c] hover:text-[#071007] transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <img src="/globe.png" alt="Globe" className="h-3.5 w-3.5 shrink-0 object-contain" />
              Shona
            </button>
            <button
              type="button"
              onClick={() => handleInlineTranslate("nd")}
              disabled={!generatedMsg || isTranslating}
              className="rounded-xl border border-[#4cd34c]/40 bg-[#4cd34c]/10 py-2.5 text-xs font-bold text-[#4cd34c] hover:bg-[#4cd34c] hover:text-[#071007] transition disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <img src="/globe.png" alt="Globe" className="h-3.5 w-3.5 shrink-0 object-contain" />
              IsiNdebele
            </button>
          </div>

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
