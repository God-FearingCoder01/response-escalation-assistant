// Smart Extractor Service: Manages Image Extraction Rules & Rule Matching
import { API_BASE, getCompanyHeaders } from "./api.js";

export const EXTRACTION_RULES_KEY = "rea_extraction_rules_v1";

export const DEFAULT_EXTRACTION_RULES = [
  {
    id: "rule_1",
    name: "Deposit Confirmation Message",
    description: "Mobile money deposit receipt / merchant payment reference (e.g. MP260831.1341.T9283748)",
    method: "pattern",
    pattern: "MP[A-Za-z0-9.\\-_$%@#&=]{15,25}",
    prefix: "MP",
    valueType: "alphanumeric",
    valueTypes: ["numbers", "letters", "symbols"],
    lengthMode: "variable",
    minLength: 15,
    maxLength: 25,
    constantLength: 20,
    result_label: "Ecocash Merchant Payment",
    target_placeholder: "transaction_number",
    is_active: true,
  },
  {
    id: "rule_2",
    name: "Innbucks Transaction",
    description: "Innbucks wallet transaction code / receipt id (e.g. INN-48291039)",
    method: "pattern",
    pattern: "INN-\\d{8,10}",
    prefix: "INN-",
    valueType: "numbers",
    valueTypes: ["numbers"],
    lengthMode: "variable",
    minLength: 8,
    maxLength: 10,
    constantLength: 8,
    result_label: "Innbucks trans id",
    target_placeholder: "transaction_number",
    is_active: true,
  },
  {
    id: "rule_3",
    name: "Customer Account Number",
    description: "Customer account identifier (e.g. ACC-482913)",
    method: "pattern",
    pattern: "ACC-\\d{6}",
    prefix: "ACC-",
    valueType: "numbers",
    valueTypes: ["numbers"],
    lengthMode: "constant",
    minLength: 6,
    maxLength: 6,
    constantLength: 6,
    result_label: "Account Number",
    target_placeholder: "account_number",
    is_active: true,
  },
  {
    id: "rule_4",
    name: "Phone Number",
    description: "Mobile phone number (e.g. 0771234567)",
    method: "pattern",
    pattern: "07\\d{8}",
    prefix: "07",
    valueType: "numbers",
    valueTypes: ["numbers"],
    lengthMode: "constant",
    minLength: 8,
    maxLength: 8,
    constantLength: 8,
    result_label: "Phone Number",
    target_placeholder: "phone_number",
    is_active: true,
  },
  {
    id: "rule_5",
    name: "Amount",
    description: "Monetary amount shown on confirmation (e.g. $25.00)",
    method: "pattern",
    pattern: "\\$[0-9,]+(\\.[0-9]{2})?",
    prefix: "$",
    valueType: "amount",
    valueTypes: ["amount"],
    lengthMode: "variable",
    minLength: 1,
    maxLength: 10,
    constantLength: 5,
    result_label: "Amount",
    target_placeholder: "amount",
    is_active: true,
  },
];

// Helper to retrieve rules from API with localStorage fallback
export async function fetchExtractionRules() {
  try {
    const res = await fetch(`${API_BASE}/api/extraction-rules`, {
      headers: getCompanyHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (e) {}

  try {
    const stored = localStorage.getItem(EXTRACTION_RULES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  return DEFAULT_EXTRACTION_RULES;
}

// Helper to save rules to localStorage and dispatch update event
export function saveExtractionRulesLocally(rules) {
  try {
    localStorage.setItem(EXTRACTION_RULES_KEY, JSON.stringify(rules));
    window.dispatchEvent(new Event("rea_extraction_rules_updated"));
  } catch (e) {
    console.error("Error saving extraction rules:", e);
  }
}

// Build regex string from Pattern Builder fields
export function buildPatternString({
  prefix = "",
  valueType = "numbers",
  valueTypes = null,
  lengthMode = "variable",
  constantLength = 8,
  minLength = 4,
  maxLength = 12,
  customRegex = "",
  pattern = "",
}) {
  if (customRegex && customRegex.trim()) return customRegex.trim();
  if (pattern && pattern.trim()) return pattern.trim();
  const escapedPrefix = prefix && prefix.trim() ? prefix.trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") : "";

  const types = Array.isArray(valueTypes) && valueTypes.length > 0
    ? valueTypes
    : [valueType];

  if (types.includes("amount")) {
    const prefixSymbol = escapedPrefix || "\\$";
    return `${prefixSymbol}[0-9,]+(\\.[0-9]{2})?`;
  }

  let charSet = "";
  if (types.includes("numbers")) charSet += "0-9";
  if (types.includes("letters")) charSet += "A-Za-z";
  if (types.includes("symbols")) charSet += ".\\-_$%@#&*="; // Includes dot (.)

  if (!charSet) charSet = "0-9";

  const typePattern = `[${charSet}]`;

  let range = "";
  if (lengthMode === "constant") {
    const len = parseInt(constantLength, 10) || parseInt(minLength, 10) || 8;
    range = `{${len}}`;
  } else {
    const min = parseInt(minLength, 10) || 1;
    const max = parseInt(maxLength, 10) || min;
    range = min === max ? `{${min}}` : `{${min},${max}}`;
  }

  return `${escapedPrefix}${typePattern}${range}`;
}

// Main Smart Extractor engine: Scans raw text against active rules
export function extractStructuredData(rawText = "", rules = []) {
  if (!rawText || typeof rawText !== "string") return [];
  const activeRules = (rules || []).filter((r) => r.is_active);
  const results = [];

  activeRules.forEach((rule) => {
    try {
      if (rule.method === "keyword" && rule.keyword && typeof rule.keyword === "string") {
        const kw = rule.keyword.trim().toLowerCase();
        const lowerText = (rawText || "").toLowerCase();
        if (kw && lowerText) {
          const kwIdx = lowerText.indexOf(kw);
          if (kwIdx !== -1) {
            const afterKw = rawText.slice(kwIdx + kw.length).trim();
            const match = afterKw.match(/^[:\s-]*([A-Za-z0-9$.#-]+)/);
            if (match && match[1]) {
              results.push({
                id: rule.id,
                label: rule.result_label || rule.name,
                value: match[1],
                confidence: "high",
                ruleName: rule.name,
                targetPlaceholder: rule.target_placeholder,
              });
            }
          }
        }
        return;
      }

      // Pattern / Regex matching
      const patternStr = buildPatternString(rule);
      const regex = new RegExp(patternStr, "gi");
      const matches = rawText.match(regex);

      if (matches && matches.length > 0) {
        // High confidence match
        results.push({
          id: rule.id,
          label: rule.result_label || rule.name,
          value: matches[0],
          confidence: "high",
          ruleName: rule.name,
          targetPlaceholder: rule.target_placeholder,
        });
      }
    } catch (e) {
      console.error(`Error processing rule ${rule.name}:`, e);
    }
  });

  return results;
}
