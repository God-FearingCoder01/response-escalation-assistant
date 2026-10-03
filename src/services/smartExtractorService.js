import { API_BASE, getCompanyHeaders, getAdminHeaders } from "./api";
import { createWorker } from "tesseract.js";

/**
 * Fetch all extraction rules for a company tenant.
 */
export async function fetchExtractionRules(companyId = 1, enabledOnly = false) {
  try {
    const res = await fetch(`${API_BASE}/api/extraction-rules?company_id=${companyId}&enabled_only=${enabledOnly}`, {
      headers: {
        ...getCompanyHeaders(),
      },
    });
    if (!res.ok) throw new Error(`Failed to fetch extraction rules (${res.status})`);
    return await res.json();
  } catch (err) {
    console.warn("fetchExtractionRules failed, returning default rules fallback:", err);
    return getDefaultClientExtractionRules(companyId);
  }
}

/**
 * Create a new extraction rule (Admin protected).
 */
export async function createExtractionRule(ruleData) {
  const res = await fetch(`${API_BASE}/api/extraction-rules`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAdminHeaders(),
    },
    body: JSON.stringify(ruleData),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to create extraction rule");
  }
  return await res.json();
}

/**
 * Update an existing extraction rule (Admin protected).
 */
export async function updateExtractionRule(ruleId, ruleData, companyId = 1) {
  const res = await fetch(`${API_BASE}/api/extraction-rules/${ruleId}?company_id=${companyId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAdminHeaders(),
    },
    body: JSON.stringify(ruleData),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to update extraction rule");
  }
  return await res.json();
}

/**
 * Delete an extraction rule (Admin protected).
 */
export async function deleteExtractionRule(ruleId, companyId = 1) {
  const res = await fetch(`${API_BASE}/api/extraction-rules/${ruleId}?company_id=${companyId}`, {
    method: "DELETE",
    headers: {
      ...getAdminHeaders(),
    },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || "Failed to delete extraction rule");
  }
  return await res.json();
}

/**
 * Live test an extraction rule pattern against sample input (Admin protected).
 */
export async function testExtractionRuleApi(pattern, testInput) {
  try {
    const res = await fetch(`${API_BASE}/api/extraction-rules/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAdminHeaders(),
      },
      body: JSON.stringify({ pattern, test_input: testInput }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || "Rule test failed");
    }
    return await res.json();
  } catch (err) {
    // Local regex evaluation fallback if backend is unreachable
    return evaluateRegexLocally(pattern, testInput);
  }
}

/**
 * Evaluate regex pattern locally.
 */
export function evaluateRegexLocally(pattern, testInput) {
  if (!pattern) return { matched: false, value: null, error: "Pattern is empty" };
  if (!testInput) return { matched: false, value: null, error: "Input is empty" };
  try {
    const regex = new RegExp(pattern, "i");
    const match = regex.exec(testInput);
    if (match) {
      return {
        matched: true,
        value: (match[1] || match[0]).trim(),
        error: null,
      };
    }
    return { matched: false, value: null, error: "No match found for pattern" };
  } catch (e) {
    return { matched: false, value: null, error: `Invalid regex: ${e.message}` };
  }
}

/**
 * Runs OCR on an image file / blob / data URL using Tesseract.js.
 */
export async function performOcrFromImage(imageSrc, onProgress = () => {}) {
  if (!imageSrc) throw new Error("No image source provided for OCR processing.");

  let worker;
  try {
    onProgress({ status: "initializing", message: "Initializing OCR Engine...", progress: 0.1 });
    worker = await createWorker("eng");
    
    onProgress({ status: "recognizing", message: "Scanning image & recognizing text...", progress: 0.5 });
    const ret = await worker.recognize(imageSrc);
    
    onProgress({ status: "completed", message: "Text recognition complete", progress: 1.0 });
    await worker.terminate();

    const rawText = (ret.data && ret.data.text) ? ret.data.text.trim() : "";
    return {
      rawText,
      confidence: ret.data.confidence || 0,
      lines: ret.data.lines || [],
    };
  } catch (err) {
    if (worker) {
      try { await worker.terminate(); } catch (e) {}
    }
    console.error("Tesseract.js OCR failed:", err);
    throw new Error(`OCR processing failed: ${err.message || "Unrecognizable image format"}`);
  }
}

const BLACKLISTED_REF_WORDS = new Set([
  "confirmation",
  "approval",
  "transaction",
  "reference",
  "successful",
  "completed",
  "pending",
  "details",
  "message",
  "ecocash",
  "innbucks",
  "payment",
  "deposit",
  "withdrawal",
  "status",
  "receipt",
]);

function isNewBalanceContext(fullText, matchIndex) {
  if (matchIndex <= 0 || !fullText) return false;
  const preceding = fullText.slice(Math.max(0, matchIndex - 60), matchIndex);
  return /new\s*bal(?:ance)?\b/i.test(preceding);
}

/**
 * Normalizes extracted values, fixing common OCR character misrecognitions.
 */
