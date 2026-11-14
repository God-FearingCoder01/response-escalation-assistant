import { useEffect, useRef, useState } from "react";
import { ASK_REA_LIMITS } from "../services/askReaService";

const MODES = [
  { id: "reply", label: "Draft reply", hint: "A message you can send to the customer" },
  { id: "advice", label: "Get advice", hint: "What to check, say and avoid" },
  { id: "escalation", label: "Draft escalation", hint: "A clear note for the technical team" },
];

const CHANNELS = [
  { id: "", label: "Any channel" },
  { id: "chat", label: "Live chat" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "email", label: "Email" },
  { id: "social", label: "Social media" },
];

const EXAMPLES = [
  "A customer is upset that their issue has been open for three days. Help me write a calm reply.",
  "The customer says they were charged twice. What should I check before replying?",
  "Write an escalation for a customer whose connection drops every evening.",
];

const KIND_LABELS = { NAME: "name", EMAIL: "email", PHONE: "phone", REF: "reference", CARD: "card", ID: "ID" };

function describeRedactions(redactions = {}) {
  const total = Object.values(redactions).reduce((sum, count) => sum + count, 0);
  if (!total) return "";
  const kinds = Object.keys(redactions)
    .map((kind) => KIND_LABELS[kind] || kind.toLowerCase())
    .join(", ");
  return `${total} private detail${total === 1 ? "" : "s"} hidden from the AI (${kinds})`;
}

