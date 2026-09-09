// Translation Service for English <-> Shona (and vice versa)
import { API_BASE } from "./api";

// Comprehensive domain-specific dictionary for fast & reliable ISP/Support translation
const SUPPORT_DICTIONARY = {
  // Greetings & Common courtesies
  "hello": "mhoroi",
  "hi": "mhoro",
  "good morning": "mangwanani",
  "good afternoon": "masikati",
  "good evening": "manheru",
  "thank you": "tatenda",
  "thank you very much": "tatenda chaizvo",
  "you are welcome": "tinozvitenda",
  "please": "ndapota",
  "sorry for the inconvenience": "tine urombo nekukanganisika",
  "how can i help you today?": "ndingagone kukubatsirai sei nhasi?",
  "how can i help you": "ndingagone kukubatsirai sei",

  // Account & Support Queries
  "what is your account number?": "chii nhamba yeakaundi yenyu?",
  "account number": "nhamba yeakaundi",
  "phone number": "nhamba yerunhare",
  "email address": "kero ye-email",
  "reference number": "nhamba dereferensi",
  "ticket number": "nhamba yetikiti",
  "customer care": "rutsigiro rwatengi",
  "support team": "chikwata cherutsigiro",

  // Technical & Network Escalation terms
  "technical support": "rutsigiro rweunyanzvi",
  "technical team": "chikwata cheunyanzvi",
  "network team": "chikwata chesainzi yetiweki",
  "escalated": "zvatumirwa kune vanobatsira vamberi",
  "your ticket has been escalated": "tikiti renyu rakwidziridzwa kune vanobatsira mberi",
  "your query has been escalated to technical support": "mubvunzo wenyu watumirwa kune vakwidzi veunyanzvi",
  "we are currently investigating the issue": "parizvino tiri kuferefeta dambudziko iri",
  "connection issue": "dambudziko riine chekuita nekubatana kwewebhu",
  "internet down": "internet haisi kushanda",
  "slow connection": "internet iri kunonoka",
  "no signal": "hapana chikwangwani mesainzi",
  "router": "mugadzirisi wandandaro (router)",
  "please restart your router": "ndapota dzimurayi nekutangidza router yenyu",
  "turn off the router for 30 seconds": "dzimurai router kwemasekonzi makumi matatu",
  "fibre connection": "kubatana kwefibre",
  "power light": "mwenje wesimba",
  "red light": "mwenje mupfumbu/mupfuwira",

  // Resolution & Billing
  "resolved": "zvatadzoreredzwa panzvimbo",
  "the issue has been resolved": "dambudziko ragadziriswa",
  "service restored": "basa radzoreredzwa",
  "payment": "mubhadharo",
  "invoice": "nhoroondo yemubhadharo (invoice)",
  "balance": "mhedzisiro yemari",
  "thank you for choosing us": "tinokutendai nekusarudza isu",
};

const REVERSE_DICTIONARY = Object.entries(SUPPORT_DICTIONARY).reduce((acc, [en, sn]) => {
  acc[sn.toLowerCase()] = en;
  return acc;
}, {});

