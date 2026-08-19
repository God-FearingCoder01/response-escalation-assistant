import { useState, useEffect, useMemo } from "react";
import { splitIntoSentences } from "../services/api";

export default function SentenceSnippetSelector({
  generatedMsg = "",
  activeTemplate = null,
  copyText = () => {},
  trackPrivateNoteUsage,
  createPrivateNote,
  showToast,
  quickTab,
  privList = [],
}) {
  const [mode, setMode] = useState("full"); // "full" | "sentences"
  const [checkedIndexes, setCheckedIndexes] = useState([]);
  const [savingSnippet, setSavingSnippet] = useState(false);
  const [snippetTitle, setSnippetTitle] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Split generatedMsg into individual sentences whenever it changes
  const sentences = useMemo(() => {
    return splitIntoSentences(generatedMsg);
  }, [generatedMsg]);

  // By default, check all sentences when template/msg changes
  useEffect(() => {
    if (sentences.length > 0) {
      setCheckedIndexes(sentences.map((_, idx) => idx));
    } else {
      setCheckedIndexes([]);
    }
  }, [sentences]);

  // Calculate effective text based on mode and checked indexes
  const effectiveCopyMsg = useMemo(() => {
    if (!generatedMsg) return "";
    if (mode === "sentences" && sentences.length > 0) {
      const selected = sentences.filter((_, idx) => checkedIndexes.includes(idx));
      return selected.join(" ");
    }
    return generatedMsg;
  }, [generatedMsg, mode, sentences, checkedIndexes]);

  const handleCopy = () => {
    if (!effectiveCopyMsg) return;
    const msgType = mode === "sentences" && checkedIndexes.length < sentences.length ? "Selected sentences copied! 📋" : "Quick message copied to clipboard! 📋";
    copyText(effectiveCopyMsg, msgType, activeTemplate?.id);

    if (activeTemplate && (activeTemplate.is_private_note || activeTemplate.agent_initials || quickTab === "private_notes" || privList.some((n) => n.id === activeTemplate.id))) {
      if (trackPrivateNoteUsage) {
        trackPrivateNoteUsage(activeTemplate.id);
      }
    }
  };

  const handleSaveAsSnippet = async (e) => {
    e.preventDefault();
    if (!effectiveCopyMsg.trim() || !snippetTitle.trim()) return;
    setSavingSnippet(true);
    try {
      if (createPrivateNote) {
        await createPrivateNote({
          name: snippetTitle.trim(),
          body: effectiveCopyMsg.trim(),
          category_type: activeTemplate?.category_type || "customer_reply",
          category: "Personal Snippets",
        });
      }
      setShowSaveModal(false);
      setSnippetTitle("");
      if (showToast) showToast("💾 Saved selection as Private Snippet!", "success");
    } catch (err) {
      if (showToast) showToast("Failed to save snippet", "error");
    } finally {
      setSavingSnippet(false);
    }
  };

  const openSaveModal = () => {
    const defaultName = activeTemplate ? `Snippet from ${activeTemplate.name}` : "My Custom Snippet";
    setSnippetTitle(defaultName);
    setShowSaveModal(true);
  };

  return (
    <div className="space-y-3">
      {/* Mode Selector Tabs */}
      {generatedMsg && sentences.length > 1 && (
        <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: "var(--field-border)" }}>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            Response Output Mode:
          </span>
          <div className="flex items-center rounded-xl border p-1 text-xs" style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" }}>
            <button
              type="button"
              onClick={() => setMode("full")}
              className={`px-2.5 py-1 rounded-lg font-bold transition ${mode === "full" ? "bg-[#4cd34c] text-[#071007]" : "text-[var(--text-muted)] hover:opacity-100"}`}
            >
              Full Message
            </button>
            <button
              type="button"
              onClick={() => setMode("sentences")}
              className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${mode === "sentences" ? "bg-[#4cd34c] text-[#071007]" : "text-[var(--text-muted)] hover:opacity-100"}`}
            >
              <span>Sentence Checkboxes</span>
              <span className="text-[10px] bg-black/20 px-1.5 py-0.2 rounded-full font-mono">{sentences.length}</span>
            </button>
          </div>
        </div>
      )}

      {/* Sentence Checkbox Selection List */}
      {mode === "sentences" && sentences.length > 0 && (
        <div className="space-y-2 p-3 rounded-2xl border bg-[var(--field-bg)] shadow-inner max-h-48 overflow-y-auto pr-1" style={{ borderColor: "#4cd34c" }}>
          <div className="flex items-center justify-between text-[11px] font-bold text-[#4cd34c] border-b pb-1.5" style={{ borderColor: "var(--field-border)" }}>
            <span>☑ Select Sentences to Include:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCheckedIndexes(sentences.map((_, i) => i))}
                className="hover:underline font-semibold text-[10px]"
              >
                Select All
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setCheckedIndexes([])}
                className="hover:underline font-semibold text-[10px]"
              >
                Clear All
              </button>
            </div>
          </div>
          {sentences.map((sent, idx) => {
            const isChecked = checkedIndexes.includes(idx);
            return (
              <label
                key={idx}
                className={`flex items-start gap-2.5 p-2 rounded-xl border text-xs font-mono transition cursor-pointer ${
                  isChecked
                    ? "border-[#4cd34c] bg-[#4cd34c]/10 text-[var(--app-text)] font-semibold"
                    : "opacity-60 border-[var(--field-border)] hover:opacity-100"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {
                    if (isChecked) {
                      setCheckedIndexes(checkedIndexes.filter((i) => i !== idx));
                    } else {
                      setCheckedIndexes([...checkedIndexes, idx]);
                    }
                  }}
                  className="mt-0.5 accent-[#4cd34c] shrink-0"
                />
                <span className="break-words [overflow-wrap:anywhere]">{sent}</span>
              </label>
            );
          })}
        </div>
      )}

      {/* Live Preview Box */}
      <div
        className="rounded-2xl border p-4 min-h-[10rem] max-h-[22rem] overflow-y-auto break-words [overflow-wrap:anywhere] font-mono text-sm leading-relaxed"
        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
      >
        {effectiveCopyMsg || <span style={{ color: "var(--field-placeholder)" }}>Select a template or check sentences...</span>}
      </div>

      {/* Primary Copy & Save Snippet Actions */}
      <div className="space-y-2 pt-2">
        <button
          type="button"
          onClick={handleCopy}
          disabled={!effectiveCopyMsg}
          className="w-full rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] py-3 font-semibold text-[#071007] shadow-lg disabled:opacity-50 transition hover:opacity-90 flex items-center justify-center gap-2"
        >
          <span>Copy Message Text 📋</span>
          {mode === "sentences" && checkedIndexes.length < sentences.length && (
            <span className="text-xs bg-black/20 px-2 py-0.5 rounded-full font-bold">
              ({checkedIndexes.length} of {sentences.length} sentences)
            </span>
          )}
        </button>

        {effectiveCopyMsg && (
          <button
            type="button"
            onClick={openSaveModal}
            className="w-full rounded-xl border border-[#4cd34c]/40 bg-[#4cd34c]/10 py-2.5 text-xs font-bold text-[#4cd34c] hover:bg-[#4cd34c] hover:text-[#071007] transition flex items-center justify-center gap-1.5"
          >
            <span>💾 Save Selection as Private Snippet</span>
          </button>
        )}
      </div>

      {/* Save Selection as Snippet Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <form
            onSubmit={handleSaveAsSnippet}
            className="w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4"
            style={{ borderColor: "#4cd34c", backgroundColor: "var(--panel-bg)" }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: "var(--field-border)" }}>
              <div className="flex items-center gap-2">
                <span className="text-xl">💾</span>
                <h3 className="font-bold text-base text-[var(--app-text)]">Save Selection as Snippet</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="text-xs font-bold text-[var(--text-muted)] hover:text-white"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold block mb-1" style={{ color: "var(--text-muted)" }}>
                Snippet Name / Title *
              </label>
              <input
                type="text"
                required
                value={snippetTitle}
                onChange={(e) => setSnippetTitle(e.target.value)}
                placeholder="e.g. Welcome Greeting Snippet"
                className="w-full rounded-xl border p-2.5 text-xs font-semibold focus:outline-none focus:border-[#4cd34c]"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
              />
            </div>

            <div>
              <label className="text-[11px] uppercase font-bold block mb-1" style={{ color: "var(--text-muted)" }}>
                Snippet Content Preview
              </label>
              <div
                className="p-3 rounded-xl border font-mono text-xs max-h-32 overflow-y-auto break-words [overflow-wrap:anywhere]"
                style={{ borderColor: "var(--field-border)", backgroundColor: "var(--app-bg)", color: "var(--app-text)" }}
              >
                {effectiveCopyMsg}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 rounded-xl border text-xs font-semibold hover:bg-[var(--neutral-bg)]"
                style={{ borderColor: "var(--field-border)", color: "var(--text-muted)" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSnippet}
                className="px-5 py-2 rounded-xl bg-[#4cd34c] text-black font-bold text-xs shadow-md hover:opacity-90 transition"
              >
                {savingSnippet ? "Saving..." : "Save Snippet"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
