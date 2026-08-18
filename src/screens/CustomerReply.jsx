import { useState } from "react";
import { getDateAutoValues, resolveConditionalMappings, formatDateTimeString } from "../services/api";
import { translateText } from "../services/translationService";

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
  copyText,
}) {
  const [translatedText, setTranslatedText] = useState("");
  const [translatedLangLabel, setTranslatedLangLabel] = useState("Shona");
  const [isTranslating, setIsTranslating] = useState(false);
  const [viewMode, setViewMode] = useState("english"); // 'english' | 'translated'

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

        {/* Target Channel Selector */}
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: "var(--text-muted)" }}>
            Select Response Format:
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setReplyChannel("signed")}
              className={`rounded-xl border py-2.5 px-3 text-sm font-medium transition flex items-center justify-center gap-2 ${
                replyChannel === "signed"
                  ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c] font-bold shadow-sm"
                  : "hover:bg-[var(--neutral-bg)]"
              }`}
              style={{ borderColor: replyChannel === "signed" ? "#4cd34c" : "var(--field-border)" }}
            >
              <span className="flex items-center gap-1.5">
                <img src="/signed.png" alt="Signed" className="h-4 w-4 shrink-0 object-contain" />
                Signed (^{currentAgent?.agent_initials || ""})
              </span>
            </button>
            <button
              type="button"
              onClick={() => setReplyChannel("unsigned")}
              className={`rounded-xl border py-2.5 px-3 text-sm font-medium transition flex items-center justify-center gap-2 ${
                replyChannel === "unsigned"
                  ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c] font-bold shadow-sm"
                  : "hover:bg-[var(--neutral-bg)]"
              }`}
              style={{ borderColor: replyChannel === "unsigned" ? "#4cd34c" : "var(--field-border)" }}
            >
              <span className="flex items-center gap-1.5">
                <img src="/unsigned.png" alt="Unsigned" className="h-4 w-4 shrink-0 object-contain" />
                Unsigned (Plain Text)
              </span>
            </button>
          </div>
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

          {/* Level 1: Category Pills */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
              Primary Category:
            </label>
            <div className="flex flex-wrap gap-2">
              {categoriesList.map((cat) => (
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

          {/* Level 2: Subcategory Chips */}
          {subcategoriesList.length > 1 ? (
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: "var(--text-muted)" }}>
                Subcategory:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {subcategoriesList.map((subcat) => (
                  <button
                    key={subcat}
                    type="button"
                    onClick={() => setSelectedSubcategory(subcat)}
                    className={`rounded-xl border px-2.5 py-0.5 text-[11px] transition ${
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
                    }}
                    className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                      String(t.id) === String(activeTemplate?.id)
                        ? "border-[#4cd34c] ring-1 ring-[#4cd34c]/30 bg-[#4cd34c]/5"
                        : "hover:border-[#4cd34c]/50"
                    }`}
                    style={{ borderColor: String(t.id) === String(activeTemplate?.id) ? "#4cd34c" : "var(--field-border)", backgroundColor: "var(--field-bg)" }}
                  >
                    <div>
                      <div className="font-semibold text-sm">{t.name}</div>
                      <div className="text-xs truncate max-w-md mt-0.5" style={{ color: "var(--text-muted)" }}>
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
            const { resolvedValues, mappedTargetKeys } = resolveConditionalMappings(placeholderList, parsedCfgMap, values);
            const visiblePlaceholders = (placeholderList || []).filter((ph) => !mappedTargetKeys.has(ph));

            return visiblePlaceholders.length > 0 ? (
              <div className="pt-3 border-t space-y-3" style={{ borderColor: "var(--field-border)" }}>
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Response Parameters:
                </h3>
                <div className="space-y-3">
                  {visiblePlaceholders.map((ph) => {
                    const dateAuto = getDateAutoValues();
                    const customCfg = parsedCfgMap[ph] || null;

                    const isAgentField = ph === "agent_name" || ph === "agent_initials" || ph === "agent";
                    const isDateField = dateAuto[ph] !== undefined;
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
                    else if (customCfg?.auto_fill_type === "agent_name") autoVal = currentAgent?.agent_name ?? "";
                    else if (customCfg?.auto_fill_type === "agent_fullname" || customCfg?.auto_fill_type === "agent") autoVal = (currentAgent?.agent || currentAgent?.agent_name) ?? "";
                    else if (customCfg?.auto_fill_type === "agent_initials") autoVal = currentAgent?.agent_initials ?? "";
                    else if (customCfg?.auto_fill_type === "custom") autoVal = customCfg.custom_default ?? "";
                    else if (isAgentField) autoVal = ph === "agent_initials" ? currentAgent?.agent_initials : (ph === "agent" ? (currentAgent?.agent || currentAgent?.agent_name) : currentAgent?.agent_name);
                    else if (isDateField) autoVal = dateAuto[ph];
                    else if (isTimeUnitField) autoVal = "hour(s)";

                    let options = Array.isArray(customCfg?.options) ? customCfg.options : [];
                    if (options.length === 0 && ph.endsWith("?")) {
                      options = ["Elephant", "Rhino", "Lion", "Buffalo", "Leopard"];
                    }

                    const targetKey = customCfg?.mapped_target || (ph.endsWith("?") ? `:${ph.replace(/\?$/, "")}` : null);
                    const autoMappedVal = targetKey ? resolvedValues[targetKey] : null;

                    return (
                      <div key={ph}>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs capitalize font-medium" style={{ color: "var(--text-muted)" }}>
                            {ph.replace("_", " ")}:
                          </span>
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

                      {controlType === "combobox" ? (
                        <select
                          value={valMap[ph] ?? (options[0] || autoVal)}
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
                        (isMonthNumberField || isDayField || cfg?.auto_fill_type === "month_number" || cfg?.auto_fill_type === "day_number" || ["month_number", "month_num", "month", "mm", "day_number", "day_num", "day", "dd"].includes(ph.toLowerCase())) ? (
                          <div className="flex items-center rounded-xl border overflow-hidden" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
                            <input
                              type="text"
                              maxLength={2}
                              value={
                                valMap[ph] !== undefined
                                  ? (valMap[ph] ? String(parseInt(valMap[ph], 10) || 1).padStart(2, "0") : "")
                                  : (autoVal ? String(parseInt(autoVal, 10) || 1).padStart(2, "0") : "01")
                              }
                              onChange={(e) => {
                                const digits = e.target.value.replace(/\D/g, "");
                                if (!digits) {
                                  setValues((s) => ({ ...s, [ph]: "" }));
                                  return;
                                }
                                let n = parseInt(digits, 10);
                                const maxVal = (isMonthNumberField || cfg?.auto_fill_type === "month_number" || ["month_number", "month_num", "month", "mm"].includes(ph.toLowerCase())) ? 12 : 31;
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
                                  const maxVal = (isMonthNumberField || cfg?.auto_fill_type === "month_number" || ["month_number", "month_num", "month", "mm"].includes(ph.toLowerCase())) ? 12 : 31;
                                  const current = parseInt(valMap[ph] ?? autoVal ?? "1", 10) || 1;
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
                                  const maxVal = (isMonthNumberField || cfg?.auto_fill_type === "month_number" || ["month_number", "month_num", "month", "mm"].includes(ph.toLowerCase())) ? 12 : 31;
                                  const current = parseInt(valMap[ph] ?? autoVal ?? "1", 10) || 1;
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
                            value={valMap[ph] ?? autoVal}
                            onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                            placeholder={`Enter ${ph.replace("_", " ")}`}
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
                                setValues((s) => ({ ...s, [ph]: `${d}/${m}/${y}` }));
                              }
                            }}
                            className="rounded-xl border p-2 text-sm font-medium shrink-0 cursor-pointer"
                            style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                          />
                          <input
                            type="text"
                            value={formatDateTimeString(valMap[ph] ?? autoVal, "date", customCfg?.date_format)}
                            onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
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
                              setValues((s) => ({ ...s, [ph]: clean }));
                            }}
                            className="rounded-xl border p-2 text-sm font-medium shrink-0 cursor-pointer"
                            style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                          />
                          <input
                            type="text"
                            maxLength={4}
                            value={(valMap[ph] ?? autoVal ?? "").toString().replace(/:/g, "")}
                            onChange={(e) => {
                              const clean = e.target.value.replace(/:/g, "").replace(/\D/g, "").slice(0, 4);
                              setValues((s) => ({ ...s, [ph]: clean }));
                            }}
                            placeholder="HHMM (e.g. 0945)"
                            className="w-full rounded-xl border p-2.5 text-sm font-semibold font-mono tracking-wider"
                            style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                          />
                        </div>
                      ) : controlType === "datetime" ? (
                        <input
                          type="datetime-local"
                          value={valMap[ph] ?? autoVal}
                          onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                          className="w-full rounded-xl border p-2.5 text-sm font-medium"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                      ) : controlType === "time_units_select" ? (
                        <select
                          value={valMap[ph] ?? "hour(s)"}
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
                          value={valMap[ph] ?? autoVal}
                          onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                          placeholder={`Enter ${ph.replace("_", " ")}...`}
                          className="w-full rounded-xl border p-2.5 text-sm resize-y font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                      ) : (
                        <input
                          value={valMap[ph] ?? autoVal}
                          onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                          placeholder={`Enter ${ph.replace("_", " ")}`}
                          className="w-full rounded-xl border p-2.5 text-sm placeholder:text-[var(--field-placeholder)]"
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

          <div
            className="rounded-2xl border p-4 min-h-[12rem] max-h-[22rem] overflow-y-auto break-words [overflow-wrap:anywhere] font-mono text-sm leading-relaxed"
            style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
          >
            {viewMode === "translated" && translatedText
              ? translatedText
              : generatedMsg || <span style={{ color: "var(--field-placeholder)" }}>Select a response template...</span>}
          </div>

          {replyChannel === "signed" ? (
            <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
              💡 Signed format automatically appends agent initials signature <code className="text-[#4cd34c]">^{currentAgent?.agent_initials || ""}</code>.
            </p>
          ) : (
            <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
              💡 Unsigned format presents clean customer-facing response text without trailing signature.
            </p>
          )}
        </div>

        <div className="space-y-2 mt-6">
          <button
            type="button"
            onClick={() => {
              const activeText = viewMode === "translated" ? translatedText : generatedMsg;
              copyText(activeText, "Customer reply message copied! 📋", activeTemplate?.id);
            }}
            disabled={!generatedMsg}
            className="w-full rounded-2xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] py-3.5 font-bold text-[#071007] shadow-[var(--btn-glow)] transition hover:opacity-90 disabled:opacity-40"
          >
            Copy Customer Response 🚀
          </button>

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