const SUPPORT_NDEBELE_DICTIONARY = {
  // Greetings & Common courtesies (Northern Ndebele / Zimbabwean Ndebele)
  "hello": "salibonani",
  "hi": "salibonani",
  "good morning": "livukile",
  "good afternoon": "litshonile",
  "good evening": "litshonile",
  "thank you": "siyabonga",
  "thank you very much": "siyabonga kakhulu",
  "you are welcome": "wamukelekile",
  "please": "cela",
  "sorry for the inconvenience": "siyaxolisa ngokuhluphiseka",
  "how can i help you today?": "ngingalithusa njani lamuhla?",
  "how can i help you": "ngingalithusa njani",

  // Account & Technical Queries
  "account number": "inombolo ye-akhawunti",
  "phone number": "inombolo yocingo",
  "email address": "ikheli le-imeyili",
  "ticket number": "inombolo yetikiti",
  "reference number": "inombolo yokukhomba",
  "technical support": "usizo lwethekhinikhali",
  "technical team": "iqembu lethekhinikhali",
  "support team": "iqembu losizo",
  "customer care": "usizo lwabathengi",
  "escalated": "udluliselwe kubasizi abaphezulu",
  "your ticket has been escalated": "itikiti lakho lidluliselwe eqenjini lethu eliphezulu lethekhinikhali",
  "your query has been escalated to technical support": "umbuzo wakho udluliselwe eqenjini lethekhinikhali",
  "we are currently investigating the issue": "kusasebenzwa njalo kuhlolisiswa inkinga le okwakhathesi",
  "connection issue": "inkinga yokuxhumana kwewebhu",
  "internet down": "inthanethi kayisebenzi",
  "slow connection": "inthanethi inyenyezela",
  "no signal": "kakulamaza",
  "router": "i-router",
  "please restart your router": "cela ucime i-router yakho okwemizuzwana engamashumi amathathu uyivuse njalo",
  "turn off the router for 30 seconds": "cima i-router okwemizuzwana engamashumi amathathu",
  "fibre connection": "ukuxhumana kwe-fibre",
  "resolved": "kulungisisiwe",
  "the issue has been resolved": "inkinga yakho ilungisisiwe",
  "service restored": "inkonzo ibuyiselwe",
  "payment": "inkokhelo",
  "invoice": "i-invoysi",
  "balance": "ibhalansi",
  "thank you for choosing us": "siyabonga ngokukhetha thina",

  // Additional ISP & Common Support Vocabulary
  "please provide your registered account number": "cela unikeze inombolo yakho ye-akhawunti ebhalisiweyo",
  "please provide": "cela unikeze",
  "registered account number": "inombolo ye-akhawunti ebhalisiweyo",
  "registered": "ebhalisiweyo",
  "query": "umbuzo",
  "request": "isicelo",
  "issue": "inkinga",
  "problem": "inkinga",
  "customer": "umthengi",
  "client": "umthengi",
  "refund": "imbuyiselo",
  "refunds": "izimbuyiselo",
  "details": "imininingwane",
  "information": "ulwazi",
  "message": "umlayezo",
  "status": "isimo",
  "working": "iyasebenza",
  "not working": "kayisebenzi",
  "fixed": "ilungisiwe",
  "help": "usizo",
  "days": "izinsuku",
  "business days": "izinsuku zomsebenzi",
};

const REVERSE_NDEBELE_DICTIONARY = Object.entries(SUPPORT_NDEBELE_DICTIONARY).reduce((acc, [en, nd]) => {
  acc[nd.toLowerCase()] = en;
  return acc;
}, {});

export function truncateToMaxBytes(str, maxBytes = 500) {
  if (!str) return "";
  if (typeof TextEncoder !== "undefined" && typeof TextDecoder !== "undefined") {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    if (bytes.length <= maxBytes) return str;
    const decoder = new TextDecoder("utf-8");
    return decoder.decode(bytes.slice(0, maxBytes));
  }
  return str.slice(0, maxBytes);
}

/**
 * Translate text between English, Shona, and IsiNdebele
 * @param {string} text - Source text
 * @param {string} sourceLang - 'en', 'sn', or 'nd'
 * @param {string} targetLang - 'sn', 'en', or 'nd'
 * @returns {Promise<{ translatedText: string, provider: string }>}
 */