function normalizeExtractedValue(val, fieldKey = "", pattern = "") {
  if (!val || typeof val !== "string") return val;
  let str = val.trim();
  const fk = fieldKey.toLowerCase();

  // Strip preceding/trailing $, USD, US$ for amount fields so only numerals remain
  if (fk.includes("amount") || fk.includes("price") || fk.includes("cost") || fk.includes("sum")) {
    str = str.replace(/^(?:USD|\$|US\$|\s)+/gi, "").replace(/(?:USD|\$|US\$|\s)+$/gi, "");
  }

  // Fix OCR misrecognition of '+' as '4', '1', 'f', or 't' at start of international +263 numbers
  if (/^[41ft]2637\d{8}$/i.test(str)) {
    str = "+2637" + str.slice(5);
  } else if (/^2637\d{8}$/.test(str)) {
    str = "+" + str;
  } else if ((pattern && pattern.includes("263")) || fk.includes("phone") || fk.includes("account")) {
    if (/^[41ft]263/i.test(str)) {
      str = "+" + str.slice(1);
    }
  }

  // Remove trailing dots/colons from values
  str = str.replace(/^[:=\-\s]+|[:=\-\s\.]+$|[\r\n]+/g, "").trim();
  return str;
}

/**
 * Runs client-side structured value extraction against enabled rules.
 * Uses configured rule patterns first, then falls back to smart label & entity matchers.
 * Returns all extracted values per field key for multi-selection.
 */
export function extractValuesLocally(text = "", rules = []) {
  if (!text || typeof text !== "string" || !text.trim()) return [];

  const activeRules = Array.isArray(rules) && rules.length > 0 ? rules : getDefaultClientExtractionRules();
  const results = [];
  const seenFields = new Set();
  const cleanText = text.replace(/\r\n/g, "\n");
  const collapsedText = cleanText.replace(/[\r\n\s]+/g, "");

  activeRules.forEach((rule) => {
    if (rule.is_enabled === false) return;

    const fieldKey = (rule.result_field || rule.key || rule.name || "").toLowerCase().trim();
    if (!fieldKey || seenFields.has(fieldKey)) return;

    const extractedValues = [];
    const addVal = (val) => {
      if (!val) return;
      const normalized = normalizeExtractedValue(val, fieldKey, rule.pattern);
      if (normalized && !BLACKLISTED_REF_WORDS.has(normalized.toLowerCase()) && !extractedValues.includes(normalized)) {
        extractedValues.push(normalized);
      }
    };

    // 1. Try configured regex pattern match against clean text and collapsed text
    if (rule.pattern) {
      try {
        const globalRegex = new RegExp(rule.pattern, "gi");
        const cleanMatches = Array.from(cleanText.matchAll(globalRegex));
        cleanMatches.forEach((match) => {
          if (fieldKey.includes("amount") && isNewBalanceContext(cleanText, match.index)) {
            return;
          }
          const rawVal = (match[1] || match[0]).trim();
          addVal(rawVal);
        });

        // Also check collapsed text for line-wrapped matches
        const collapsedMatches = Array.from(collapsedText.matchAll(globalRegex));
        collapsedMatches.forEach((match) => {
          if (fieldKey.includes("amount") && isNewBalanceContext(collapsedText, match.index)) {
            return;
          }
          const rawVal = (match[1] || match[0]).trim();
          addVal(rawVal);
        });
      } catch (e) {
        console.warn(`Invalid regex pattern in rule ${rule.name}:`, e);
      }
    }

    // 2. Smart fallback matchers if no values found or to supplement rule matching
    const fallbackVals = runSmartFallbackExtractionAll(cleanText, collapsedText, fieldKey, rule.name);
    fallbackVals.forEach((fv) => addVal(fv));

    if (extractedValues.length > 0) {
      seenFields.add(fieldKey);

      results.push({
        rule_id: rule.id || rule.name,
        rule_name: rule.name,
        result_field: rule.result_field || fieldKey,
        value: extractedValues[0],
        all_values: extractedValues,
        is_valid: true,
        confidence: 0.98,
        warning: null,
      });
    }
  });

  return results;
}

/**
 * Smart fallback extraction returning ALL occurrences for common field keys.
 */
