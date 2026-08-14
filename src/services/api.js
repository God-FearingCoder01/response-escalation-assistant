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
  // Customer Reply Templates
  {
    id: 5,
    name: "Standard Welcome Greeting",
    body: "Hi {customer_name}, my name is {agent_name} from Customer Support. How may I assist you today?",
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
  { id: 1, agent: "System Administrator", agent_name: "Sys_Admin", agent_initials: "SA", is_admin: true },
  { id: 2, agent: "Chris Whyt", agent_name: "Chris", agent_initials: "CW", is_admin: false },
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

export function getDateAutoValues() {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const y = String(now.getFullYear());
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const monthName = now.toLocaleString("default", { month: "long" });

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
    time: `${h}:${min}`,
    time_24: `${h}:${min}`,
    time24: `${h}:${min}`,
    time_24h: `${h}:${min}`,
    time24h: `${h}:${min}`,
    time_24_hour: `${h}:${min}`,
    time_24hour: `${h}:${min}`,
    hh: h,
    min: min,
    minute: min,
    minutes: min,
  };
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

export async function createCompanyApi(payload) {
  const res = await fetch(`${API_BASE}/companies`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAdminHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.detail || "Failed to create company");
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
    throw new Error(errData?.detail || "Failed to update company");
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
    throw new Error(errData?.detail || "Invalid Super Admin PIN");
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
    throw new Error(errData?.detail || "Email verification failed");
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
    throw new Error(errData?.detail || "Failed to reset Super Admin PIN");
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
    throw new Error(errData?.detail || "Failed to update Super Admin settings");
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
    throw new Error(errData?.detail || "Failed to reset Company Admin PIN");
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
    throw new Error(errData?.detail || "Failed to create template");
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
    throw new Error(errData?.detail || "Failed to update template");
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
    throw new Error(errData?.detail || "Failed to delete template");
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
    throw new Error(errData?.detail || "Import failed");
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
    throw new Error(errData?.detail || "Failed to create agent");
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
    throw new Error(errData?.detail || "Failed to update agent");
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
    throw new Error(errData?.detail || "Failed to delete agent");
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
    throw new Error(errData?.detail || "Failed to submit suggestion");
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
    throw new Error(errData?.detail || "Approval failed");
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
    throw new Error(errData?.detail || "Rejection failed");
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
