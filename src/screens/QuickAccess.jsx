import { getDateAutoValues } from "../services/api";

export default function QuickAccess({
  activeScreen,
  currentAgent,
  quickTab,
  setQuickTab,
  favoriteTemplates = [],
  mostUsedTemplates = [],
  recentlyUsedTemplates = [],
  templates = [],
  setSelectedQuickId,
  activeTemplate,
  toggleFavorite,
  favoriteIds = [],
  usageCounts = {},
  placeholders = [],
  values = {},
  setValues,
  generatedMsg,
  copyText,
}) {
  if (activeScreen !== "quick_access" || !currentAgent) return null;

  const favList = favoriteTemplates || [];
  const mostList = mostUsedTemplates || [];
  const recList = recentlyUsedTemplates || [];
  const allTemplates = templates || [];
  const favIds = favoriteIds || [];
  const counts = usageCounts || {};
  const phList = placeholders || [];

  const currentTabTemplates =
    quickTab === "favorites"
      ? favList
      : quickTab === "most_used"
        ? mostList
        : recList;

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
      {/* Left Panel: Favorites & Recents Selector */}
      <div
        className="lg:col-span-7 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur space-y-5"
        style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
      >
        <div>
          <h2 className="text-xl font-bold mb-1 flex items-center gap-2" style={{ color: "var(--app-text)" }}>
            <span className="text-xl">⭐</span>
            Quick Access & Favorites Center
          </h2>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Instant access to your starred, most used, and recently copied response templates.
          </p>
        </div>

        {/* Sub-Tab Navigation */}
        <div className="grid grid-cols-3 gap-2 border-b pb-3" style={{ borderColor: "var(--field-border)" }}>
          <button
            type="button"
            onClick={() => setQuickTab("favorites")}
            className={`rounded-xl border py-2 px-3 text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              quickTab === "favorites"
                ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c] shadow-sm"
                : "hover:bg-[var(--neutral-bg)] text-[var(--text-muted)]"
            }`}
            style={{ borderColor: quickTab === "favorites" ? "#4cd34c" : "var(--field-border)" }}
          >
            <span>⭐ Favorites</span>
            <span className="text-[10px] rounded-full px-1.5 py-0.2 bg-[#4cd34c]/20 font-bold">{favList.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setQuickTab("most_used")}
            className={`rounded-xl border py-2 px-3 text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              quickTab === "most_used"
                ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c] shadow-sm"
                : "hover:bg-[var(--neutral-bg)] text-[var(--text-muted)]"
            }`}
            style={{ borderColor: quickTab === "most_used" ? "#4cd34c" : "var(--field-border)" }}
          >
            <span className="flex items-center gap-1">
              <img src="/fire.png" alt="Most Used" className="h-4 w-4 shrink-0 object-contain" />
              Most Used
            </span>
            <span className="text-[10px] rounded-full px-1.5 py-0.2 bg-[#4cd34c]/20 font-bold">{mostList.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setQuickTab("recently_used")}
            className={`rounded-xl border py-2 px-3 text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              quickTab === "recently_used"
                ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c] shadow-sm"
                : "hover:bg-[var(--neutral-bg)] text-[var(--text-muted)]"
            }`}
            style={{ borderColor: quickTab === "recently_used" ? "#4cd34c" : "var(--field-border)" }}
          >
            <span className="flex items-center gap-1">
              <img src="/clock.png" alt="Recents" className="h-4 w-4 shrink-0 object-contain" />
              Recents
            </span>
            <span className="text-[10px] rounded-full px-1.5 py-0.2 bg-[#4cd34c]/20 font-bold">{recList.length}</span>
          </button>
        </div>

        {/* Template List Cards */}
        <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
          {currentTabTemplates.length === 0 ? (
            <div className="space-y-4">
              <div
                className="p-6 text-center rounded-2xl border backdrop-blur space-y-2"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--text-muted)" }}
              >
                <div className="text-2xl">⭐</div>
                <div className="font-bold text-sm text-[var(--app-text)]">
                  {quickTab === "favorites"
                    ? "No Starred Favorites Yet"
                    : quickTab === "most_used"
                      ? "No Copy Statistics Recorded Yet"
                      : "No Recently Used Templates"}
                </div>
                <p className="text-xs max-w-sm mx-auto">
                  Click the ⭐ Star icon on any template below or across Tech Escalation and Customer Reply to add it to your Favorites list!
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider block" style={{ color: "var(--text-muted)" }}>
                  All Templates Library (Click ⭐ to add to Favorites):
                </label>
                {allTemplates.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedQuickId(t.id)}
                    className={`p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                      t.id === activeTemplate?.id
                        ? "border-[#4cd34c] ring-1 ring-[#4cd34c]/30 bg-[#4cd34c]/5"
                        : "hover:border-[#4cd34c]/50"
                    }`}
                    style={{ borderColor: t.id === activeTemplate?.id ? "#4cd34c" : "var(--field-border)", backgroundColor: "var(--field-bg)" }}
                  >
                    <div className="space-y-0.5 max-w-md">
                      <div className="font-bold text-sm flex items-center gap-2">
                        {t.name}
                        <span className="text-[10px] rounded-full border px-2 py-0.5" style={{ borderColor: "var(--badge-border)", color: "var(--badge-text)" }}>
                          {t.category_type === "tech_escalation" ? "Tech Escalation" : "Customer Reply"}
                        </span>
                      </div>
                      <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                        {t.body}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(t.id);
                      }}
                      className="p-1 rounded-lg text-sm hover:scale-125 transition shrink-0 ml-2"
                      title={favIds.includes(t.id) ? "Remove from Favorites" : "Add to Favorites"}
                    >
                      {favIds.includes(t.id) ? "⭐" : "☆"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            currentTabTemplates.map((t) => (
              <div
                key={t.id}
                onClick={() => setSelectedQuickId(t.id)}
                className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                  t.id === activeTemplate?.id
                    ? "border-[#4cd34c] ring-1 ring-[#4cd34c]/30 bg-[#4cd34c]/5"
                    : "hover:border-[#4cd34c]/50"
                }`}
                style={{ borderColor: t.id === activeTemplate?.id ? "#4cd34c" : "var(--field-border)", backgroundColor: "var(--field-bg)" }}
              >
                <div className="space-y-1 max-w-md">
                  <div className="font-bold text-sm flex items-center gap-2">
                    {t.name}
                    <span className="text-[10px] rounded-full border px-2 py-0.5" style={{ borderColor: "var(--badge-border)", color: "var(--badge-text)" }}>
                      {t.category_type === "tech_escalation" ? "Tech Escalation" : "Customer Reply"}
                    </span>
                  </div>
                  <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                    {t.body}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {counts[t.id] ? (
                    <span className="text-[10px] font-semibold rounded-full bg-[#4cd34c]/10 text-[#4cd34c] border border-[#4cd34c]/30 px-2 py-0.5">
                      {counts[t.id]} copies
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(t.id);
                    }}
                    className="p-1 rounded-lg text-sm hover:scale-125 transition"
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

      {/* Right Panel: Live Message Preview & Instant Parameters */}
      <div
        className="lg:col-span-5 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur flex flex-col justify-between"
        style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold" style={{ color: "var(--app-text)" }}>
              Quick Message Preview
            </h2>
            {activeTemplate ? (
              <span className="text-xs font-semibold text-[#4cd34c] bg-[#4cd34c]/10 border border-[#4cd34c]/30 px-2.5 py-0.5 rounded-full">
                {activeTemplate.name}
              </span>
            ) : null}
          </div>

          {/* Parameters inputs for Quick Access */}
          {phList.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 border-b pb-3" style={{ borderColor: "var(--field-border)" }}>
              <label className="text-[11px] font-semibold uppercase tracking-wider block" style={{ color: "var(--text-muted)" }}>
                Fill Template Parameters:
              </label>
              {phList.map((ph) => {
                const dateAuto = getDateAutoValues();
                let customCfg = null;
                if (activeTemplate?.placeholder_config) {
                  try {
                    const parsed = typeof activeTemplate.placeholder_config === "string"
                      ? JSON.parse(activeTemplate.placeholder_config)
                      : activeTemplate.placeholder_config;
                    customCfg = parsed[ph] || null;
                  } catch (e) {
                    customCfg = null;
                  }
                }

                const isAgentField = ph === "agent_name" || ph === "agent_initials" || ph === "agent";
                const isDateField = dateAuto[ph] !== undefined;
                const isTimeUnitField = /^time_unit/i.test(ph);
                const isReasonField = ph.toLowerCase().includes("reason") || ph.toLowerCase().includes("details") || ph.toLowerCase().includes("note") || ph.toLowerCase().includes("description");
                const isDayField = ph === "day" || ph === "day_number" || ph === "day_num" || ph === "dd";
                const isMonthNumberField = ph === "month_number" || ph === "month_num" || ph === "month" || ph === "mm";

                let controlType = customCfg?.control_type || (
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
                else if (customCfg?.auto_fill_type === "agent_initials") autoVal = currentAgent?.agent_initials ?? "";
                else if (customCfg?.auto_fill_type === "custom") autoVal = customCfg.custom_default ?? "";
                else if (isAgentField) autoVal = ph === "agent_initials" ? currentAgent?.agent_initials : currentAgent?.agent_name;
                else if (isDateField) autoVal = dateAuto[ph];
                else if (isTimeUnitField) autoVal = "hour(s)";

                const options = Array.isArray(customCfg?.options) ? customCfg.options : [];

                return (
                  <div key={ph}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs capitalize font-medium" style={{ color: "var(--text-muted)" }}>
                        {ph.replace("_", " ")}:
                      </span>
                    </div>

                    {controlType === "combobox" ? (
                      <select
                        value={values[ph] ?? (options[0] || autoVal)}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        className="w-full rounded-xl border p-2 text-xs font-medium"
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
                            className="w-full p-1.5 text-xs font-bold font-mono tracking-wider text-center bg-transparent focus:outline-none"
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
                              className="px-2 py-0.5 text-[9px] font-black hover:bg-[#4cd34c]/20 transition select-none"
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
                              className="px-2 py-0.5 text-[9px] font-black hover:bg-[#4cd34c]/20 transition border-t select-none"
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
                          placeholder={`Enter ${ph.replace("_", " ")}`}
                          className="w-full rounded-xl border p-2 text-xs font-semibold"
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
                          className="rounded-xl border p-1.5 text-xs font-medium shrink-0 cursor-pointer"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                        <input
                          type="text"
                          value={formatDateTimeString(values[ph] ?? autoVal, "date")}
                          onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                          placeholder="DD/MM/YYYY"
                          className="w-full rounded-xl border p-2 text-xs font-semibold font-mono tracking-wider"
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
                          className="rounded-xl border p-1.5 text-xs font-medium shrink-0 cursor-pointer"
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
                          className="w-full rounded-xl border p-2 text-xs font-semibold font-mono tracking-wider"
                          style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                        />
                      </div>
                    ) : controlType === "datetime" ? (
                      <input
                        type="datetime-local"
                        value={values[ph] ?? autoVal}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        className="w-full rounded-xl border p-2 text-xs font-medium"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      />
                    ) : controlType === "time_units_select" ? (
                      <select
                        value={values[ph] ?? "hour(s)"}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        className="w-full rounded-xl border p-2 text-xs font-medium"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      >
                        <option value="hour(s)">hour(s)</option>
                        <option value="minutes">minutes</option>
                      </select>
                    ) : controlType === "textarea" ? (
                      <textarea
                        rows={3}
                        value={values[ph] ?? autoVal}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        placeholder={`Enter ${ph.replace("_", " ")}...`}
                        className="w-full rounded-xl border p-2.5 text-sm resize-y font-sans leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#4cd34c]"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      />
                    ) : (
                      <input
                        value={values[ph] ?? autoVal}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        placeholder={`Enter ${ph.replace("_", " ")}`}
                        className="w-full rounded-xl border p-2 text-xs placeholder:text-[var(--field-placeholder)]"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}

          <div
            className="rounded-2xl border p-4 min-h-[10rem] max-h-[22rem] overflow-y-auto break-words [overflow-wrap:anywhere] font-mono text-sm leading-relaxed"
            style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
          >
            {generatedMsg || <span style={{ color: "var(--field-placeholder)" }}>Select a template from Quick Access...</span>}
          </div>
        </div>

        <div className="space-y-2 mt-6">
          <button
            type="button"
            onClick={() => copyText(generatedMsg, "Quick message copied to clipboard! 📋", activeTemplate?.id)}
            disabled={!generatedMsg}
            className="w-full rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] py-3 font-semibold text-[#071007] shadow-lg disabled:opacity-50 transition hover:opacity-90"
          >
            Copy Message Text 📋
          </button>
          <button
            type="button"
            onClick={() => setValues({})}
            className="w-full rounded-xl border py-2 text-sm font-medium transition hover:opacity-90"
            style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
          >
            Clear Parameter Inputs
          </button>
        </div>
      </div>
    </section>
  );
}
