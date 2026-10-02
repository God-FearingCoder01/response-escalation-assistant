import { API_BASE, getCompanyHeaders, getAdminHeaders } from "./api";

/**
 * Fetch all global variables for a given company ID.
 */
export async function fetchGlobalVariables(companyId = 1) {
  try {
    const res = await fetch(`${API_BASE}/api/global-variables?company_id=${companyId}`, {
      headers: {
        ...getCompanyHeaders(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch global variables (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    console.warn("fetchGlobalVariables failed, returning client fallback:", err);
    return getDefaultClientGlobalVariables(companyId);
  }
}

/**
 * Create a new global variable.
 */
export async function createGlobalVariable(varData) {
  const res = await fetch(`${API_BASE}/api/global-variables`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAdminHeaders(),
    },
    body: JSON.stringify(varData),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to create global variable");
  }
  return await res.json();
}

/**
 * Update an existing global variable.
 */
export async function updateGlobalVariable(varId, varData, companyId = 1) {
  const res = await fetch(`${API_BASE}/api/global-variables/${varId}?company_id=${companyId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAdminHeaders(),
    },
    body: JSON.stringify(varData),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to update global variable");
  }
  return await res.json();
}

/**
 * Delete a global variable.
 */
export async function deleteGlobalVariable(varId, companyId = 1, force = false) {
  const res = await fetch(`${API_BASE}/api/global-variables/${varId}?company_id=${companyId}&force=${force}`, {
    method: "DELETE",
    headers: {
      ...getAdminHeaders(),
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to delete global variable");
  }
  return await res.json();
}

/**
 * Fetch usage details of a global variable.
 */
export async function fetchGlobalVariableUsage(varId, companyId = 1) {
  try {
    const res = await fetch(`${API_BASE}/api/global-variables/${varId}/usage?company_id=${companyId}`, {
      headers: {
        ...getCompanyHeaders(),
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch variable usage (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    return { usage_count: 0, templates: [] };
  }
}

/**
 * Search company templates for a specific text string to migrate.
 */
export async function searchTemplatesForMigration(companyId = 1, searchText = "") {
  const res = await fetch(`${API_BASE}/api/global-variables/migration/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAdminHeaders(),
    },
    body: JSON.stringify({
      company_id: Number(companyId),
      search_text: searchText,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Template migration search failed");
  }
  return await res.json();
}

/**
 * Preview template migration transformations before applying.
 */
export async function previewTemplateMigration(companyId = 1, searchText = "", replaceText = "", templateIds = []) {
  const res = await fetch(`${API_BASE}/api/global-variables/migration/preview`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAdminHeaders(),
    },
    body: JSON.stringify({
      company_id: Number(companyId),
      search_text: searchText,
      replace_text: replaceText,
      template_ids: templateIds,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Migration preview failed");
  }
  return await res.json();
}

/**
 * Apply template migration atomically to selected templates.
 */
export async function applyTemplateMigration(companyId = 1, searchText = "", replaceText = "", templateIds = []) {
  const res = await fetch(`${API_BASE}/api/global-variables/migration/apply`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAdminHeaders(),
    },
    body: JSON.stringify({
      company_id: Number(companyId),
      search_text: searchText,
      replace_text: replaceText,
      template_ids: templateIds,
    }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Migration application failed");
  }
  return await res.json();
}

/**
 * Client-side default variables fallback.
 */
export function getDefaultClientGlobalVariables(companyId = 1) {
  return [
    {
      id: 1,
      company_id: companyId,
      name: "Live Chat",
      key: "live_chat",
      value: "Live Chat",
      category: "Contact Information",
      description: "Centralized customer support channel used across templates.",
      value_type: "text",
      is_active: true,
    },
    {
      id: 2,
      company_id: companyId,
      name: "Support Email",
      key: "support_email",
      value: "support@example.com",
      category: "Contact Information",
      description: "Official support email address for customer inquiries.",
      value_type: "email",
      is_active: true,
    },
    {
      id: 3,
      company_id: companyId,
      name: "Support Phone",
      key: "support_phone",
      value: "+263 77 000 0000",
      category: "Contact Information",
      description: "Official support helpline phone number.",
      value_type: "phone",
      is_active: true,
    },
    {
      id: 4,
      company_id: companyId,
      name: "Company Name",
      key: "company_name",
      value: "Default Organization",
      category: "Company Information",
      description: "Official organization brand name.",
      value_type: "text",
      is_active: true,
    },
    {
      id: 5,
      company_id: companyId,
      name: "Website URL",
      key: "website_url",
      value: "https://example.com",
      category: "Company Information",
      description: "Official website URL address.",
      value_type: "url",
      is_active: true,
    },
  ];
}

/**
 * Resolves global variables in text.
 * Returns { text: string, unresolved: array, isComplete: boolean }
 */
export function resolveGlobalVariablesInText(text = "", globalVariables = []) {
  if (!text) return { text: "", unresolved: [], isComplete: true };

  const varsMap = {};
  if (Array.isArray(globalVariables)) {
    globalVariables.forEach((v) => {
      if (v.key) varsMap[v.key.toLowerCase()] = v;
    });
  }

  const unresolved = [];
  const matches = Array.from(text.matchAll(/\{([a-zA-Z0-9_]+)\}/g));
  let resolvedText = text;

  for (const match of matches) {
    const placeholder = match[0];
    const key = match[1].toLowerCase();

    if (varsMap[key]) {
      const varObj = varsMap[key];
      if (varObj.is_active !== false && varObj.value !== undefined && String(varObj.value).trim() !== "") {
        resolvedText = resolvedText.replaceAll(placeholder, String(varObj.value));
      } else {
        unresolved.push({ key, placeholder, reason: varObj.is_active === false ? "inactive" : "empty" });
        resolvedText = resolvedText.replaceAll(placeholder, `⚠️ Reusable info unavailable [${key}]`);
      }
    }
  }

  return {
    text: resolvedText,
    unresolved,
    isComplete: unresolved.length === 0,
  };
}
