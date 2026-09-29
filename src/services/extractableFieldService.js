import { toHTMLDateValue, toHTMLTimeValue } from "./api";

/**
 * Validates a bracketed extraction pattern string.
 * Examples of valid patterns:
 * - "MP[260831].[1923].T7382831"
 * - "REF-[ABC1234]--[9988]"
 *
 * Rejects unmatched brackets, empty brackets, nested brackets.
 */
export function validateExtractionPattern(pattern) {
  if (!pattern || typeof pattern !== "string") {
    return { isValid: false, error: "Pattern string is required." };
  }

  let inBracket = false;
  let currentToken = "";
  const segments = [];
  const extractions = [];

  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];

    if (char === "[") {
      if (inBracket) {
        return { isValid: false, error: "Nested brackets are not allowed" };
      }
      if (currentToken) {
        segments.push({ type: "literal", value: currentToken });
        currentToken = "";
      }
      inBracket = true;
    } else if (char === "]") {
      if (!inBracket) {
        return { isValid: false, error: "Unmatched closing bracket ']'" };
      }
      if (!currentToken.trim()) {
        return { isValid: false, error: "Empty extraction bracket '[]'" };
      }
      const extractionIdx = extractions.length;
      extractions.push({ index: extractionIdx, sample_val: currentToken });
      segments.push({ type: "extraction", value: currentToken, index: extractionIdx });
      currentToken = "";
      inBracket = false;
    } else {
      currentToken += char;
    }
  }

  if (inBracket) {
    return { isValid: false, error: "Unmatched opening bracket '['" };
  }

  if (currentToken) {
    segments.push({ type: "literal", value: currentToken });
  }

  if (extractions.length === 0) {
    return {
      isValid: false,
      error: "Please wrap at least one extracted substring in [square brackets].",
    };
  }

  return {
    isValid: true,
    segments,
    extractions,
  };
}

/**
 * Dynamically extracts substrings from runtime input string based on bracketed pattern.
 * Example pattern: "MP[260831].[1923].T7382831"
 * Input value:     "MP260929.1942.T9876543"
 * Returns:         ["260929", "1942"]
 */
export function extractValuesFromPattern(pattern, inputValue) {
  if (!pattern || !inputValue || typeof pattern !== "string" || typeof inputValue !== "string") {
    return [];
  }

  const validation = validateExtractionPattern(pattern);
  if (!validation.isValid) return [];

  // Escape special regex characters
  const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const buildRegex = (relaxLiteralNumbers = false) => {
    let regexStr = "^";
    validation.segments.forEach((seg) => {
      if (seg.type === "literal") {
        let esc = escapeRegex(seg.value);
        if (relaxLiteralNumbers) {
          esc = esc.replace(/\d+/g, "\\d+");
        }
        regexStr += esc;
      } else if (seg.type === "extraction") {
        const sample = seg.value.trim();
        if (/^\d+$/.test(sample)) {
          regexStr += `(\\d{${sample.length}})`;
        } else if (/^[A-Za-z0-9_-]+$/.test(sample)) {
          regexStr += `([A-Za-z0-9_-]+)`;
        } else {
          regexStr += `(.+?)`;
        }
      }
    });
    regexStr += "$";
    return new RegExp(regexStr);
  };

  try {
    const trimmedInput = inputValue.trim();

    let match = trimmedInput.match(buildRegex(false));

    if (!match) {
      match = trimmedInput.match(buildRegex(true));
    }

    if (!match) {
      let fallbackRegexStr = "^";
      validation.segments.forEach((seg) => {
        if (seg.type === "literal") {
          fallbackRegexStr += escapeRegex(seg.value).replace(/\d+/g, ".+");
        } else if (seg.type === "extraction") {
          fallbackRegexStr += `(.+?)`;
        }
      });
      fallbackRegexStr += "$";
      const fallbackRe = new RegExp(fallbackRegexStr);
      match = trimmedInput.match(fallbackRe);
    }

    if (match) {
      return match.slice(1);
    }
    return [];
  } catch (e) {
    return [];
  }
}

/**
 * Transforms an extracted raw substring value based on transformation config & target control type.
 * Supports Date transformations (YYMMDD, YYYYMMDD, DDMMYY, DD/MM/YYYY, etc.) and Time transformations (HHmm, HHmmss).
 */
