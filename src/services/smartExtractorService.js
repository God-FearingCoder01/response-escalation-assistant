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

// Helper to retrieve rules from API with tenant-scoped localStorage fallback
export async function fetchExtractionRules() {
  const headers = getCompanyHeaders();
  const companyId = headers["x-company-id"] || "default";
  const storageKey = `${EXTRACTION_RULES_KEY}_${companyId}`;

  try {
    const res = await fetch(`${API_BASE}/api/extraction-rules`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        try {
          localStorage.setItem(storageKey, JSON.stringify(data));
        } catch (e) {}
        return data;
      }
    }
  } catch (e) {}

  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}


  return DEFAULT_EXTRACTION_RULES;
}

// Helper to save rules to backend API and tenant-scoped localStorage
export async function saveExtractionRulesLocally(rules) {
  const headers = { ...getCompanyHeaders(), "Content-Type": "application/json" };
  const companyId = headers["x-company-id"] || "default";
  const storageKey = `${EXTRACTION_RULES_KEY}_${companyId}`;

  try {
    localStorage.setItem(storageKey, JSON.stringify(rules));
  } catch (e) {}

  try {
    const res = await fetch(`${API_BASE}/api/extraction-rules`, {
      method: "POST",
      headers,
      body: JSON.stringify(rules),
    });

    window.dispatchEvent(new Event("rea_extraction_rules_updated"));
    if (res.ok) {
      const savedData = await res.json();
      return savedData;
    }
  } catch (e) {
    console.error("Error persisting extraction rules to backend:", e);
    window.dispatchEvent(new Event("rea_extraction_rules_updated"));
  }
  return rules;
}