export async function translateText(text, sourceLang = "en", targetLang = "sn") {
  if (!text || !text.trim()) {
    return { translatedText: "", provider: "empty" };
  }

  const cleanText = text.trim();
  let src = sourceLang.toLowerCase();
  let tgt = targetLang.toLowerCase();

  // Standardize Ndebele code: 'nd' or 'nde' -> 'nde' (isiNdebele Zimbabwe)
  if (src === "nd") src = "nde";
  if (tgt === "nd") tgt = "nde";

  // 1. Direct & normalized dictionary match check
  const lowerText = cleanText.toLowerCase();
  const normText = lowerText.replace(/[.?!,]+$/g, "");

  if (src === "en" && tgt === "sn" && (SUPPORT_DICTIONARY[lowerText] || SUPPORT_DICTIONARY[normText])) {
    return { translatedText: matchCase(cleanText, SUPPORT_DICTIONARY[lowerText] || SUPPORT_DICTIONARY[normText]), provider: "dictionary" };
  }
  if (src === "sn" && tgt === "en" && (REVERSE_DICTIONARY[lowerText] || REVERSE_DICTIONARY[normText])) {
    return { translatedText: matchCase(cleanText, REVERSE_DICTIONARY[lowerText] || REVERSE_DICTIONARY[normText]), provider: "dictionary" };
  }
  if (src === "en" && (tgt === "nde" || tgt === "nd") && (SUPPORT_NDEBELE_DICTIONARY[lowerText] || SUPPORT_NDEBELE_DICTIONARY[normText])) {
    return { translatedText: matchCase(cleanText, SUPPORT_NDEBELE_DICTIONARY[lowerText] || SUPPORT_NDEBELE_DICTIONARY[normText]), provider: "dictionary" };
  }
  if ((src === "nde" || src === "nd") && tgt === "en" && (REVERSE_NDEBELE_DICTIONARY[lowerText] || REVERSE_NDEBELE_DICTIONARY[normText])) {
    return { translatedText: matchCase(cleanText, REVERSE_NDEBELE_DICTIONARY[lowerText] || REVERSE_NDEBELE_DICTIONARY[normText]), provider: "dictionary" };
  }

  // 2. Call backend `/translate` endpoint (NLLB-200 for nde, Google Translate for sn)
  try {
    const res = await fetch(`${API_BASE}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleanText, source_lang: src, target_lang: tgt }),
    });

    if (res.ok) {
      const data = await res.json();
      const textResult = data.translatedText || data.translated_text;
      if (
        textResult &&
        textResult.trim() &&
        data.provider !== "fallback"
      ) {
        return {
          translatedText: textResult,
          provider: data.provider || "backend",
        };
      }
    }
  } catch (err) {
    console.warn("Backend translation API unavailable, using dictionary fallback:", err);
  }

  // 3. Word-by-word & phrase dictionary substitution fallback
  const dict =
    src === "en"
      ? (tgt === "nde" || tgt === "nd")
        ? SUPPORT_NDEBELE_DICTIONARY
        : SUPPORT_DICTIONARY
      : (src === "nde" || src === "nd")
        ? REVERSE_NDEBELE_DICTIONARY
        : REVERSE_DICTIONARY;

  let phraseReplaced = cleanText;
  let substituted = false;

  const sortedKeys = Object.keys(dict).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    const value = dict[key];
    const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    if (regex.test(phraseReplaced)) {
      phraseReplaced = phraseReplaced.replace(regex, (m) => {
        if (m && m[0] && m[0] === m[0].toUpperCase()) {
          return value.charAt(0).toUpperCase() + value.slice(1);
        }
        return value;
      });
      substituted = true;
    }
  }

  return {
    translatedText: phraseReplaced,
    provider: substituted ? "dictionary_partial" : "original",
  };
}

// Case helper to match capitalization pattern of original text
function matchCase(original, translated) {
  if (!original || !translated) return translated;
  if (original === original.toUpperCase()) return translated.toUpperCase();
  if (original[0] === original[0].toUpperCase()) {
    return translated.charAt(0).toUpperCase() + translated.slice(1);
  }
  return translated;
}

// Default preset common support phrases
export const DEFAULT_PRESET_PHRASES = [
  {
    label: "Issue Escalation",
    en: "Your query has been escalated to our senior technical support team for investigation.",
    sn: "Mubvunzo wenyu watumirwa kune chikwata chedu chikuru cheunyanzvi kuti uferefetiwe.",
    nd: "Umbuzo wakho usiwe eqenjini lethu eliphezulu lethekhinikhali ukuba lihlolisiswe.",
  },
  {
    label: "Request Account no.",
    en: "Please provide your registered account number or phone number.",
    sn: "Ndapota ipai nhamba yeakaundi yenyu yakanyoreswa kana nhamba yerunhare.",
    nd: "Cela unikeze inombolo yakho ye-akhawunti ebhalisiweyo loba inombolo yocingo.",
  },
  {
    label: "Issue Resolved",
    en: "We are pleased to inform you that your reported issue has been resolved.",
    sn: "Tinofara kukuzivisai kuti dambudziko ramakataura ragadziriswa.",
    nd: "Siyathokoza ukukubikela ukuthi inkinga oyibikileyo ilungisisiwe.",
  },
];

export const PRESET_PHRASES_KEY = "rea_preset_phrases_v1";

export function getPresetPhrases() {
  try {
    const stored = localStorage.getItem(PRESET_PHRASES_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Error reading preset phrases:", e);
  }
  return DEFAULT_PRESET_PHRASES;
}

export function savePresetPhrases(phrases) {
  try {
    localStorage.setItem(PRESET_PHRASES_KEY, JSON.stringify(phrases));
    window.dispatchEvent(new Event("rea_preset_phrases_updated"));
  } catch (e) {
    console.error("Error saving preset phrases:", e);
  }
}

export const PRESET_TRANSLATION_PHRASES = getPresetPhrases();
