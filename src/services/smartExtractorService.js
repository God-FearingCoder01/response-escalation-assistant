import { API_BASE, getCompanyHeaders, getAdminHeaders } from "./api";
import { createWorker } from "tesseract.js";

/**
 * Fetch all extraction rules for a company tenant.
 */
export async function fetchExtractionRules(companyId = 1, enabledOnly = false) {
  const res = await fetch(`${API_BASE}/api/extraction-rules?company_id=${companyId}&enabled_only=${enabledOnly}`, {
    headers: {
      ...getCompanyHeaders(),
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch extraction rules (${res.status})`);
  return await res.json();
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
 * Applies multi-pass image preprocessing (upscaling, contrast boosting, sharpening, and binarization)
 * to HTML Canvas to dramatically enhance OCR recognition of cursive, handwritten, or decorative fonts.
 */
export async function preprocessImageForOcr(imageSrc) {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || typeof document === "undefined" || !imageSrc) {
      return resolve([imageSrc]);
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const passes = [];
        // Optimal scaling factor (2x for typical screenshot resolution up to 2400px width/height)
        const scale = Math.max(1, Math.min(3.0, 2400 / Math.max(img.width, img.height)));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);

        // Pass 1: High Contrast + Grayscale + Sharpening (Preserves font shape details for cursive)
        const canvas1 = document.createElement("canvas");
        canvas1.width = w;
        canvas1.height = h;
        const ctx1 = canvas1.getContext("2d");
        ctx1.imageSmoothingEnabled = true;
        ctx1.imageSmoothingQuality = "high";
        ctx1.drawImage(img, 0, 0, w, h);

        const imgData1 = ctx1.getImageData(0, 0, w, h);
        applyGrayscaleAndContrast(imgData1.data, 1.75, 10);
        applySharpenKernel(imgData1.data, w, h);
        ctx1.putImageData(imgData1, 0, 0);
        passes.push(canvas1.toDataURL("image/png"));

        // Pass 2: Adaptive Binarization (Black/White thresholding for cursive script on noisy backgrounds)
        const canvas2 = document.createElement("canvas");
        canvas2.width = w;
        canvas2.height = h;
        const ctx2 = canvas2.getContext("2d");
        ctx2.drawImage(img, 0, 0, w, h);

        const imgData2 = ctx2.getImageData(0, 0, w, h);
        applyAdaptiveThreshold(imgData2.data, w, h);
        ctx2.putImageData(imgData2, 0, 0);
        passes.push(canvas2.toDataURL("image/png"));

        resolve(passes);
      } catch (e) {
        console.warn("Canvas preprocessing error, using raw image:", e);
        resolve([imageSrc]);
      }
    };
    img.onerror = () => resolve([imageSrc]);
    img.src = typeof imageSrc === "string" ? imageSrc : (imageSrc instanceof Blob ? URL.createObjectURL(imageSrc) : imageSrc);
  });
}

function applyGrayscaleAndContrast(data, contrast = 1.75, brightness = 10) {
  const factor = (259 * (contrast * 100 + 255)) / (255 * (259 - contrast * 100));
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    let v = factor * (gray - 128) + 128 + brightness;
    v = Math.min(255, Math.max(0, v));
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
}

function applySharpenKernel(data, width, height) {
  const copy = Uint8ClampedArray.from(data);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const center = copy[idx + c] * 5;
        const top = copy[((y - 1) * width + x) * 4 + c];
        const bottom = copy[((y + 1) * width + x) * 4 + c];
        const left = copy[(y * width + (x - 1)) * 4 + c];
        const right = copy[(y * width + (x + 1)) * 4 + c];
        let val = center - top - bottom - left - right;
        data[idx + c] = Math.min(255, Math.max(0, val));
      }
    }
  }
}

function applyAdaptiveThreshold(data, width, height) {
  for (let i = 0; i < data.length; i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = g;
    data[i + 1] = g;
    data[i + 2] = g;
  }

  const integral = new Int32Array(width * height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = 0; x < width; x++) {
      sum += data[(y * width + x) * 4];
      if (y === 0) {
        integral[y * width + x] = sum;
      } else {
        integral[y * width + x] = integral[(y - 1) * width + x] + sum;
      }
    }
  }

  const s = Math.floor(Math.max(8, Math.min(width, height) / 16) / 2);
  const t = 0.15;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(x - s, 0);
      const x2 = Math.min(x + s, width - 1);
      const y1 = Math.max(y - s, 0);
      const y2 = Math.min(y + s, height - 1);

      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      let sum = integral[y2 * width + x2];
      if (x1 > 0) sum -= integral[y2 * width + (x1 - 1)];
      if (y1 > 0) sum -= integral[(y1 - 1) * width + x2];
      if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * width + (x1 - 1)];

      const idx = (y * width + x) * 4;
      const pixelVal = data[idx];
      const mean = sum / count;

      const v = pixelVal < mean * (1.0 - t) ? 0 : 255;
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
    }
  }
}

/**
 * Runs multi-pass OCR on an image file / blob / data URL using Tesseract.js.
 */
export async function performOcrFromImage(imageSrc, onProgress = () => {}) {
  if (!imageSrc) throw new Error("No image source provided for OCR processing.");

  let worker;
  try {
    onProgress({ status: "initializing", message: "Initializing Multi-Pass Cursive OCR Engine...", progress: 0.1 });
    worker = await createWorker("eng");

    try {
      await worker.setParameters({
        tessedit_pageseg_mode: "6", // PSM 6: Uniform text block layout
      });
    } catch (e) {}

    onProgress({ status: "preprocessing", message: "Enhancing cursive & unordinary fonts (Scaling & Sharpening)...", progress: 0.3 });
    const imagePasses = await preprocessImageForOcr(imageSrc);

    onProgress({ status: "recognizing", message: "Scanning image & recognizing text (Pass 1)...", progress: 0.5 });
    const ret1 = await worker.recognize(imagePasses[0]);

    let ret2 = null;
    if (imagePasses.length > 1) {
      onProgress({ status: "recognizing", message: "Running adaptive threshold recognition (Pass 2)...", progress: 0.8 });
      try {
        ret2 = await worker.recognize(imagePasses[1]);
      } catch (e) {}
    }

    onProgress({ status: "completed", message: "Text recognition complete", progress: 1.0 });
    await worker.terminate();

    const combinedLines = [];
    const seenLineTexts = new Set();

    [ret1, ret2].forEach((ret) => {
      if (ret && ret.data && Array.isArray(ret.data.lines)) {
        ret.data.lines.forEach((l) => {
          const txt = l.text ? l.text.trim() : "";
          if (txt && !seenLineTexts.has(txt.toLowerCase())) {
            seenLineTexts.add(txt.toLowerCase());
            combinedLines.push(txt);
          }
        });
      }
    });

    const rawText = combinedLines.length > 0 ? combinedLines.join("\n") : ((ret1?.data?.text) || "").trim();
    const maxConfidence = Math.max(ret1?.data?.confidence || 0, ret2?.data?.confidence || 0);

    return {
      rawText,
      confidence: maxConfidence,
      lines: combinedLines,
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
  let preceding = fullText.slice(Math.max(0, matchIndex - 60), matchIndex);
  const headerMatches = Array.from(preceding.matchAll(/payment\s*confirmation:?|confirmation:?/gi));
  if (headerMatches.length > 0) {
    const lastHeader = headerMatches[headerMatches.length - 1];
    preceding = preceding.slice(lastHeader.index + lastHeader[0].length);
  }
  return /new\s*bal(?:ance)?\b/i.test(preceding);
}

/**
 * Normalizes extracted values, fixing common OCR character misrecognitions.
 */
function normalizeExtractedValue(val, fieldKey = "", pattern = "") {
  if (!val || typeof val !== "string") return val;
  let str = val.trim();
  const fk = fieldKey.toLowerCase();

  // Normalize cursive spacing and comma/dot misrecognition in EcoCash transaction references
  if (fk.includes("ref") || fk.includes("tx") || fk.includes("transaction") || /MP/i.test(str)) {
    let cleanRef = str.replace(/[\s\r\n]+/g, "");
    cleanRef = cleanRef.replace(/,/g, ".");
    cleanRef = cleanRef.replace(/^[m1IuUivIV]{1,2}P/i, "MP");
    cleanRef = cleanRef.replace(/[\.:\-][t7Il1](\d{7})/i, ".T$1");

    if (/^MP\d{6}\.\d{4}\.T\d{7}$/i.test(cleanRef)) {
      str = cleanRef.toUpperCase();
    }
  }

  // Strip preceding/trailing $, USD, US$, S, s for amount fields & handle comma decimals e.g. 25,00 -> 25.00
  if (fk.includes("amount") || fk.includes("price") || fk.includes("cost") || fk.includes("sum")) {
    str = str.replace(/^(?:USD|\$|US\$|[Ss]|U5D|U5\$|\s)+/gi, "").replace(/(?:USD|\$|US\$|\s)+$/gi, "");
    if (/^\d+,\d{2}$/.test(str)) {
      str = str.replace(",", ".");
    }
    if (/^\d+(?:\.\d+)?$/.test(str)) {
      const num = parseFloat(str);
      if (!isNaN(num)) {
        str = String(num);
      }
    }
  }

  // Fix OCR misrecognition of '+' as '4', '1', 'f', 't', 'i', '*', or '#' at start of international +263 numbers
  if (/^[41fti*#]2637\d{8}$/i.test(str)) {
    str = "+2637" + str.slice(5);
  } else if (/^2637\d{8}$/.test(str)) {
    str = "+" + str;
  } else if ((pattern && pattern.includes("263")) || fk.includes("phone") || fk.includes("account")) {
    if (/^[41fti*#]263/i.test(str)) {
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

  const activeRules = Array.isArray(rules) ? rules : [];
  if (activeRules.length === 0) return [];
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

  return alignReferenceNumberAndAmountResults(results, cleanText);
}

function splitTextIntoConfirmationBlocks(text = "") {
  if (!text) return [];
  let blocks = text.split(/payment\s*confirmation:?|confirmation:?/gi).map((b) => b.trim()).filter(Boolean);
  if (blocks.length <= 1) {
    blocks = text.split(/\n\s*\n/g).map((b) => b.trim()).filter(Boolean);
  }
  return blocks;
}

/**
 * Aligns reference numbers and amounts positionally in text so index N of reference_number pairs with index N of amount.
 */
function alignReferenceNumberAndAmountResults(results = [], cleanText = "") {
  if (!Array.isArray(results) || results.length === 0 || !cleanText) return results;

  const refResult = results.find(
    (r) => (r.result_field || "").toLowerCase().includes("reference") || (r.result_field || "").toLowerCase().includes("tx")
  );
  const amtResult = results.find(
    (r) => (r.result_field || "").toLowerCase().includes("amount") || (r.result_field || "").toLowerCase().includes("price")
  );

  if (!refResult || !amtResult) return results;

  const refVals = refResult.all_values && refResult.all_values.length > 0 ? refResult.all_values : [refResult.value];
  const amtVals = amtResult.all_values && amtResult.all_values.length > 0 ? amtResult.all_values : [amtResult.value];

  if (refVals.length === 0 || amtVals.length === 0) return results;

  const cleanAmtVals = amtVals.filter((a) => !refVals.some((r) => r.includes(a)));
  const effectiveAmtVals = cleanAmtVals.length > 0 ? cleanAmtVals : amtVals;

  const blocks = splitTextIntoConfirmationBlocks(cleanText);

  if (blocks.length > 1) {
    const pairedRefs = [];
    const pairedAmts = [];

    blocks.forEach((block) => {
      const blockClean = block.replace(/[\r\n\s\.]+/g, "");
      const blockRef = refVals.find(
        (r) => blockClean.includes(r.replace(/[\r\n\s\.]+/g, "")) || block.includes(r)
      );

      let blockAmt = null;
      for (const a of effectiveAmtVals) {
        const aIdx = block.indexOf(a);
        if (aIdx !== -1 && !isNewBalanceContext(block, aIdx)) {
          blockAmt = a;
          break;
        }
      }

      if (blockRef) {
        pairedRefs.push(blockRef);
        pairedAmts.push(blockAmt || effectiveAmtVals[0]);
      }
    });

    if (pairedRefs.length > 0 && pairedAmts.length > 0) {
      refResult.all_values = pairedRefs;
      refResult.value = pairedRefs[0];
      amtResult.all_values = pairedAmts;
      amtResult.value = pairedAmts[0];
      return results;
    }
  }

  const refPos = refVals.map((val) => {
    const idx = cleanText.indexOf(val);
    return { val, idx: idx !== -1 ? idx : 0 };
  });

  const amtPos = effectiveAmtVals.map((val) => {
    const idx = cleanText.indexOf(val);
    return { val, idx: idx !== -1 ? idx : 0 };
  });

  refPos.sort((a, b) => a.idx - b.idx);

  const pairedAmounts = [];
  const usedAmtIndices = new Set();

  refPos.forEach((rObj) => {
    let bestDist = Infinity;
    let bestIdx = -1;

    amtPos.forEach((aObj, aIdx) => {
      let dist = Math.abs(aObj.idx - rObj.idx);
      if (dist < bestDist && !usedAmtIndices.has(aIdx)) {
        bestDist = dist;
        bestIdx = aIdx;
      }
    });

    if (bestIdx !== -1) {
      usedAmtIndices.add(bestIdx);
      pairedAmounts.push(amtPos[bestIdx].val);
    } else {
      pairedAmounts.push(effectiveAmtVals[0]);
    }
  });

  refResult.all_values = refPos.map((r) => r.val);
  refResult.value = refResult.all_values[0];

  amtResult.all_values = pairedAmounts;
  amtResult.value = amtResult.all_values[0];

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
    const ecoMatchesClean = Array.from(cleanText.matchAll(/\b(MP[\s\n\.\d]{8,25}T\d{7})\b/gi));
    ecoMatchesClean.forEach((m) => addVal((m[1] || m[0]).replace(/[\s\r\n]+/g, "")));

    const ecoMatchesCollapsed = Array.from(collapsedText.matchAll(/\b(MP\d{6}\.\d{4}\.T\d{7})\b/gi));
    ecoMatchesCollapsed.forEach((m) => addVal(m[1] || m[0]));

    // Cursive / script tolerant EcoCash matcher (handles spaces, m/p casing, character variations)
    const cursiveEcoMatches = Array.from(
      cleanText.matchAll(/\b([Mml1IuUivIV]{1,2}[\s\.]*[PpDDRþ]{1}[\s\.]*\d{6,8}[\s\.\,:\-]*\d{3,4}[\s\.\,:\-]*[Tt7Il1]{1}[\s\.]*\d{6,8})\b/gi)
    );
    cursiveEcoMatches.forEach((m) => addVal((m[1] || m[0])));

    const labelMatches = Array.from(cleanText.matchAll(/(?:ref(?:erence)?|tx(?:id)?|code|no\.?|id|approval)[:=\s]+([A-Z0-9.\-_]{4,35})/gi));
    labelMatches.forEach((m) => {
      const val = (m[1] || "").trim();
      const isPhoneLike = /^([+41fti*#]?2637|07)\d{8}$/i.test(val) || (/^\d{10,12}$/.test(val) && val.startsWith("263"));
      if (!isPhoneLike && val.length >= 4) addVal(val);
    });

    const genMatches = Array.from(cleanText.matchAll(/\b([A-Z]{2}[\s\n\.\d]{8,25}[A-Z0-9]{7,10})\b/gi));
    genMatches.forEach((m) => addVal((m[1] || m[0]).replace(/[\s\r\n]+/g, "")));
  }

  // Amount / Price / Cost
  if (fk.includes("amount") || fk.includes("price") || fk.includes("cost") || fk.includes("sum")) {
    const usdMatches = Array.from(cleanText.matchAll(/(?:\bUSD\s*|\$|[Ss])\s*(\d+(?:[.,]\d{2})?)/gi));
    usdMatches.forEach((m) => {
      if (!isNewBalanceContext(cleanText, m.index)) {
        addVal(m[1] || m[0]);
      }
    });

    const decimalMatches = Array.from(cleanText.matchAll(/\b(\d+[.,]\d{2})\b/g));
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
    const zimMatches = Array.from(cleanText.matchAll(/\b([+41fti*#]?2637\d{8}|07\d{8})\b/gi));
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
      pattern: "(?:[Mml1IuUivIV]{1,2}[\\s\\.]*[PpDDRþ]{1}[\\s\\.]*\\d{6,8}[\\s\\.,:\\-]*\\d{3,4}[\\s\\.,:\\-]*[Tt7Il1]{1}[\\s\\.]*\\d{6,8})|(?:MP[\\s\\n\\.\\d]{8,25}T\\d{7})|(?:\\b(?:ref(?:erence)?|tx(?:id)?|approval|code|no\\.?)\\b\\s*[:=]?\\s*(?:is\\s+)?([A-Z0-9.\\-_]{6,35}))",
      description: "Standard & Cursive EcoCash or general transaction reference / approval code format (e.g. MP260831.1923.T7382831 or REF123456)",
      is_enabled: true,
    },
    {
      id: 2,
      company_id: companyId,
      name: "Amount",
      result_field: "amount",
      extraction_method: "regex",
      pattern: "(?:\\$|USD\\s*|[Ss])(\\d+(?:[.,]\\d{2})?)|\\b(\\d+[.,]\\d{2})\\b",
      description: "Currency amount numeral format excluding New Balance (e.g. 25.00)",
      is_enabled: true,
    },
    {
      id: 3,
      company_id: companyId,
      name: "Date",
      result_field: "date",
      extraction_method: "regex",
      pattern: "\\b\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}\\b",
      description: "Standard date format DD/MM/YYYY",
      is_enabled: true,
    },
    {
      id: 4,
      company_id: companyId,
      name: "Time",
      result_field: "time",
      extraction_method: "regex",
      pattern: "\\b\\d{1,2}:\\d{2}(?::\\d{2})?\\b",
      description: "Time format HH:MM (24-hour)",
      is_enabled: true,
    },
    {
      id: 5,
      company_id: companyId,
      name: "Phone Number",
      result_field: "phone_number",
      extraction_method: "regex",
      pattern: "[+41fti*#]?2637\\d{8}|07\\d{8}",
      description: "Customer phone number format (+263779431682 or 0779431682)",
      is_enabled: true,
    },
    {
      id: 6,
      company_id: companyId,
      name: "Account Number",
      result_field: "account_number",
      extraction_method: "regex",
      pattern: "[+41fti*#]?2637\\d{8}|07\\d{8}|\\b\\d{8,16}\\b",
      description: "Account number or international phone format (+263779431682)",
      is_enabled: true,
    },
  ];
}

