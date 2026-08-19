export const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8000";
    }
    return window.location.origin;
  }
  return "http://localhost:8000";
};

export const API_BASE = getApiBase();
export const THEME_KEY = "rea_theme_v1";
export const AGENT_KEY = "rea_active_agent_v1";
export const ADMIN_TOKEN_KEY = "rea_admin_token_v1";
export const ADMIN_INITIALS_KEY = "rea_admin_initials_v1";
export const COMPANY_KEY = "rea_active_company_id_v1";

export function getCompanyHeaders() {
  if (typeof window === "undefined") return {};
  const companyId = localStorage.getItem(COMPANY_KEY);
  const headers = {};
  if (companyId) headers["X-Company-ID"] = companyId;
  return headers;
}

export function getAdminHeaders() {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem(ADMIN_TOKEN_KEY);
  const initials = localStorage.getItem(ADMIN_INITIALS_KEY);
  const companyId = localStorage.getItem(COMPANY_KEY);
  const headers = {};
  if (token) headers["X-Admin-Token"] = token;
  if (initials) headers["X-Admin-Initials"] = initials;
  if (companyId) headers["X-Company-ID"] = companyId;
  return headers;
}

export const DEFAULT_TEMPLATES = [
  // Tech Escalation Templates
  {
    id: 1,
    name: "Self Exclusion",
    body: "Account {customer_name} is requesting to be removed from self exclusion.",
    category_type: "tech_escalation",
    category: "Account Escalations",
    subcategory: "Self Exclusion",
  },
  {
    id: 2,
    name: "Account Verification",
    body: "Account {account_number} is facing error code 146, kindly assist.",
    category_type: "tech_escalation",
    category: "Account Escalations",
    subcategory: "Verification",
  },
  {
    id: 3,
    name: "Permanent Deactivation",
    body: "User {account_number} has requested for the permanent deactivation of his account because {reason}.",
    category_type: "tech_escalation",
    category: "Account Escalations",
    subcategory: "Deactivation",
  },
  {
    id: 4,
    name: "Processing Withdrawal",
    body: "Processing withdrawal of ${amount} from account number {account_number}; on {day}.{month}.2026 time {time}hrs.",
    category_type: "tech_escalation",
    category: "Payment Escalations",
    subcategory: "Withdrawal",
  },
  {
    id: 5,
    name: "Big Five Game Free Spins Escalation",
    body: "Account number {account_number} completed {animal?} on Big Five but has not seen his free spins on {:game}",
    category_type: "tech_escalation",
    category: "Game Escalations",
    subcategory: "Free Spins",
    placeholder_config: JSON.stringify({
      "animal?": {
        control_type: "combobox",
        mapped_target: ":game",
        options: ["Elephant", "Rhino", "Lion", "Buffalo", "Leopard"],
        mapping: {
          Elephant: "Big Game Slot",
          Rhino: "Stampede Slot",
          Lion: "King Jungle Slot",
          Buffalo: "Buffalo Gold",
          Leopard: "Leopard Riches",
        },
      },
    }),
  },
  // Customer Reply Templates
  {
    id: 5,
    name: "Standard Welcome Greeting",
    body: "Good {greeting} {customer_name}, my name is {agent_name} from Customer Support. How may I assist you today?",
    category_type: "customer_reply",
    category: "Agent Introductions",
    subcategory: "Welcome",
  },
  {
    id: 6,
    name: "Follow-up Response Greeting",
    body: "Hello {customer_name}, thank you for reaching back out. I'm {agent_name} and I'll be glad to continue assisting you.",
    category_type: "customer_reply",
    category: "Agent Introductions",
    subcategory: "Follow-up",
  },
  {
    id: 7,
    name: "Deposit Under Review",
    body: "Hi {customer_name}, your deposit of ${amount} is currently being processed by our financial partner. Reference: {reference_no}.",
    category_type: "customer_reply",
    category: "Transactions",
    subcategory: "Deposit",
  },
  {
    id: 8,
    name: "Withdrawal Status Update",
    body: "Hi {customer_name}, your withdrawal request for ${amount} (Ref: {reference_no}) has been approved and sent to your account.",
    category_type: "customer_reply",
    category: "Transactions",
    subcategory: "Withdrawal",
  },
  {
    id: 9,
    name: "Password Reset Instructions",
    body: "Hi {customer_name}, a password reset link has been dispatched to your registered email address. Please follow the instructions to secure your account.",
    category_type: "customer_reply",
    category: "Security",
    subcategory: "Password Reset",
  },
  {
    id: 10,
    name: "KYC Document Request",
    body: "Hi {customer_name}, to complete your account verification, please upload your proof of ID and address in the portal.",
    category_type: "customer_reply",
    category: "Security",
    subcategory: "Verification",
  },
  {
    id: 11,
    name: "Game Cache Troubleshooting",
    body: "Hi {customer_name}, if you're experiencing display issues with {game_title}, please clear your browser cache or switch to Google Chrome.",
    category_type: "customer_reply",
    category: "Games",
    subcategory: "Troubleshooting",
  },
];

