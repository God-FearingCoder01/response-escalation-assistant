// Client for the Ask REA endpoints. The browser never sees an AI provider key: it only
// talks to the REA backend, which holds the keys and hides customer details before
// anything is sent to an outside provider.
import { API_BASE, getCompanyHeaders, parseApiError } from "./api";

export const ASK_REA_LIMITS = {
  maxMessageChars: 4000,
  maxTotalChars: 16000,
  maxMessages: 12,
  maxHideTerms: 10,
};

const REQUEST_TIMEOUT_MS = 60000;

export async function fetchAskReaStatus() {
  try {
    const res = await fetch(`${API_BASE}/ask-rea/status`, { headers: getCompanyHeaders() });
    if (!res.ok) return { enabled: false, hourly_limit: null };
    return await res.json();
  } catch {
    return { enabled: false, hourly_limit: null };
  }
}

export async function askRea({ mode, channel, messages, hideTerms }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}/ask-rea`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...getCompanyHeaders() },
      body: JSON.stringify({
        mode,
        channel: channel || null,
        messages,
        hide_terms: hideTerms,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      const error = new Error(parseApiError(errData, "Ask REA could not answer right now."));
      error.status = res.status;
      throw error;
    }
    return await res.json();
  } catch (err) {
    if (err?.status) throw err;
    if (err?.name === "AbortError") {
      throw new Error("Ask REA took too long to answer. Please try again.");
    }
    throw new Error("Could not reach the REA server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}