// Helper to reset extraction rules back to default factory settings
export async function resetExtractionRulesToDefault() {
  const headers = { ...getCompanyHeaders(), "Content-Type": "application/json" };
  const companyId = headers["x-company-id"] || "default";
  const storageKey = `${EXTRACTION_RULES_KEY}_${companyId}`;

  try {
    localStorage.setItem(storageKey, JSON.stringify(DEFAULT_EXTRACTION_RULES));
  } catch (e) {}

  try {
    const res = await fetch(`${API_BASE}/api/extraction-rules/reset`, {
      method: "POST",
      headers,
    });

    window.dispatchEvent(new Event("rea_extraction_rules_updated"));
    if (res.ok) {
      const savedData = await res.json();
      return savedData;
    }
  } catch (e) {
    console.error("Error resetting extraction rules on backend:", e);
    window.dispatchEvent(new Event("rea_extraction_rules_updated"));
  }

  return saveExtractionRulesLocally(DEFAULT_EXTRACTION_RULES);
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
  const activeRules = (rules || []).filter((r) => r && r.is_active !== false);
  const results = [];

  activeRules.forEach((rule) => {
    try {
      if (rule.method === "keyword") {
        if (rule.keyword && typeof rule.keyword === "string") {
          const kw = rule.keyword.trim().toLowerCase();
          const lowerText = (rawText || "").toLowerCase();
          if (kw && lowerText) {
            const kwIdx = lowerText.indexOf(kw);
            if (kwIdx !== -1) {
              const afterKw = rawText.slice(kwIdx + kw.length).trim();
              const match = afterKw.match(/^[:\s-]*([A-Za-z0-9$.#-]+)/);
              if (match && match[1]) {
                const val = match[1];
                const valIdx = rawText.indexOf(val, kwIdx);
                const startPos = valIdx !== -1 ? valIdx : kwIdx;
                results.push({
                  id: rule.id,
                  label: rule.result_label || rule.name,
                  value: val,
                  startIndex: startPos,
                  endIndex: startPos + val.length,
                  confidence: "high",
                  confidenceLabel: "Keyword Proximity Match",
                  ruleName: rule.name,
                  targetPlaceholder: rule.target_placeholder,
                });
              }
            }
          }
        }
        return;
      }

      // Pattern / Regex matching
      const patternStr = buildPatternString(rule);
      if (!patternStr || !patternStr.trim()) return;

      const regex = new RegExp(patternStr, "gi");
      let matchExec;
      let guard = 0;
      while ((matchExec = regex.exec(rawText)) !== null) {
        const val = matchExec[0];
        const isPrefixExact = rule.prefix ? val.startsWith(rule.prefix) : true;
        const isLengthExact = rule.lengthMode === "constant" ? val.length === parseInt(rule.constantLength, 10) : true;
        const confidenceScore = isPrefixExact && isLengthExact ? 0.95 : 0.85;
        const confidenceLabel = isPrefixExact ? "Rule Pattern Matched" : "Pattern Match";

        results.push({
          id: rule.id,
          label: rule.result_label || rule.name,
          value: val,
          startIndex: matchExec.index,
          endIndex: matchExec.index + val.length,
          confidence: confidenceScore >= 0.9 ? "high" : "medium",
          confidenceScore,
          confidenceLabel,
          ruleName: rule.name,
          targetPlaceholder: rule.target_placeholder,
        });

        // Guard against infinite loops on 0-width regex matches
        if (matchExec[0].length === 0) {
          regex.lastIndex++;
          if (regex.lastIndex > rawText.length) break;
        }

        guard++;
        if (guard > 500) break;

        if (!regex.global) break;
      }
    } catch (e) {
      console.error(`Error processing rule ${rule?.name}:`, e);
    }
  });


  return results;
}

// Dictionary mapping standard rule target placeholders to common template placeholder variations
export const PLACEHOLDER_ALIASES = {
  transaction_number: [
    "transaction_number",
    "transaction_id",
    "tx_id",
    "ref_no",
    "reference_no",
    "reference",
    "trans_no",
    "receipt_no",
    "receipt",
    "transaction_reference",
    "txn",
  ],
  amount: ["amount", "sum", "price", "cost", "total", "paid_amount", "value"],
  account_number: [
    "account_number",
    "account_no",
    "acc_no",
    "account",
    "customer_account",
    "acc_num",
  ],
  phone_number: [
    "phone_number",
    "phone",
    "msisdn",
    "mobile",
    "mobile_number",
    "contact",
  ],
};

/**
 * Helper to parse bracketed substrings [text] from example input text
 */
export function extractBracketedTokens(rawText = "") {
  if (!rawText || typeof rawText !== "string") return [];
  const bracketRegex = /\[([^\]]+)\]/g;
  const matches = [];
  let m;
  while ((m = bracketRegex.exec(rawText)) !== null) {
    matches.push({
      value: m[1],
      rawToken: m[0],
      startIndex: m.index,
      endIndex: m.index + m[0].length,
      isBracketed: true,
    });
  }
  return matches;
}

/**
 * Automatically extracts structured placeholder values from user-entered text
 * and returns matching field updates for active template placeholders.
 */
export function autoExtractFieldsFromText(
  rawText = "",
  rules = [],
  placeholders = [],
  sourcePlaceholder = "",
  placeholderConfigMap = {}
) {
  if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
    return { updates: {}, extractedList: [] };
  }

  const sourceCfg = (placeholderConfigMap && placeholderConfigMap[sourcePlaceholder]) || {};
  const configuredTargets = Array.isArray(sourceCfg.extraction_targets) && sourceCfg.extraction_targets.length > 0
    ? sourceCfg.extraction_targets
    : null;
  const customMappings = sourceCfg.target_mappings || {};

  const activeRules = Array.isArray(rules) && rules.length > 0 ? rules : DEFAULT_EXTRACTION_RULES;

  // Clean rawText for rule matching if it contains brackets [value]
  const cleanRawText = rawText.replace(/\[([^\]]+)\]/g, "$1");
  const extracted = extractStructuredData(cleanRawText, activeRules);

  // Also parse explicit bracketed tokens [text] (for Admin Dashboard preview)
  const bracketed = extractBracketedTokens(rawText);
  bracketed.forEach((b) => {
    // If not already extracted by rules
    const exists = extracted.some((e) => e.value === b.value);
    if (!exists) {
      extracted.push({
        id: `bracket_${b.value.replace(/[^A-Za-z0-9]/g, "_").slice(0, 15)}`,
        label: `Bracketed Choice ([${b.value}])`,
        value: b.value,
        isBracketed: true,
        confidence: "high",
        targetPlaceholder: customMappings[`[${b.value}]`] || customMappings[b.value] || null,
      });
    }
  });

  const availableTargetPlaceholders = (placeholders || []).filter((ph) => {
    if (ph === sourcePlaceholder) return false;
    if (configuredTargets && !configuredTargets.includes(ph)) return false;
    return true;
  });

  // Scan unbracketed plain text for CA-configured choices (options & mappings)
  if (placeholderConfigMap) {
    availableTargetPlaceholders.forEach((ph) => {
      const phCfg = placeholderConfigMap[ph] || {};
      const opts = Array.isArray(phCfg.options) ? phCfg.options : [];
      const mapping = phCfg.mapping || {};
      const candidateChoices = new Set([
        ...opts.map((o) => String(o).trim()),
        ...Object.keys(mapping).map((k) => String(k).trim()),
        ...Object.values(mapping).map((v) => String(v).trim()),
      ]);

      // Add custom mappings targeted at this placeholder
      Object.entries(customMappings).forEach(([rawKey, targetPh]) => {
        if (targetPh === ph) {
          const cleanKey = rawKey.replace(/^\[|\]$/g, "").trim();
          if (cleanKey) candidateChoices.add(cleanKey);
        }
      });

      candidateChoices.forEach((choice) => {
        if (!choice || choice.length < 2) return;
        try {
          // Escape regex special chars
          const escapedChoice = choice.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
          // Whole word or boundary match regex
          const choiceRegex = new RegExp(`(?:^|\\b|\\s)${escapedChoice}(?:$|\\b|\\s)`, "i");
          if (choiceRegex.test(cleanRawText) || choiceRegex.test(rawText)) {
            const exists = extracted.some(
              (e) => e.value.toLowerCase() === choice.toLowerCase() && (e.targetPlaceholder === ph || !e.targetPlaceholder)
            );
            if (!exists) {
              extracted.push({
                id: `choice_${ph}_${choice.replace(/[^A-Za-z0-9]/g, "_").slice(0, 15)}`,
                label: `Configured Choice (${choice})`,
                value: choice,
                targetPlaceholder: ph,
                isChoiceMatch: true,
                confidence: "high",
              });
            }
          }
        } catch (e) {
          console.error("Error testing candidate choice regex:", e);
        }
      });
    });
  }

  const updates = {};
  const extractedList = [];

  extracted.forEach((item) => {
    let targetRuleKey = item.targetPlaceholder;

    // Check if admin defined explicit target mapping for this rule/bracketed value
    if (customMappings[`[${item.value}]`]) {
      targetRuleKey = customMappings[`[${item.value}]`];
    } else if (customMappings[item.value]) {
      targetRuleKey = customMappings[item.value];
    } else if (customMappings[item.id]) {
      targetRuleKey = customMappings[item.id];
    } else if (customMappings[item.targetPlaceholder]) {
      targetRuleKey = customMappings[item.targetPlaceholder];
    }

    // For bracketed or choice items, attempt to auto-match against CA-configured choices in placeholderConfigMap
    if (!targetRuleKey && (item.isBracketed || item.isChoiceMatch) && placeholderConfigMap) {
      for (const ph of availableTargetPlaceholders) {
        const phCfg = placeholderConfigMap[ph] || {};
        const opts = Array.isArray(phCfg.options) ? phCfg.options : [];
        const mapping = phCfg.mapping || {};
        const mappingKeys = Object.keys(mapping);
        const mappingVals = Object.values(mapping);

        const valLower = item.value.toLowerCase();
        const matchesOption = opts.some((o) => String(o).toLowerCase() === valLower);
        const matchesKey = mappingKeys.some((k) => String(k).toLowerCase() === valLower);
        const matchesVal = mappingVals.some((v) => String(v).toLowerCase() === valLower);

        if (matchesOption || matchesKey || matchesVal) {
          targetRuleKey = ph;
          break;
        }
      }
    }

    // Fallback target for bracketed items if unmapped
    if (!targetRuleKey && item.isBracketed) {
      targetRuleKey = availableTargetPlaceholders[0] || item.targetPlaceholder || "";
    }

    if (!targetRuleKey) return;

    // Compute exact start & end indices in rawText
    let sIdx = -1;
    let eIdx = -1;
    const bracketedPattern = `[${item.value}]`;
    const bPos = rawText.indexOf(bracketedPattern);
    if (bPos !== -1) {
      sIdx = bPos;
      eIdx = bPos + bracketedPattern.length;
    } else {
      const vPos = rawText.indexOf(item.value);
      if (vPos !== -1) {
        sIdx = vPos;
        eIdx = vPos + item.value.length;
      }
    }

    const aliases = PLACEHOLDER_ALIASES[targetRuleKey] || [targetRuleKey];

    (placeholders || []).forEach((ph) => {
      if (ph === sourcePlaceholder && rawText.length > 30) return;
      if (configuredTargets && !configuredTargets.includes(ph)) return;

      const phLower = ph.toLowerCase();
      const isMatch = aliases.some((alias) => {
        const aLower = alias.toLowerCase();
        return phLower === aLower || phLower.includes(aLower) || aLower.includes(phLower);
      });

      if (isMatch || ph === targetRuleKey) {
        const phCfg = (placeholderConfigMap && placeholderConfigMap[ph]) || {};
        const mapping = phCfg.mapping || {};

        // Resolve 1-to-1 conditional mapping if choice key matches (e.g. Elephant => Big Game Slot)
        let resolvedValue = item.value;
        if (mapping[item.value]) {
          resolvedValue = mapping[item.value];
        } else {
          // Case-insensitive key match lookup
          const matchingKey = Object.keys(mapping).find((k) => k.toLowerCase() === item.value.toLowerCase());
          if (matchingKey && mapping[matchingKey]) {
            resolvedValue = mapping[matchingKey];
          }
        }

        updates[ph] = resolvedValue;

        // Prevent duplicate entries in extractedList
        const alreadyAdded = extractedList.some(
          (e) => e.placeholder === ph && e.value === item.value && e.startIndex === sIdx
        );
        if (!alreadyAdded) {
          extractedList.push({
            placeholder: ph,
            label: item.label,
            value: item.value,
            resolvedValue,
            startIndex: sIdx !== -1 ? sIdx : item.startIndex,
            endIndex: eIdx !== -1 ? eIdx : item.endIndex,
            ruleId: item.id,
            isBracketed: item.isBracketed,
          });
        }
      }
    });
  });

  return { updates, extractedList };
}