function runSmartFallbackExtractionAll(cleanText, collapsedText, fieldKey, ruleName = "") {
  const fk = (fieldKey + " " + ruleName).toLowerCase();
  const values = [];

  const addVal = (v) => {
    if (!v) return;
    const norm = normalizeExtractedValue(v, fieldKey);
    if (norm && !BLACKLISTED_REF_WORDS.has(norm.toLowerCase()) && !values.includes(norm)) {
      values.push(norm);
    }
  };

  // Transaction Reference / Reference Number (EcoCash MP260831.1249.T4567667 or general codes)
  if (fk.includes("ref") || fk.includes("tx") || fk.includes("transaction")) {
    const ecoMatchesClean = Array.from(cleanText.matchAll(/\b(MP\d{6}[\.\s\n]*\d{4}[\.\s\n]*T\d{7})\b/gi));
    ecoMatchesClean.forEach((m) => addVal((m[1] || m[0]).replace(/[\s\r\n]+/g, "")));

    const ecoMatchesCollapsed = Array.from(collapsedText.matchAll(/\b(MP\d{6}\.\d{4}\.T\d{7})\b/gi));
    ecoMatchesCollapsed.forEach((m) => addVal(m[1] || m[0]));

    const labelMatches = Array.from(cleanText.matchAll(/(?:ref(?:erence)?|tx(?:id)?|code|no\.?|id|approval)[:=\s\n]+([A-Z0-9.\-_]{6,35})/gi));
    labelMatches.forEach((m) => {
      const val = (m[1] || "").trim();
      const isPhoneLike = /^([+41ft]?2637|07)\d{8}$/i.test(val) || (/^\d{10,12}$/.test(val) && val.startsWith("263"));
      if (!isPhoneLike) addVal(val);
    });

    const genMatches = Array.from(cleanText.matchAll(/\b([A-Z]{2}\d{6}\.\d{4}\.[A-Z0-9]{7,10})\b/gi));
    genMatches.forEach((m) => addVal(m[1] || m[0]));
  }

  // Amount / Price / Cost
  if (fk.includes("amount") || fk.includes("price") || fk.includes("cost") || fk.includes("sum")) {
    const usdMatches = Array.from(cleanText.matchAll(/(?:\bUSD\s*|\$)\s*(\d+(?:\.\d{2})?)/gi));
    usdMatches.forEach((m) => {
      if (!isNewBalanceContext(cleanText, m.index)) {
        addVal(m[1] || m[0]);
      }
    });

    const decimalMatches = Array.from(cleanText.matchAll(/\b(\d+\.\d{2})\b/g));
    decimalMatches.forEach((m) => {
      if (!isNewBalanceContext(cleanText, m.index)) {
        const v = m[1].trim();
        if (!values.some((existing) => existing.includes(v))) {
          addVal(v);
        }
      }
    });
  }

  // Date
  if (fk.includes("date") || fk.includes("day")) {
    const dateMatches = Array.from(cleanText.matchAll(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/g));
    dateMatches.forEach((m) => addVal((m[1] || m[0]).trim()));
  }

  // Time
  if (fk.includes("time") || fk.includes("hrs") || fk.includes("hour")) {
    const timeMatches = Array.from(cleanText.matchAll(/\b(\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]\.?m\.?)?)\b/gi));
    timeMatches.forEach((m) => addVal((m[1] || m[0]).trim()));
  }

  // Phone Number / Account Number (+2637... or 07...)
  if (fk.includes("phone") || fk.includes("mobile") || fk.includes("account") || fk.includes("acc") || fk.includes("contact")) {
    const zimMatches = Array.from(cleanText.matchAll(/\b([+41ft]?2637\d{8}|07\d{8})\b/gi));
    zimMatches.forEach((m) => addVal(m[1] || m[0]));
  }

  return values;
}

/**
 * Default fallback extraction rules.
 */
export function getDefaultClientExtractionRules(companyId = 1) {
  return [
    {
      id: 1,
      company_id: companyId,
      name: "Transaction Reference",
      result_field: "reference_number",
      extraction_method: "regex",
      pattern: "MP\\d{6}[\\.\\s\\n]*\\d{4}[\\.\\s\\n]*T\\d{7}",
      description: "Standard EcoCash transaction reference format (e.g. MP260831.1923.T7382831)",
      is_enabled: true,
    },
    {
      id: 2,
      company_id: companyId,
      name: "Amount",
      result_field: "amount",
      extraction_method: "regex",
      pattern: "(?:\\$|USD\\s*)?(\\d+(?:\\.\\d{2})?)",
      description: "Currency amount numeral format excluding New Balance (e.g. 25.00)",
      is_enabled: true,
    },
    {
      id: 3,
      company_id: companyId,
      name: "Date",
      result_field: "date",
      extraction_method: "regex",
      pattern: "\\b\\d{2}/\\d{2}/\\d{4}\\b",
      description: "Standard date format DD/MM/YYYY",
      is_enabled: true,
    },
    {
      id: 4,
      company_id: companyId,
      name: "Time",
      result_field: "time",
      extraction_method: "regex",
      pattern: "\\b\\d{2}:\\d{2}\\b",
      description: "Time format HH:MM (24-hour)",
      is_enabled: true,
    },
    {
      id: 5,
      company_id: companyId,
      name: "Phone Number",
      result_field: "phone_number",
      extraction_method: "regex",
      pattern: "\\+2637\\d{8}|07\\d{8}",
      description: "Customer phone number format (+263779431682 or 0779431682)",
      is_enabled: true,
    },
    {
      id: 6,
      company_id: companyId,
      name: "Account Number",
      result_field: "account_number",
      extraction_method: "regex",
      pattern: "\\+2637\\d{8}|07\\d{8}|\\b\\d{8,16}\\b",
      description: "Account number or international phone format (+263779431682)",
      is_enabled: true,
    },
  ];
}

