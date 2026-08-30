import { useState, useEffect, useMemo, useRef } from "react";
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
  replyChannel,
  setReplyChannel,
  currentAgent,
}) {
  const [isFullMessage, setIsFullMessage] = useState(true);
  const [checkedIndexes, setCheckedIndexes] = useState([]);
  const [savingSnippet, setSavingSnippet] = useState(false);
  const [snippetTitle, setSnippetTitle] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Parse generatedMsg into sentence objects while preserving trailing newlines/whitespace
  const parsedSentences = useMemo(() => {
    if (!generatedMsg || typeof generatedMsg !== "string") return [];
    const regex = /([^.!?\n]+[.!?\n]*)([\s\n]*)/g;
    const result = [];
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(generatedMsg)) !== null) {
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
      const sentenceText = match[1];
      const trailingSpace = match[2];

      if (sentenceText.trim()) {
        result.push({
          text: sentenceText.trim(),
          raw: sentenceText,
          spacing: trailingSpace,
        });
      } else if (trailingSpace && result.length > 0) {
        result[result.length - 1].spacing += trailingSpace;
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < generatedMsg.length) {
      const remainder = generatedMsg.slice(lastIndex);
      if (remainder.trim()) {
        result.push({
          text: remainder.trim(),
          raw: remainder,
          spacing: "",
        });
      } else if (remainder && result.length > 0) {
        result[result.length - 1].spacing += remainder;
      }
    }

    return result.length > 0 ? result : [{ text: generatedMsg, raw: generatedMsg, spacing: "" }];
  }, [generatedMsg]);

  // Backward compatibility alias
  const sentences = parsedSentences;

  // Only reset checked indexes when the template itself changes, NOT when replyChannel switches
  const prevTemplateIdRef = useRef(activeTemplate?.id);
  useEffect(() => {
    if (activeTemplate?.id !== prevTemplateIdRef.current) {
      prevTemplateIdRef.current = activeTemplate?.id;
      if (parsedSentences.length > 0) {
        setCheckedIndexes(parsedSentences.map((_, idx) => idx));
      } else {
        setCheckedIndexes([]);
      }
    } else if (parsedSentences.length > 0 && checkedIndexes.length === 0 && !isFullMessage) {
      // Keep valid bounds
      setCheckedIndexes(parsedSentences.map((_, idx) => idx));
    }
  }, [activeTemplate?.id, parsedSentences]);

  // Calculate effective text preserving original line breaks and spacing
  const effectiveCopyMsg = useMemo(() => {
    if (!generatedMsg) return "";
    if (isFullMessage) return generatedMsg;
    if (parsedSentences.length > 0) {
      const selected = parsedSentences.filter((_, idx) => checkedIndexes.includes(idx));
      return selected.map((item) => item.raw + item.spacing).join("").trim();
    }
    return generatedMsg;
  }, [generatedMsg, isFullMessage, parsedSentences, checkedIndexes]);

  const handleCopy = () => {
    if (!effectiveCopyMsg) return;
    const msgType = !isFullMessage && checkedIndexes.length < parsedSentences.length ? "Selected sentences copied! 📋" : "Quick message copied to clipboard! 📋";
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
      {/* Header Bar with Full Message Radio Toggle & Sentence Controls */}
      {generatedMsg && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2" style={{ borderColor: "var(--field-border)" }}>
          {/* Full Message Radio Toggle Button */}
          <button
            type="button"
            onClick={() => setIsFullMessage((prev) => !prev)}
            className="flex items-center gap-2 cursor-pointer group py-0.5 select-none"
            title={isFullMessage ? "Click to enable interactive sentence picker" : "Click to select Full Message"}
          >
            <div
              className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all ${
                isFullMessage
                  ? "border-[#4cd34c] bg-[#4cd34c]/20"
                  : "border-gray-500 bg-transparent group-hover:border-gray-400"
              }`}
            >
              <div
                className={`h-2 w-2 rounded-full transition-all ${
                  isFullMessage ? "bg-[#4cd34c] scale-100" : "bg-gray-500 scale-75 opacity-60"
                }`}
              />
            </div>
            <span className={`text-xs font-bold transition-colors ${isFullMessage ? "text-[#4cd34c]" : "text-[var(--text-muted)] group-hover:text-[var(--app-text)]"}`}>
              Full Message
            </span>
          </button>

          {/* Interactive Sentence Controls (Visible when Full Message is OFF) */}
          {!isFullMessage && parsedSentences.length > 1 && (
            <div className="flex items-center gap-3 text-xs font-semibold animate-fade-in">
              <span className="text-[10px] font-bold text-[#4cd34c] bg-[#4cd34c]/10 border border-[#4cd34c]/30 px-2 py-0.5 rounded-full">
                {checkedIndexes.length} of {parsedSentences.length} selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCheckedIndexes(parsedSentences.map((_, i) => i))}
                  className="text-[11px] text-[#4cd34c] hover:underline font-bold cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-[var(--text-muted)]">•</span>
                <button
                  type="button"
                  onClick={() => setCheckedIndexes([])}
                  className="text-[11px] text-[var(--text-muted)] hover:text-red-400 hover:underline cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Live Preview Box */}
      <div
        className="rounded-2xl border p-4 min-h-[10rem] max-h-[22rem] overflow-y-auto break-words [overflow-wrap:anywhere] font-mono text-sm leading-relaxed"
        style={{ borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)", color: "var(--app-text)" }}
      >
        {!generatedMsg ? (
          <span style={{ color: "var(--field-placeholder)" }}>Select a template to preview response...</span>
        ) : !isFullMessage && parsedSentences.length > 1 ? (
          <div className="font-mono text-sm leading-relaxed whitespace-pre-wrap select-none">
            {parsedSentences.map((item, idx) => {
              const isSelected = checkedIndexes.includes(idx);
              return (
                <span key={idx}>
                  <span
                    onClick={() => {
                      if (isSelected) {
                        setCheckedIndexes(checkedIndexes.filter((i) => i !== idx));
                      } else {
                        setCheckedIndexes([...checkedIndexes, idx]);
                      }
                    }}
                    title={`Click to ${isSelected ? "exclude" : "include"} this sentence`}
                    className={`transition-all duration-150 cursor-pointer inline rounded px-1 py-0.5 ${
                      isSelected
                        ? "hover:bg-[#4cd34c]/25 hover:text-[#4cd34c] hover:underline"
                        : "opacity-40 grayscale line-through bg-gray-500/10 hover:opacity-75 hover:bg-gray-500/20"
                    }`}
                  >
                    {item.raw}
                  </span>
                  {item.spacing}
                </span>
              );
            })}
          </div>
        ) : (
          <span className="font-mono text-sm leading-relaxed whitespace-pre-wrap">{generatedMsg}</span>
        )}
      </div>

      {generatedMsg && !isFullMessage && sentences.length > 1 && (
        <p className="text-[11px] italic opacity-70 flex items-center gap-1" style={{ color: "var(--text-muted)" }}>
          <span>💡</span>
          <span>Hover over any sentence in the message preview above & click to toggle inclusion.</span>
        </p>
      )}

      {/* Primary Copy & Save Snippet Actions */}
      <div className="space-y-2 pt-2">
        <div className="relative" ref={dropdownRef}>
          <div className="flex w-full rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] shadow-lg overflow-hidden transition hover:opacity-95">
            {/* Main Clickable Area */}
            <button
              type="button"
              onClick={handleCopy}
              disabled={!effectiveCopyMsg}
              className="flex-1 py-3 px-4 font-semibold text-[#071007] disabled:opacity-50 transition flex items-center justify-center gap-2 outline-none select-none text-sm md:text-base cursor-pointer"
            >
              {replyChannel === "signed" ? (
                <>
                  <img src="/signed.png" alt="Signed" className="h-5 w-5 shrink-0 object-contain" />
                  <span>Copy Message Text (Signed)</span>
                </>
              ) : replyChannel === "unsigned" ? (
                <>
                  <img src="/unsigned.png" alt="Unsigned" className="h-5 w-5 shrink-0 object-contain" />
                  <span>Copy Message Text (Unsigned)</span>
                </>
              ) : (
                <span>Copy Message Text 📋</span>
              )}

              {!isFullMessage && sentences.length > 1 && checkedIndexes.length < sentences.length && (
                <span className="text-xs bg-black/20 px-2 py-0.5 rounded-full font-bold">
                  ({checkedIndexes.length} of {sentences.length} sentences)
                </span>
              )}
            </button>

            {/* Dropdown Arrow Toggle Button */}
            {setReplyChannel && (
              <button
                type="button"
                onClick={() => setDropdownOpen((prev) => !prev)}
                disabled={!effectiveCopyMsg}
                className="px-3.5 border-l border-black/20 text-[#071007] hover:bg-black/10 transition flex items-center justify-center outline-none select-none cursor-pointer"
                title="Change Signed / Unsigned Option"
              >
                <span className={`text-xs font-bold transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}>
                  ▼
                </span>
              </button>
            )}
          </div>

          {/* Dropdown Popup Menu */}
          {dropdownOpen && setReplyChannel && (
            <div
              className="absolute right-0 mt-2 w-64 rounded-2xl border p-2 shadow-2xl z-50 animate-fade-in backdrop-blur-md"
              style={{ borderColor: "#4cd34c", backgroundColor: "var(--panel-bg)" }}
            >
              <div className="px-2 py-1.5 border-b mb-1" style={{ borderColor: "var(--field-border)" }}>
                <span className="text-[10px] uppercase font-extrabold tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Select Response Format Option:
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setReplyChannel("signed");
                  setDropdownOpen(false);
                }}
                className={`w-full p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between gap-2 text-left mb-1.5 cursor-pointer ${
                  replyChannel === "signed"
                    ? "border-[#4cd34c] bg-[#4cd34c]/20 text-[#4cd34c]"
                    : "hover:bg-[var(--field-bg)] border-transparent text-[var(--app-text)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <img src="/signed.png" alt="Signed" className="h-4 w-4 shrink-0 object-contain" />
                  <div className="flex flex-col">
                    <span className="font-bold">Signed</span>
                    <span className="text-[10px] font-mono opacity-80">
                      (^{currentAgent?.agent_initials || "Initials"})
                    </span>
                  </div>
                </div>
                {replyChannel === "signed" && <span className="text-xs font-black text-[#4cd34c]">✓</span>}
              </button>

              <button
                type="button"
                onClick={() => {
                  setReplyChannel("unsigned");
                  setDropdownOpen(false);
                }}
                className={`w-full p-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-between gap-2 text-left cursor-pointer ${
                  replyChannel === "unsigned"
                    ? "border-[#4cd34c] bg-[#4cd34c]/20 text-[#4cd34c]"
                    : "hover:bg-[var(--field-bg)] border-transparent text-[var(--app-text)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <img src="/unsigned.png" alt="Unsigned" className="h-4 w-4 shrink-0 object-contain" />
                  <div className="flex flex-col">
                    <span className="font-bold">Unsigned</span>
                    <span className="text-[10px] font-mono opacity-80">(Plain Text)</span>
                  </div>
                </div>
                {replyChannel === "unsigned" && <span className="text-xs font-black text-[#4cd34c]">✓</span>}
              </button>
            </div>
          )}
        </div>

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
