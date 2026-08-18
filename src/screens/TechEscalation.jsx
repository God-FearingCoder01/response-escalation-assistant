import { getDateAutoValues, resolveConditionalMappings, formatDateTimeString } from "../services/api";

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
}) {
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
            const visiblePlaceholders = (placeholders || []).filter((ph) => !mappedTargetKeys.has(ph));

            return visiblePlaceholders.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

                  const isTrigger = ph.endsWith("?") || (Boolean(customCfg?.mapped_target) && customCfg.mapped_target.trim() !== "");
                  const targetKey = isTrigger ? (customCfg?.mapped_target || `:${ph.replace(/\?$/, "")}`) : null;
                  const autoMappedVal = targetKey ? resolvedValues[targetKey] : null;

                  return (
                    <div key={ph} className={controlType === "textarea" ? "col-span-full md:col-span-2" : ""}>
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
                      (isMonthNumberField || isDayField || cfg?.auto_fill_type === "month_number" || cfg?.auto_fill_type === "day_number" || ["month_number", "month_num", "month", "mm", "day_number", "day_num", "day", "dd"].includes(ph.toLowerCase())) ? (
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
                                const maxVal = (isMonthNumberField || cfg?.auto_fill_type === "month_number" || ["month_number", "month_num", "month", "mm"].includes(ph.toLowerCase())) ? 12 : 31;
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
                          onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
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
                              setValues((s) => ({ ...s, [ph]: `${d}/${m}/${y}` }));
                            }
                          }}
                          className="rounded-xl border p-2 text-sm font-medium shrink-0 cursor-pointer"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                        <input
                          type="text"
                          value={formatDateTimeString(values[ph] ?? autoVal, "date", customCfg?.date_format)}
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
                          value={(values[ph] ?? autoVal ?? "").toString().replace(/:/g, "")}
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
                        value={values[ph] ?? autoVal}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
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
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        placeholder={autoVal ? `Auto: ${autoVal}` : `Enter ${ph.replace("_", " ")}...`}
                        className="w-full rounded-xl border p-2.5 text-sm resize-y font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      />
                    ) : (
                      <input
                        value={values[ph] ?? autoVal}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        placeholder={autoVal ? `Auto: ${autoVal}` : `Enter ${ph.replace("_", " ")}...`}
                        className="w-full rounded-xl border p-2.5 text-sm"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      />
                    )}
                  </div>
                );
              })}
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

          <div
            className="rounded-2xl border p-4 min-h-[12rem] max-h-[22rem] overflow-y-auto break-words [overflow-wrap:anywhere] font-mono text-sm leading-relaxed"
            style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
          >
            {generatedMsg || <span style={{ color: "var(--field-placeholder)" }}>Select an escalation template...</span>}
          </div>

          <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
            💡 Tech Escalation messages automatically end with signature <code className="text-[#4cd34c]">#{currentAgent?.agent_name || ""}</code>.
          </p>
        </div>

        <div className="space-y-2 mt-6">
          <button
            type="button"
            onClick={() => copyText(generatedMsg, "Telegram escalation copied! 📋", activeTemplate?.id)}
            disabled={!generatedMsg}
            className="w-full rounded-2xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] py-3.5 font-bold text-[#071007] shadow-[var(--btn-glow)] transition hover:opacity-90 disabled:opacity-40"
          >
            Copy Escalation Message 🚀
          </button>

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
