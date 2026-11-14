import { useCallback, useEffect, useRef, useState } from "react";
import { ASK_REA_LIMITS, askRea, fetchAskReaStatus } from "../services/askReaService";
import { IMAGE_LIMITS, prepareImage, withImageBudget } from "../utils/imageAttachments";

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
  const [attachments, setAttachments] = useState([]);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const requestId = useRef(0);
  const attachmentCount = useRef(0);

  useEffect(() => {
    requestId.current += 1; // ignore any answer still in flight for the previous agent
    setMessages([]);
    setHideTermsText("");
    setError("");
    setRemaining(null);
    setIsLoading(false);
    setAttachments([]);
    setIsPreparingImage(false);
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

  // Accepts File objects (pasted, dropped or picked). Shrinks each one and keeps it in memory.
  const addImages = useCallback(async (files) => {
    const incoming = Array.from(files || []);
    if (!incoming.length) return;
    setError("");
    setIsPreparingImage(true);
    try {
      for (const file of incoming) {
        if (attachmentCount.current >= IMAGE_LIMITS.maxImages) {
          setError(`You can attach up to ${IMAGE_LIMITS.maxImages} screenshots.`);
          break;
        }
        try {
          const image = await prepareImage(file);
          attachmentCount.current += 1;
          setAttachments((current) => [...current, { ...image, id: `${Date.now()}-${attachmentCount.current}-${Math.random()}` }]);
        } catch (err) {
          setError(err instanceof Error ? err.message : "That image could not be attached.");
        }
      }
    } finally {
      setIsPreparingImage(false);
    }
  }, []);

  const removeAttachment = useCallback((id) => {
    setAttachments((current) => {
      const next = current.filter((item) => item.id !== id);
      attachmentCount.current = next.length;
      return next;
    });
  }, []);

  const send = useCallback(
    async (text) => {
      const typed = String(text || "").trim();
      // A screenshot on its own is a fair question: "what does this show?"
      const content = typed || (attachments.length ? "Please look at the attached screenshot and tell me what it shows and what I should do." : "");
      if (!content || isLoading || isPreparingImage) return false;
      if (content.length > ASK_REA_LIMITS.maxMessageChars) {
        setError(`Please keep each message under ${ASK_REA_LIMITS.maxMessageChars} characters.`);
        return false;
      }

      const sentImages = attachments;
      const userMessage = { role: "user", content, images: sentImages, hadImages: sentImages.length };
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setAttachments([]);
      attachmentCount.current = 0;
      setError("");
      setIsLoading(true);
      const myRequest = ++requestId.current;

      try {
        const result = await askRea({
          mode,
          channel,
          messages: withImageBudget(trimConversation(nextMessages)),
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
        setAttachments((current) => (current.length ? current : sentImages)); // keep the screenshots for a retry
        attachmentCount.current = sentImages.length;
        setError(err instanceof Error ? err.message : "Ask REA could not answer right now.");
        if (err?.status === 429) setRemaining(0);
        return false;
      } finally {
        if (myRequest === requestId.current) setIsLoading(false);
      }
    },
    [messages, mode, channel, hideTermsText, isLoading, isPreparingImage, attachments]
  );

  const clearConversation = useCallback(() => {
    requestId.current += 1;
    setMessages([]);
    setAttachments([]);
    attachmentCount.current = 0;
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
    attachments,
    isPreparingImage,
    addImages,
    removeAttachment,
    send,
    clearConversation,
  };
}