export const DEFAULT_AGENTS = [
  { id: 1, agent: "System Administrator", agent_name: "Sys_Admin", agent_initials: "SA", is_admin: true, is_active: true },
  { id: 2, agent: "Chris Whyt", agent_name: "Chris", agent_initials: "CW", is_admin: false, is_active: true },
];

export function generateInitials(name) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.map((p) => p[0]).join("").slice(0, 3).toUpperCase();
}

export function escapeForTelegramMarkdownV2(text) {
  if (!text) return "";
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

export function formatDateTimeString(val, controlType = "text", dateFormat = "") {
  if (val === null || val === undefined) return "";
  const strVal = String(val).trim();
  if (!strVal) return "";

  // Guard: If controlType is not explicitly a date/time picker, return raw text value directly
  if (!["date", "time", "datetime"].includes(controlType)) {
    return strVal;
  }

  // Enforce no colons for Time Picker (time only) control
  if (controlType === "time") {
    return strVal.replace(/:/g, "");
  }

  // Check if string matches YYYY-MM-DD, DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY, or ISO datetime
  const dtMatch = strVal.match(/^(?:(\d{4})[-/.](d{2})[-/.](d{2})|(\d{2})[/.-](\d{2})[/.-](\d{4}))(?:[T\s](\d{2}):?(\d{2}))?/);

  let YYYY = "2026", MM = "01", DD = "01", HH = "00", mm = "00";
  if (dtMatch) {
    if (dtMatch[1]) {
      YYYY = dtMatch[1];
      MM = dtMatch[2];
      DD = dtMatch[3];
      if (dtMatch[7]) HH = dtMatch[7];
      if (dtMatch[8]) mm = dtMatch[8];
    } else if (dtMatch[4]) {
      DD = dtMatch[4];
      MM = dtMatch[5];
      YYYY = dtMatch[6];
      if (dtMatch[7]) HH = dtMatch[7];
      if (dtMatch[8]) mm = dtMatch[8];
    }
  } else {
    // If the input value is non-date text (e.g., agent name, customer name, manual text), return as-is
    const isNumericOnly = /^\d+$/.test(strVal.replace(/[/.:-]/g, ""));
    const isDateParsable = !isNaN(Date.parse(strVal));
    if (!isNumericOnly && !isDateParsable) {
      return strVal;
    }
    // Fallback extraction from system date if raw string doesn't match full ISO pattern
    const now = new Date();
    YYYY = String(now.getFullYear());
    MM = String(now.getMonth() + 1).padStart(2, "0");
    DD = String(now.getDate()).padStart(2, "0");
    HH = String(now.getHours()).padStart(2, "0");
    mm = String(now.getMinutes()).padStart(2, "0");
  }

  if (dateFormat && dateFormat !== "default") {
    let out = dateFormat;
    out = out.replace(/YYYY/g, YYYY);
    out = out.replace(/MM/g, MM);
    out = out.replace(/DD/g, DD);
    out = out.replace(/HH/g, HH);
    out = out.replace(/mm/g, mm);
    if (controlType === "time") {
      out = out.replace(/:/g, "");
    }
    return out;
  }

  // Enforce DD/MM/YYYY format for Date Picker (date only) control
  if (controlType === "date") {
    return `${DD}/${MM}/${YYYY}`;
  }

  return `${DD}/${MM}/${YYYY} ${HH}:${mm}`;
}

export function getDateAutoValues() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const y = String(now.getFullYear());
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const monthName = now.toLocaleString("default", { month: "long" });

  const hoursNum = now.getHours();
  let greeting = "morning";
  if (hoursNum >= 12 && hoursNum < 17) {
    greeting = "afternoon";
  } else if (hoursNum >= 17) {
    greeting = "evening";
  }
  const greetingCap = greeting.charAt(0).toUpperCase() + greeting.slice(1);

  return {
    day: d,
    date: d,
    dd: d,
    day_number: d,
    day_num: d,
    month: m,
    month_number: m,
    month_num: m,
    month_name: monthName,
    mm: m,
    year: y,
    yyyy: y,
    yy: y.slice(-2),
    time: `${h}${min}`,
    time_24: `${h}${min}`,
    time24: `${h}${min}`,
    time_24h: `${h}${min}`,
    time24h: `${h}${min}`,
    time_24_hour: `${h}${min}`,
    time_24hour: `${h}${min}`,
    hh: h,
    min: min,
    minute: min,
    minutes: min,
    greeting: greeting,
    Greeting: greetingCap,
    greeting_time: greeting,
    greeting_period: greeting,
    time_of_day: greeting,
    tod: greeting,
    good_greeting: `Good ${greeting}`,
    Good_greeting: `Good ${greetingCap}`,
  };
}

