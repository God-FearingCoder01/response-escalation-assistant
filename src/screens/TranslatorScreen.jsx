import { useState } from "react";

export default function TranslatorScreen({
  translatorState,
  copyText,
  showToast,
}) {
  const {
    sourceText,
    setSourceText,
    translatedText,
    sourceLang,
    targetLang,
    isTranslating,
    translationProvider,
    history,
    handleSwapLanguages,
    handleTranslate,
    handleSelectPreset,
    handleClear,
    handleClearHistory,
    presetPhrases,
  } = translatorState || {};

  const [copied, setCopied] = useState(false);

  const getLangName = (code) => (code === "en" ? "English" : "Shona");

  const handleCopyTranslated = () => {
    if (!translatedText) return;
    copyText(translatedText);
    setCopied(true);
    showToast?.("Translated text copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div
        className="rounded-3xl border p-6 shadow-xl backdrop-blur-xl transition-all"
        style={{
          borderColor: "var(--panel-border)",
          backgroundColor: "var(--panel-bg)",
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-2xl shadow-lg">
              🌐
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">
                English ⇄ Shona Translator
              </h1>
              <p className="text-xs opacity-75">
                Instant bidirectional translation for customer queries and escalation messages
              </p>
            </div>
          </div>

          {/* Language direction toggle bar */}
          <div
            className="flex items-center rounded-2xl border p-1.5 shadow-sm"
            style={{
              borderColor: "var(--badge-border)",
              backgroundColor: "var(--app-bg)",
            }}
          >
            <span className="px-3 text-xs font-bold uppercase tracking-wider text-[#4cd34c]">
              {getLangName(sourceLang)}
            </span>
            <button
              onClick={handleSwapLanguages}
              className="flex h-8 w-8 items-center justify-center rounded-xl transition hover:scale-110 active:scale-95 bg-[var(--neutral-bg)] text-[var(--neutral-text)] shadow-sm"
              title="Swap Languages"
            >
              ⇄
            </button>
            <span className="px-3 text-xs font-bold uppercase tracking-wider text-[#4cd34c]">
              {getLangName(targetLang)}
            </span>
          </div>
        </div>
      </div>

      {/* Main Translation Cards Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Source Text Card */}
        <div
          className="flex flex-col justify-between rounded-3xl border p-5 shadow-xl backdrop-blur-xl transition-all"
          style={{
            borderColor: "var(--panel-border)",
            backgroundColor: "var(--panel-bg)",
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider opacity-75">
                Source Text ({getLangName(sourceLang)})
              </label>
              {sourceText && (
                <button
                  onClick={handleClear}
                  className="text-xs font-semibold text-red-400 hover:underline"
                >
                  Clear
                </button>
              )}
            </div>

            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              placeholder={`Enter text in ${getLangName(sourceLang)} to translate...`}
              rows={6}
              className="w-full resize-none rounded-2xl border p-4 text-sm font-medium outline-none transition focus:ring-2 focus:ring-[#4cd34c]"
              style={{
                borderColor: "var(--field-border)",
                backgroundColor: "var(--app-bg)",
                color: "var(--app-text)",
              }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs opacity-60">
              {sourceText.length} characters
            </span>
            <button
              onClick={() => handleTranslate()}
              disabled={!sourceText.trim() || isTranslating}
              className={`flex items-center gap-2 rounded-2xl px-6 py-2.5 text-sm font-bold shadow-lg transition-all ${
                !sourceText.trim() || isTranslating
                  ? "opacity-50 cursor-not-allowed bg-gray-500 text-white"
                  : "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] hover:scale-105 active:scale-95"
              }`}
            >
              {isTranslating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Translating...
                </>
              ) : (
                <>
                  Translate to {getLangName(targetLang)} ➔
                </>
              )}
            </button>
          </div>
        </div>

        {/* Translated Output Card */}
        <div
          className="flex flex-col justify-between rounded-3xl border p-5 shadow-xl backdrop-blur-xl transition-all"
          style={{
            borderColor: "var(--panel-border)",
            backgroundColor: "var(--panel-bg)",
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#4cd34c]">
                Translated Result ({getLangName(targetLang)})
              </label>
              {translationProvider && (
                <span className="rounded-full bg-[#4cd34c]/10 px-2.5 py-0.5 text-[10px] font-bold text-[#4cd34c] uppercase">
                  {translationProvider}
                </span>
              )}
            </div>

            <div
              className="min-h-[156px] w-full rounded-2xl border p-4 text-sm font-medium leading-relaxed transition"
              style={{
                borderColor: "var(--field-border)",
                backgroundColor: "var(--app-bg)",
                color: translatedText ? "var(--app-text)" : "var(--neutral-text)",
              }}
            >
              {translatedText ? (
                translatedText
              ) : (
                <span className="italic opacity-50">
                  Translation result will appear here...
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs opacity-60">
              {translatedText ? `${translatedText.length} characters` : ""}
            </span>
            <button
              onClick={handleCopyTranslated}
              disabled={!translatedText}
              className={`flex items-center gap-2 rounded-2xl border px-5 py-2.5 text-sm font-bold transition ${
                !translatedText
                  ? "opacity-40 cursor-not-allowed border-transparent"
                  : copied
                  ? "border-[#4cd34c] bg-[#4cd34c] text-[#071007]"
                  : "border-[#4cd34c] bg-[#4cd34c]/10 text-[#4cd34c] hover:bg-[#4cd34c] hover:text-[#071007]"
              }`}
            >
              {copied ? "✓ Copied!" : "📋 Copy Translation"}
            </button>
          </div>
        </div>
      </div>

      {/* Preset Common Support Phrases */}
      <div
        className="rounded-3xl border p-6 shadow-xl backdrop-blur-xl transition-all space-y-4"
        style={{
          borderColor: "var(--panel-border)",
          backgroundColor: "var(--panel-bg)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">💡</span>
          <h2 className="text-sm font-bold uppercase tracking-wider">
            Preset Telecom & Support Phrases
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {presetPhrases?.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectPreset(preset)}
              className="rounded-2xl border px-3.5 py-2 text-xs font-semibold transition hover:scale-105 active:scale-95 shadow-sm"
              style={{
                borderColor: "var(--badge-border)",
                backgroundColor: "var(--app-bg)",
                color: "var(--app-text)",
              }}
            >
              <span className="text-[#4cd34c] font-bold">[{preset.label}]</span>{" "}
              {sourceLang === "en" ? preset.en.slice(0, 45) + "..." : preset.sn.slice(0, 45) + "..."}
            </button>
          ))}
        </div>
      </div>

      {/* Translation History */}
      {history && history.length > 0 && (
        <div
          className="rounded-3xl border p-6 shadow-xl backdrop-blur-xl transition-all space-y-4"
          style={{
            borderColor: "var(--panel-border)",
            backgroundColor: "var(--panel-bg)",
          }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <span>🕒</span> Recent Translations
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs opacity-60">{history.length} items</span>
              <button
                onClick={handleClearHistory}
                className="text-xs font-semibold text-red-400 hover:underline"
              >
                Clear History
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border p-3.5 text-xs font-medium"
                style={{
                  borderColor: "var(--badge-border)",
                  backgroundColor: "var(--app-bg)",
                }}
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase text-[#4cd34c]">
                    <span>{getLangName(item.sourceLang)} ➔ {getLangName(item.targetLang)}</span>
                    <span className="opacity-50">• {item.timestamp}</span>
                  </div>
                  <p className="line-clamp-1 opacity-90 font-semibold">{item.sourceText}</p>
                  <p className="line-clamp-1 text-[#4cd34c] font-medium">{item.translatedText}</p>
                </div>

                <button
                  onClick={() => {
                    copyText(item.translatedText);
                    showToast?.("Copied from history!");
                  }}
                  className="self-end sm:self-center rounded-xl border border-[#4cd34c]/30 px-3 py-1.5 font-bold text-[#4cd34c] hover:bg-[#4cd34c] hover:text-[#071007] transition"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
