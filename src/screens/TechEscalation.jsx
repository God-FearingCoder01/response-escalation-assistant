import { getDateAutoValues } from "../services/api";

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

        {/* Template Picker */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Select Escalation Template:
            </label>
            {activeTemplate ? (
              <button
                type="button"
                onClick={() => toggleFavorite?.(activeTemplate.id)}
                className={`text-xs font-medium px-2.5 py-1 rounded-xl border flex items-center gap-1 transition ${
                  (favoriteIds || []).includes(activeTemplate.id)
                    ? "border-[#f1c84b] bg-[#f1c84b]/10 text-[#f1c84b]"
                    : "hover:bg-[var(--neutral-bg)] text-[var(--text-muted)]"
                }`}
                style={{ borderColor: (favoriteIds || []).includes(activeTemplate.id) ? "#f1c84b" : "var(--field-border)" }}
              >
                {(favoriteIds || []).includes(activeTemplate.id) ? "⭐ Favorited" : "☆ Add to Favorites"}
              </button>
            ) : null}
          </div>
          <select
            value={selectedTechId ?? ""}
            onChange={(e) => setSelectedTechId?.(Number(e.target.value))}
            className="w-full rounded-xl border p-3 font-medium text-sm"
            style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
          >
            {(techTemplates || []).map((t) => (
              <option key={t.id} value={t.id}>
                {(favoriteIds || []).includes(t.id) ? "⭐ " : ""}{t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Dynamic Parameters */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
            Escalation Parameters:
          </h3>

          {(placeholders || []).length === 0 ? (
            <p className="text-xs italic p-3 rounded-xl border" style={{ borderColor: "var(--field-border)", color: "var(--text-muted)" }}>
              This template contains no customizable fields.
            </p>
          ) : (
            <div className="space-y-3">
              {(placeholders || []).map((ph) => {
                const isAgentField = ph === "agent_name" || ph === "agent_initials" || ph === "agent";
                const isDateField = /^(day|month|year|date)/i.test(ph);
                const isTimeUnitField = /^time_unit/i.test(ph);
                const dateAuto = getDateAutoValues();
                const autoVal = isAgentField
                  ? (ph === "agent_initials" ? currentAgent?.agent_initials : currentAgent?.agent_name)
                  : isDateField
                    ? dateAuto[ph]
                    : isTimeUnitField
                      ? "hour(s)"
                      : "";
                return (
                  <div key={ph}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs capitalize" style={{ color: "var(--text-muted)" }}>
                        {ph.replace("_", " ")}:
                      </span>
                      {isAgentField ? (
                        <span className="text-[10px] text-[#4cd34c] font-semibold">Auto-filled from profile</span>
                      ) : isDateField ? (
                        <span className="text-[10px] text-[#4cd34c] font-semibold">Auto-filled from date</span>
                      ) : isTimeUnitField ? (
                        <span className="text-[10px] text-[#4cd34c] font-semibold">Preset dropdown</span>
                      ) : null}
                    </div>
                    {isTimeUnitField ? (
                      <select
                        value={values[ph] ?? "hour(s)"}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        className="w-full rounded-xl border p-2.5 text-sm font-medium"
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
                        className="w-full rounded-xl border p-2.5 text-sm placeholder:text-[var(--field-placeholder)]"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Live Message Preview */}
      <div
        className="lg:col-span-5 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur flex flex-col justify-between"
        style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold" style={{ color: "var(--app-text)" }}>
              Telegram Escalation Preview
            </h2>
          </div>

          <div
            className="rounded-2xl border p-4 min-h-[12rem] whitespace-pre-wrap font-mono text-sm leading-relaxed"
            style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
          >
            {generatedMsg || <span style={{ color: "var(--field-placeholder)" }}>Select an escalation template...</span>}
          </div>

          <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
            💡 Tech Escalation messages automatically end with signature <code className="text-[#4cd34c]">#{currentAgent.agent_name}</code>.
          </p>
        </div>

        <div className="space-y-2 mt-6">
          <button
            type="button"
            onClick={() => copyText(generatedMsg, "Telegram escalation copied! 📋", activeTemplate?.id)}
            disabled={!generatedMsg}
            className="w-full rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] py-3 font-semibold text-[#071007] shadow-lg disabled:opacity-50 transition"
          >
            Copy Telegram Formatted Escalation
          </button>
          <button
            type="button"
            onClick={() => copyText(generatedMsg.replace(new RegExp(`\\s*#${currentAgent?.agent_name}$`), ""), "Plain text escalation copied! 📋", activeTemplate?.id)}
            disabled={!generatedMsg}
            className="w-full rounded-xl border py-2 text-sm font-medium transition hover:opacity-90"
            style={{ borderColor: "var(--badge-border)", color: "var(--neutral-text)", backgroundColor: "var(--neutral-bg)" }}
          >
            Copy Plain Text Escalation
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