export function splitIntoSentences(text) {
  if (!text || typeof text !== "string") return [];
  const trimmed = text.trim();
  if (!trimmed) return [];
  const matches = trimmed.match(/[^.!?\n]+[.!?\n]+/g);
  if (!matches || matches.length === 0) return [trimmed];
  const sentences = matches.map((s) => s.trim()).filter(Boolean);
  
  const matchedLength = matches.reduce((acc, curr) => acc + curr.length, 0);
  if (matchedLength < trimmed.length) {
    const remainder = trimmed.slice(matchedLength).trim();
    if (remainder) sentences.push(remainder);
  }
  
  return sentences.length > 0 ? sentences : [trimmed];
}

export function resolveConditionalMappings(placeholders = [], parsedConfig = {}, values = {}) {
  const resolvedValues = { ...values };
  const mappedTargetKeys = new Set();

  // Automatically classify any target placeholders starting with ':' as mapped targets (hidden from manual input)
  (placeholders || []).forEach((p) => {
    if (p.startsWith(":")) {
      mappedTargetKeys.add(p);
    }
  });

  (placeholders || []).forEach((ph) => {
    const cfg = parsedConfig?.[ph];
    const isTrigger = ph.endsWith("?") || (Boolean(cfg?.mapped_target) && cfg.mapped_target.trim() !== "");

    if (isTrigger) {
      let targetKey = cfg?.mapped_target;
      if (!targetKey && ph.endsWith("?")) {
        const baseName = ph.replace(/\?$/, "");
        const exactMatch = (placeholders || []).find(
          (p) => p === `:${baseName}` || (p.startsWith(":") && p.slice(1) === baseName)
        );
        const firstColonTarget = (placeholders || []).find((p) => p.startsWith(":"));
        targetKey = exactMatch || firstColonTarget || `:${baseName}`;
      }

      if (targetKey && targetKey.trim() !== "") {
        mappedTargetKeys.add(targetKey);
        const triggerVal = resolvedValues[ph] ?? cfg?.options?.[0] ?? "";
        let mappedVal = "";

        if (cfg?.mapping && typeof cfg.mapping === "object" && triggerVal) {
          mappedVal = cfg.mapping[triggerVal] || "";
        } else if (Array.isArray(cfg?.options) && Array.isArray(cfg?.mapped_options) && triggerVal) {
          const idx = cfg.options.indexOf(triggerVal);
          if (idx !== -1 && cfg.mapped_options[idx]) {
            mappedVal = cfg.mapped_options[idx];
          }
        }

        // Strictly resolve from CA-predefined mapping (no hardcoded defaults)
        resolvedValues[targetKey] = mappedVal || "";
      }
    }
  });

  return { resolvedValues, mappedTargetKeys };
}

// Helper fetch wrapper checking json content-type safely
async function safeFetchJson(url, options = {}) {
  const headers = { ...getCompanyHeaders(), ...(options.headers || {}) };
  const res = await fetch(url, { ...options, headers });
  if (res.ok) {
    const ct = res.headers.get("content-type");
    if (ct && ct.includes("application/json")) {
      return await res.json();
    }
  }
  return null;
}

export async function fetchHealthApi() {
  return await safeFetchJson(`${API_BASE}/health`);
}

export async function fetchCompaniesApi() {
  return await safeFetchJson(`${API_BASE}/companies`);
}

export function parseApiError(errData, fallback = "Operation failed") {
  if (!errData) return fallback;
  if (typeof errData.detail === "string") return errData.detail;
  if (Array.isArray(errData.detail) && errData.detail.length > 0) {
    const first = errData.detail[0];
    if (typeof first?.msg === "string") return first.msg;
  }
  if (typeof errData.message === "string") return errData.message;
  return fallback;
}

export async function createCompanyApi(payload) {
  const res = await fetch(`${API_BASE}/companies`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAdminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to create company"));
  }
  return await res.json();
}