export default function AskREAScreen({ askReaState, copyText, showToast }) {
  const {
    messages = [],
    mode,
    setMode,
    channel,
    setChannel,
    hideTermsText,
    setHideTermsText,
    isLoading,
    error,
    status,
    remaining,
    send,
    clearConversation,
  } = askReaState || {};

  const [input, setInput] = useState("");
  const [copiedIndex, setCopiedIndex] = useState(null);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages.length, isLoading]);

  const disabled = status?.enabled === false;
  const tooLong = input.length > ASK_REA_LIMITS.maxMessageChars;
  const canSend = !disabled && !isLoading && input.trim().length > 0 && !tooLong;

  const submit = async (override) => {
    const text = typeof override === "string" ? override : input;
    if (!text.trim() || disabled || isLoading) return;
    setInput("");
    const ok = await send?.(text);
    if (!ok) setInput((current) => current || text); // give the text back so it can be retried
    inputRef.current?.focus();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) submit();
    }
  };

  const handleCopy = (content, index) => {
    copyText?.(content);
    showToast?.("Copied to clipboard");
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex((current) => (current === index ? null : current)), 2000);
  };

  const panelStyle = { borderColor: "var(--panel-border)", backgroundColor: "var(--panel-bg)" };
  const fieldStyle = { borderColor: "var(--field-border)", backgroundColor: "var(--field-bg)" };
  const activeMode = MODES.find((item) => item.id === mode) || MODES[0];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 rounded-3xl border p-4 shadow-xl backdrop-blur-xl" style={panelStyle}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] shadow-lg">
            <img src="/sparkling.png" alt="" className="h-6 w-6 object-contain" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">Ask REA</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Get help wording a reply or deciding what to do next.
            </p>
          </div>
        </div>
        {messages.length > 0 ? (
          <button
            type="button"
            onClick={clearConversation}
            className="shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition hover:bg-[var(--neutral-bg)]"
            style={{ borderColor: "var(--panel-border)" }}
          >
            New chat
          </button>
        ) : null}
      </div>

      {/* Privacy note */}
      <p
        className="rounded-2xl border px-3 py-2 text-xs text-[var(--text-muted)]"
        style={panelStyle}
        role="note"
      >
        🔒 Emails, phone numbers, ID, card and reference numbers are hidden before anything leaves REA.
        Names are only hidden if you list them below. This chat is not saved and clears when you sign out.
      </p>

      {disabled ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm" role="alert">
          Ask REA is not switched on for this workspace yet. Please ask your administrator to enable it.
        </div>
      ) : null}

      {/* Controls */}
      <div className="space-y-3 rounded-3xl border p-4 shadow-xl backdrop-blur-xl" style={panelStyle}>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What do you need?">
          {MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={mode === item.id}
              title={item.hint}
              onClick={() => setMode?.(item.id)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                mode === item.id
                  ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007] shadow-md"
                  : "bg-[var(--neutral-bg)] text-[var(--neutral-text)] hover:opacity-80"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[var(--text-muted)]">{activeMode.hint}</p>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Where will you send it?
            <select
              value={channel}
              onChange={(event) => setChannel?.(event.target.value)}
              disabled={mode === "advice"}
              className="rounded-xl border px-3 py-2 text-sm font-normal outline-none disabled:opacity-50"
              style={fieldStyle}
            >
              {CHANNELS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Names to hide (comma separated)
            <input
              type="text"
              value={hideTermsText}
              onChange={(event) => setHideTermsText?.(event.target.value)}
              placeholder="e.g. Tendai Moyo, Moyo"
              className="rounded-xl border px-3 py-2 text-sm font-normal outline-none"
              style={fieldStyle}
              autoComplete="off"
            />
          </label>
        </div>
      </div>

      {/* Conversation */}
      <div
        className="min-h-[12rem] space-y-3 rounded-3xl border p-4 shadow-xl backdrop-blur-xl"
        style={panelStyle}
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Describe the customer&apos;s issue and what you need. Try one of these:
            </p>
            <div className="flex flex-col gap-2">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  disabled={disabled || isLoading}
                  onClick={() => setInput(example)}
                  className="rounded-2xl border px-3 py-2 text-left text-xs transition hover:bg-[var(--neutral-bg)] disabled:opacity-50"
                  style={{ borderColor: "var(--panel-border)" }}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const isUser = message.role === "user";
            const note = !isUser ? describeRedactions(message.redactions) : "";
            return (
              <div key={index} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm shadow ${
                    isUser ? "bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] text-[#071007]" : "border"
                  }`}
                  style={isUser ? undefined : { borderColor: "var(--panel-border)", backgroundColor: "var(--app-bg)" }}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  {!isUser ? (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
                      <span>
                        {message.provider ? `Answered by ${message.provider}` : "Answer"}
                        {note ? ` · ${note}` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(message.content, index)}
                        className="rounded-lg bg-[var(--neutral-bg)] px-2.5 py-1 font-bold text-[var(--neutral-text)] transition hover:opacity-80"
                      >
                        {copiedIndex === index ? "Copied ✓" : "Copy"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}

        {isLoading ? (
          <div className="flex justify-start">
            <div
              className="rounded-2xl border px-3.5 py-2.5 text-sm text-[var(--text-muted)]"
              style={{ borderColor: "var(--panel-border)", backgroundColor: "var(--app-bg)" }}
            >
              Thinking…
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm" role="alert">
          {error}
        </div>
      ) : null}

      {/* Composer */}
      <div className="space-y-2 rounded-3xl border p-4 shadow-xl backdrop-blur-xl" style={panelStyle}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={4}
          disabled={disabled}
          placeholder={
            disabled
              ? "Ask REA is not available."
              : "Describe the issue and what you need. Press Enter to send, Shift+Enter for a new line."
          }
          className="w-full resize-y rounded-2xl border px-3 py-2 text-sm outline-none disabled:opacity-50"
          style={fieldStyle}
          aria-label="Your question for Ask REA"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`text-[11px] ${tooLong ? "font-bold text-red-500" : "text-[var(--text-muted)]"}`}>
            {input.length}/{ASK_REA_LIMITS.maxMessageChars}
            {remaining !== null && remaining !== undefined ? ` · ${remaining} asks left this hour` : ""}
          </span>
          <button
            type="button"
            onClick={() => submit()}
            disabled={!canSend}
            className="rounded-xl bg-[linear-gradient(135deg,#4cd34c_0%,#0f9b00_100%)] px-5 py-2 text-sm font-bold text-[#071007] shadow-md transition hover:scale-[1.02] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isLoading ? "Sending…" : "Ask REA"}
          </button>
        </div>
        <p className="text-[11px] text-[var(--text-muted)]">
          AI can get things wrong. Check every reply, and confirm facts such as policy or amounts, before you send it.
        </p>
      </div>
    </div>
  );
}