export function transformExtractedValue(rawValue, config = {}, targetControlType = "text") {
  if (rawValue === undefined || rawValue === null) return "";
  const str = String(rawValue).trim();
  if (!str) return "";

  const transformType = config.transform_type || "none";

  if (transformType === "none") {
    if (targetControlType === "date") return toHTMLDateValue(str);
    if (targetControlType === "time") return toHTMLTimeValue(str);
    return str;
  }

  if (transformType === "date") {
    const inputFmt = config.date_input_format || "YYMMDD";
    const outputFmt = config.date_output_format || "YYYY-MM-DD";

    let year = "";
    let month = "";
    let day = "";

    if (inputFmt === "YYMMDD" && str.length >= 6 && /^\d+$/.test(str)) {
      year = "20" + str.slice(0, 2);
      month = str.slice(2, 4);
      day = str.slice(4, 6);
    } else if (inputFmt === "YYYYMMDD" && str.length >= 8 && /^\d+$/.test(str)) {
      year = str.slice(0, 4);
      month = str.slice(4, 6);
      day = str.slice(6, 8);
    } else if (inputFmt === "DDMMYY" && str.length >= 6 && /^\d+$/.test(str)) {
      day = str.slice(0, 2);
      month = str.slice(2, 4);
      year = "20" + str.slice(4, 6);
    } else if (inputFmt === "DDMMYYYY" && str.length >= 8 && /^\d+$/.test(str)) {
      day = str.slice(0, 2);
      month = str.slice(2, 4);
      year = str.slice(4, 8);
    } else if (inputFmt === "MMDDYY" && str.length >= 6 && /^\d+$/.test(str)) {
      month = str.slice(0, 2);
      day = str.slice(2, 4);
      year = "20" + str.slice(4, 6);
    } else if (inputFmt === "MMDDYYYY" && str.length >= 8 && /^\d+$/.test(str)) {
      month = str.slice(0, 2);
      day = str.slice(2, 4);
      year = str.slice(4, 8);
    } else {
      const ddmmyyyyMatch = str.match(/^(\d{2})[/.\-](\d{2})[/.\-](\d{4})$/);
      if (ddmmyyyyMatch) {
        day = ddmmyyyyMatch[1];
        month = ddmmyyyyMatch[2];
        year = ddmmyyyyMatch[3];
      } else {
        const isoMatch = str.match(/^(\d{4})[/.\-](\d{2})[/.\-](\d{2})$/);
        if (isoMatch) {
          year = isoMatch[1];
          month = isoMatch[2];
          day = isoMatch[3];
        } else {
          const htmlDate = toHTMLDateValue(str);
          if (htmlDate && htmlDate.includes("-")) {
            const parts = htmlDate.split("-");
            year = parts[0];
            month = parts[1];
            day = parts[2];
          }
        }
      }
    }

    if (year && month && day) {
      let formatted = "";
      if (outputFmt === "YYYY-MM-DD") formatted = `${year}-${month}-${day}`;
      else if (outputFmt === "DD/MM/YYYY") formatted = `${day}/${month}/${year}`;
      else if (outputFmt === "DD.MM.YYYY") formatted = `${day}.${month}.${year}`;
      else if (outputFmt === "YYYY/MM/DD") formatted = `${year}/${month}/${day}`;
      else if (outputFmt === "DD-MM-YYYY") formatted = `${day}-${month}-${year}`;
      else formatted = `${year}-${month}-${day}`;

      if (targetControlType === "date") {
        return toHTMLDateValue(formatted);
      }
      return formatted;
    }

    return toHTMLDateValue(str);
  }

  if (transformType === "time") {
    const inputFmt = config.time_input_format || "HHmm";
    const outputFmt = config.time_output_format || "HH:mm";

    let hours = "";
    let minutes = "";
    let seconds = "00";

    if (inputFmt === "HHmm" && str.length >= 4 && /^\d+$/.test(str)) {
      hours = str.slice(0, 2);
      minutes = str.slice(2, 4);
    } else if (inputFmt === "HHmmss" && str.length >= 6 && /^\d+$/.test(str)) {
      hours = str.slice(0, 2);
      minutes = str.slice(2, 4);
      seconds = str.slice(4, 6);
    } else if (str.includes(":")) {
      const parts = str.split(":");
      hours = parts[0].padStart(2, "0");
      minutes = (parts[1] || "00").padStart(2, "0");
    }

    if (hours && minutes) {
      let formatted = "";
      if (outputFmt === "HH:mm") formatted = `${hours}:${minutes}`;
      else if (outputFmt === "HH:mm:ss") formatted = `${hours}:${minutes}:${seconds}`;
      else formatted = `${hours}:${minutes}`;

      if (targetControlType === "time") {
        return toHTMLTimeValue(formatted);
      }
      return formatted;
    }

    return toHTMLTimeValue(str);
  }

  return str;
}

/**
 * Runs extraction on a given source field value at runtime and returns target field value updates.
 */
export function processExtractableFields(sourceFieldKey, rawInputValue, placeholderConfigs) {
  if (!sourceFieldKey || !rawInputValue || !placeholderConfigs) return {};

  const cfg = placeholderConfigs[sourceFieldKey];
  if (!cfg || !cfg.is_extractable || !cfg.extraction_config) return {};

  const { pattern, extractions } = cfg.extraction_config;
  if (!pattern || !Array.isArray(extractions) || extractions.length === 0) return {};

  const extracted = extractValuesFromPattern(pattern, rawInputValue);
  if (!extracted || extracted.length === 0) return {};

  const updates = {};
  extractions.forEach((ext, idx) => {
    const rawVal = extracted[idx];
    if (rawVal !== undefined && ext.target_field) {
      const targetCtrl = placeholderConfigs[ext.target_field]?.control_type || "text";
      const finalVal = transformExtractedValue(rawVal, ext, targetCtrl);
      updates[ext.target_field] = finalVal;
    }
  });

  return updates;
}