export async function updateCompanyApi(id, payload) {
  const res = await fetch(`${API_BASE}/companies/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAdminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to update company"));
  }
  return await res.json();
}

export async function fetchCompanyBySlugApi(slug) {
  return await safeFetchJson(`${API_BASE}/companies/by-slug/${encodeURIComponent(slug)}`);
}

export async function verifySuperAdminPinApi(pin) {
  const res = await fetch(`${API_BASE}/superadmin/verify-pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Invalid Super Admin PIN"));
  }
  return await res.json();
}

export async function requestSuperAdminPinResetApi(email) {
  const res = await fetch(`${API_BASE}/superadmin/request-pin-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Email verification failed"));
  }
  return await res.json();
}

export async function resetSuperAdminPinApi(token, newPin) {
  const res = await fetch(`${API_BASE}/superadmin/reset-pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, new_pin: newPin }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to reset Super Admin PIN"));
  }
  return await res.json();
}

export async function updateSuperAdminSettingsApi(payload) {
  const res = await fetch(`${API_BASE}/superadmin/update-settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAdminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to update Super Admin settings"));
  }
  return await res.json();
}

export async function resetCompanyAdminPinApi(companyId, agentId, newPin) {
  const res = await fetch(`${API_BASE}/superadmin/reset-company-admin-pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAdminHeaders() },
    body: JSON.stringify({ company_id: companyId, agent_id: agentId, new_pin: newPin }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to reset Company Admin PIN"));
  }
  return await res.json();
}

export async function fetchTemplatesApi() {
  return await safeFetchJson(`${API_BASE}/templates`);
}

export async function createTemplateApi(payload) {
  const res = await fetch(`${API_BASE}/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAdminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to create template"));
  }
  return await res.json();
}

export async function updateTemplateApi(id, payload) {
  const res = await fetch(`${API_BASE}/templates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAdminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to update template"));
  }
  return await res.json();
}

export async function deleteTemplateApi(id) {
  const res = await fetch(`${API_BASE}/templates/${id}`, {
    method: "DELETE",
    headers: { ...getAdminHeaders() },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to delete template"));
  }
  return true;
}

export async function importTemplatesApi(payload) {
  const res = await fetch(`${API_BASE}/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAdminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Import failed"));
  }
  return await res.json();
}

export async function fetchAgentsApi() {
  return await safeFetchJson(`${API_BASE}/agents`);
}

export async function createAgentApi(payload) {
  const res = await fetch(`${API_BASE}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAdminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to create agent"));
  }
  return await res.json();
}

export async function updateAgentApi(id, payload) {
  const res = await fetch(`${API_BASE}/agents/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAdminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to update agent"));
  }
  return await res.json();
}

export async function deleteAgentApi(id) {
  const res = await fetch(`${API_BASE}/agents/${id}`, {
    method: "DELETE",
    headers: { ...getAdminHeaders() },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to delete agent"));
  }
  return true;
}

export async function verifyAgentPinApi(agentInitials, pin) {
  const res = await fetch(`${API_BASE}/agents/verify-pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getCompanyHeaders() },
    body: JSON.stringify({ agent_initials: agentInitials, pin }),
  });
  if (!res.ok) return { valid: false };
  return await res.json();
}

export async function fetchSuggestionsApi() {
  return await safeFetchJson(`${API_BASE}/suggestions`);
}

export async function createSuggestionApi(payload) {
  const res = await fetch(`${API_BASE}/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getCompanyHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to submit suggestion"));
  }
  return await res.json();
}

export async function approveSuggestionApi(id) {
  const res = await fetch(`${API_BASE}/suggestions/${id}/approve`, {
    method: "POST",
    headers: { ...getAdminHeaders() },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Approval failed"));
  }
  return await res.json();
}

export async function rejectSuggestionApi(id) {
  const res = await fetch(`${API_BASE}/suggestions/${id}/reject`, {
    method: "POST",
    headers: { ...getAdminHeaders() },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Rejection failed"));
  }
  return await res.json();
}

export async function deleteSuggestionApi(id) {
  const res = await fetch(`${API_BASE}/suggestions/${id}`, {
    method: "DELETE",
    headers: { ...getAdminHeaders() },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Deletion failed"));
  }
  return await res.json();
}

export async function fetchFavoritesApi(initials) {
  return await safeFetchJson(`${API_BASE}/favorites/${initials}`);
}

export async function toggleFavoriteApi(initials, id) {
  return await safeFetchJson(`${API_BASE}/favorites/${initials}/${id}`, { method: "POST" });
}

export async function fetchHistoryApi(initials) {
  return await safeFetchJson(`${API_BASE}/history/${initials}`);
}

export async function recordHistoryApi(initials, id) {
  return await safeFetchJson(`${API_BASE}/history/${initials}/${id}`, { method: "POST" });
}

export async function createSupportRequestApi(payload) {
  const res = await fetch(`${API_BASE}/support-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to submit support request"));
  }
  return await res.json();
}

