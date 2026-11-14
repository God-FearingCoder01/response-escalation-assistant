import { useCallback, useEffect, useRef, useState } from "react";
import { ASK_REA_LIMITS, askRea, fetchAskReaStatus } from "../services/askReaService";

export function parseHideTerms(raw) {
  return [
    ...new Set(
      String(raw || "")
        .split(/[,\n;]+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 2)
        .map((term) => term.slice(0, 60))
    ),
  ].slice(0, ASK_REA_LIMITS.maxHideTerms);
}

// Keep the newest messages that fit the server's limits. Older turns drop off first.
export function trimConversation(messages) {
  const trimmed = [];
  let total = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const length = messages[i].content.length;
    if (trimmed.length >= ASK_REA_LIMITS.maxMessages) break;
    if (total + length > ASK_REA_LIMITS.maxTotalChars) break;
    trimmed.unshift(messages[i]);
    total += length;
  }
  // The server requires the conversation to start from something the agent said.
  while (trimmed.length > 1 && trimmed[0].role !== "user") trimmed.shift();
  return trimmed;
}

export function useAskRea({ currentAgent = null } = {}) {
  const agentInitials = currentAgent?.agent_initials?.toUpperCase() || null;

  // The conversation is kept in memory only. Nothing a customer said is written to
  // localStorage or the database, and it is cleared when the agent changes or signs out.
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState("reply");
  const [channel, setChannel] = useState("");
  const [hideTermsText, setHideTermsText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState({ enabled: null, hourly_limit: null });
  const [remaining, setRemaining] = useState(null);
  const requestId = useRef(0);

  useEffect(() => {
    requestId.current += 1; // ignore any answer still in flight for the previous agent
    setMessages([]);
    setHideTermsText("");
    setError("");
    setRemaining(null);
    setIsLoading(false);
    setStatus({ enabled: null, hourly_limit: null });
    if (!agentInitials) return undefined;
    let active = true;
    fetchAskReaStatus().then((result) => {
      if (active) setStatus(result);
    });
    return () => {
      active = false;
    };
  }, [agentInitials]);

  const send = useCallback(
    async (text) => {
      const content = String(text || "").trim();
      if (!content || isLoading) return false;
      if (content.length > ASK_REA_LIMITS.maxMessageChars) {
        setError(`Please keep each message under ${ASK_REA_LIMITS.maxMessageChars} characters.`);
        return false;
      }

      const userMessage = { role: "user", content };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setError("");
      setIsLoading(true);
      const myRequest = ++requestId.current;

      try {
        const result = await askRea({
          mode,
          channel,
          messages: trimConversation(nextMessages).map(({ role, content: body }) => ({ role, content: body })),
          hideTerms: parseHideTerms(hideTermsText),
        });
        if (myRequest !== requestId.current) return false;
        setMessages((current) => [
          ...current,
          {
            role: "assistant",
            content: result.reply,
            provider: result.provider,
            redactions: result.redactions || {},
          },
        ]);
        if (typeof result.remaining_requests === "number") setRemaining(result.remaining_requests);
        return true;
      } catch (err) {
        if (myRequest !== requestId.current) return false;
        // Remove the unanswered question so the history never holds two agent turns in a
        // row; the screen puts its text back in the box so the agent can simply retry.
        setMessages((current) => current.filter((message) => message !== userMessage));
        setError(err instanceof Error ? err.message : "Ask REA could not answer right now.");
        if (err?.status === 429) setRemaining(0);
        return false;
      } finally {
        if (myRequest === requestId.current) setIsLoading(false);
      }
    },
    [messages, mode, channel, hideTermsText, isLoading]
  );

  const clearConversation = useCallback(() => {
    requestId.current += 1;
    setMessages([]);
    setError("");
    setIsLoading(false);
  }, []);

  return {
    messages,
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
  };
}
