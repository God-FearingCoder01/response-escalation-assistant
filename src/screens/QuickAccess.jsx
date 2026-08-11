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
            <span>🔥 Most Used</span>
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
            <span>🕒 Recents</span>
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
                const isAgentField = ph === "agent_name" || ph === "agent_initials" || ph === "agent";
                const isDateField = dateAuto[ph] !== undefined;
                const isTimeUnitField = /^time_unit/i.test(ph);
                const autoVal = isAgentField
                  ? (ph === "agent_initials" ? currentAgent?.agent_initials : currentAgent?.agent_name)
                  : isDateField
                    ? dateAuto[ph]
                    : isTimeUnitField
                      ? "hour(s)"
                      : "";
                return (
                  <div key={ph}>
                    <div className="flex justify-between items-center mb-0.5">
                      <span className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                        {ph.replace("_", " ")}:
                      </span>
                    </div>
                    {isTimeUnitField ? (
                      <select
                        value={values[ph] ?? "hour(s)"}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        className="w-full rounded-xl border p-2 text-xs font-medium"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      >
                        <option value="hour(s)">hour(s)</option>
                        <option value="minutes">minutes</option>
                      </select>
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
            className="rounded-2xl border p-4 min-h-[10rem] whitespace-pre-wrap font-mono text-sm leading-relaxed"
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