export async function fetchSupportRequestsApi() {
  return await safeFetchJson(`${API_BASE}/support-requests`, {
    headers: { ...getAdminHeaders() },
  });
}

export async function updateSupportRequestStatusApi(id, status) {
  const res = await fetch(`${API_BASE}/support-requests/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getAdminHeaders() },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to update support request status"));
  }
  return await res.json();
}

// --- SHIFT ISSUE REGISTER (SIR) API ---

export async function fetchSirShiftsApi() {
  return await safeFetchJson(`${API_BASE}/sir/shifts`, { headers: getCompanyHeaders() });
}

export async function createSirShiftApi(payload) {
  const res = await fetch(`${API_BASE}/sir/shifts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getCompanyHeaders(), ...getAdminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to create shift configuration"));
  }
  return await res.json();
}

export async function updateSirShiftApi(id, payload) {
  const res = await fetch(`${API_BASE}/sir/shifts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getCompanyHeaders(), ...getAdminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to update shift configuration"));
  }
  return await res.json();
}

export async function deleteSirShiftApi(id) {
  const res = await fetch(`${API_BASE}/sir/shifts/${id}`, {
    method: "DELETE",
    headers: { ...getCompanyHeaders(), ...getAdminHeaders() },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to delete shift configuration"));
  }
  return await res.json();
}

export async function fetchSirTargetsApi() {
  return await safeFetchJson(`${API_BASE}/sir/targets`, { headers: getCompanyHeaders() });
}

export async function createSirTargetApi(payload) {
  const res = await fetch(`${API_BASE}/sir/targets`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getCompanyHeaders(), ...getAdminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to create escalation target"));
  }
  return await res.json();
}

export async function deleteSirTargetApi(id) {
  const res = await fetch(`${API_BASE}/sir/targets/${id}`, {
    method: "DELETE",
    headers: { ...getCompanyHeaders(), ...getAdminHeaders() },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to delete escalation target"));
  }
  return await res.json();
}

export async function fetchSirIssuesApi() {
  return await safeFetchJson(`${API_BASE}/sir/issues`, { headers: getCompanyHeaders() });
}

export async function createSirIssueApi(payload) {
  const res = await fetch(`${API_BASE}/sir/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getCompanyHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to record shift issue"));
  }
  return await res.json();
}

export async function updateSirIssueApi(id, payload) {
  const res = await fetch(`${API_BASE}/sir/issues/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getCompanyHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to update shift issue"));
  }
  return await res.json();
}

export async function deleteSirIssueApi(id) {
  const res = await fetch(`${API_BASE}/sir/issues/${id}`, {
    method: "DELETE",
    headers: getCompanyHeaders(),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to delete shift issue"));
  }
  return await res.json();
}

// --- PRIVATE NOTES API ENDPOINTS ---

export async function fetchPrivateNotesApi(agentInitials) {
  const headers = { ...getCompanyHeaders() };
  if (agentInitials) headers["X-Agent-Initials"] = agentInitials;
  return await safeFetchJson(`${API_BASE}/private-notes`, { headers });
}

export async function createPrivateNoteApi(payload, agentInitials) {
  const headers = { "Content-Type": "application/json", ...getCompanyHeaders() };
  if (agentInitials) headers["X-Agent-Initials"] = agentInitials;
  const res = await fetch(`${API_BASE}/private-notes`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to create private note"));
  }
  return await res.json();
}

export async function updatePrivateNoteApi(id, payload, agentInitials) {
  const headers = { "Content-Type": "application/json", ...getCompanyHeaders() };
  if (agentInitials) headers["X-Agent-Initials"] = agentInitials;
  const res = await fetch(`${API_BASE}/private-notes/${id}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to update private note"));
  }
  return await res.json();
}

export async function deletePrivateNoteApi(id, agentInitials) {
  const headers = { ...getCompanyHeaders() };
  if (agentInitials) headers["X-Agent-Initials"] = agentInitials;
  const res = await fetch(`${API_BASE}/private-notes/${id}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to delete private note"));
  }
  return await res.json();
}

export async function trackPrivateNoteUsageApi(id) {
  const res = await fetch(`${API_BASE}/private-notes/${id}/use`, {
    method: "POST",
    headers: getCompanyHeaders(),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(parseApiError(errData, "Failed to track private note usage"));
  }
  return await res.json();
}
