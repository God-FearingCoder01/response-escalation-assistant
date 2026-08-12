import { useState } from "react";
import { getDateAutoValues } from "../services/api";
import { translateText } from "../services/translationService";

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
            onChange={(e) => {
              setSelectedTechId(Number(e.target.value));
              setShonaText("");
              setViewMode("english");
            }}
            className="w-full rounded-2xl border p-3 font-medium outline-none transition focus:ring-2 focus:ring-[#4cd34c]"
            style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
          >
            {(techTemplates || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.category && t.category !== "tech_escalation" ? ` (${t.category})` : ""}
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

          {(placeholders || []).length === 0 ? (
            <p className="text-xs italic py-2" style={{ color: "var(--text-muted)" }}>
              No dynamic placeholders required for this template.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(placeholders || []).map((ph) => {
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
                  <div key={ph} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold capitalize opacity-85">
                        {ph.replace(/_/g, " ")}:
                      </label>
                      {isAgentField ? (
                        <span className="text-[10px] text-[#4cd34c] font-semibold">Auto-filled</span>
                      ) : isDateField ? (
                        <span className="text-[10px] text-[#4cd34c] font-semibold">Auto-date</span>
                      ) : null}
                    </div>

                    {isTimeUnitField ? (
                      <select
                        value={values[ph] ?? "hour(s)"}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        className="w-full rounded-xl border p-2.5 text-sm font-medium outline-none transition"
                        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
                      >
                        <option value="hour(s)">hour(s)</option>
                        <option value="minutes">minutes</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={values[ph] ?? autoVal ?? ""}
                        onChange={(e) => setValues((s) => ({ ...s, [ph]: e.target.value }))}
                        placeholder={`Enter ${ph.replace(/_/g, " ")}...`}
                        className="w-full rounded-xl border p-2.5 text-sm font-medium outline-none transition focus:border-[#4cd34c]"
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

      {/* Right Panel: Output & Instant Copy */}
      <div
        className="lg:col-span-5 rounded-3xl border p-6 shadow-[var(--panel-shadow)] backdrop-blur flex flex-col justify-between"
        style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" }}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold" style={{ color: "var(--app-text)" }}>
              Telegram Escalation Preview
            </h2>

            {/* Language View Switcher */}
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
          </div>

          <div
            className="rounded-2xl border p-4 min-h-[12rem] whitespace-pre-wrap font-mono text-sm leading-relaxed"
            style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
          >
            {viewMode === "translated" && translatedText
              ? translatedText
              : generatedMsg || <span style={{ color: "var(--field-placeholder)" }}>Select an escalation template...</span>}
          </div>

          <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
            💡 Tech Escalation messages automatically end with signature <code className="text-[#4cd34c]">#{currentAgent?.agent_name || ""}</code>.
          </p>
        </div>

        <div className="space-y-2 mt-6">
          <button
            type="button"
            onClick={() => {
              const activeText = viewMode === "translated" ? translatedText : generatedMsg;
              copyText(activeText, "Telegram escalation copied! 📋", activeTemplate?.id);
            }}
            disabled={!generatedMsg}
            className="w-full rounded-2xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] py-3.5 font-bold text-[#071007] shadow-[var(--btn-glow)] transition hover:opacity-90 disabled:opacity-40"
          >
            Copy Escalation Message 🚀
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
