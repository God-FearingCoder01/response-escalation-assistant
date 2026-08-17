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
  "hello": "salibonani",
  "hi": "salibonani",
  "good morning": "sabona",
  "good afternoon": "litshonile",
  "good evening": "litshonile",
  "thank you": "siyabonga",
  "thank you very much": "siyabonga kakhulu",
  "you are welcome": "wamukelekile",
  "please": "cela",
  "sorry for the inconvenience": "siyaxolisa ngokuhlupheka",
  "how can i help you today?": "ngingakusiza njani lamuhla?",
  "how can i help you": "ngingakusiza njani",
  "account number": "inombolo ye-akhawunti",
  "phone number": "inombolo yocingo",
  "email address": "ikheli le-eyili",
  "ticket number": "inombolo yetikiti",
  "reference number": "inombolo yokukhomba",
  "technical support": "usizo lwethekhinikhali",
  "technical team": "iqembu lethekhinikhali",
  "support team": "iqembu losizo",
  "customer care": "usizo lwabathengi",
  "escalated": "itshiyiwe kubasizi abaphezulu",
  "your ticket has been escalated": "itikiti lakho lisiwe eqenjini lethu eliphezulu lethekhinikhali",
  "your query has been escalated to technical support": "umbuzo wakho udluliselwe eqenjini lethekhinikhali",
  "we are currently investigating the issue": "kusakhangelwa inkinga le okwakhathesi",
  "connection issue": "inkinga yokuxhumana kwewebhu",
  "internet down": "iyinthanethi kayisebenzi",
  "slow connection": "iyinthanethi inyenyezela",
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
  const src = sourceLang.toLowerCase();
  const tgt = targetLang.toLowerCase();

  // 1. Direct & normalized dictionary match check
  const lowerText = cleanText.toLowerCase();
  const normText = lowerText.replace(/[.?!,]+$/g, "");

  if (src === "en" && tgt === "sn" && (SUPPORT_DICTIONARY[lowerText] || SUPPORT_DICTIONARY[normText])) {
    return { translatedText: matchCase(cleanText, SUPPORT_DICTIONARY[lowerText] || SUPPORT_DICTIONARY[normText]), provider: "dictionary" };
  }
  if (src === "sn" && tgt === "en" && (REVERSE_DICTIONARY[lowerText] || REVERSE_DICTIONARY[normText])) {
    return { translatedText: matchCase(cleanText, REVERSE_DICTIONARY[lowerText] || REVERSE_DICTIONARY[normText]), provider: "dictionary" };
  }
  if (src === "en" && tgt === "nd" && (SUPPORT_NDEBELE_DICTIONARY[lowerText] || SUPPORT_NDEBELE_DICTIONARY[normText])) {
    return { translatedText: matchCase(cleanText, SUPPORT_NDEBELE_DICTIONARY[lowerText] || SUPPORT_NDEBELE_DICTIONARY[normText]), provider: "dictionary" };
  }
  if (src === "nd" && tgt === "en" && (REVERSE_NDEBELE_DICTIONARY[lowerText] || REVERSE_NDEBELE_DICTIONARY[normText])) {
    return { translatedText: matchCase(cleanText, REVERSE_NDEBELE_DICTIONARY[lowerText] || REVERSE_NDEBELE_DICTIONARY[normText]), provider: "dictionary" };
  }

  // 2. Call backend `/translate` endpoint if available
  try {
    const res = await fetch(`${API_BASE}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleanText, source_lang: src, target_lang: tgt }),
    });

    if (res.ok) {
      const data = await res.json();
      if (
        data.translatedText &&
        data.translatedText.trim() &&
        data.provider !== "fallback" &&
        !data.translatedText.toLowerCase().includes("mymemory warning") &&
        !data.translatedText.toLowerCase().includes("is not available")
      ) {
        return {
          translatedText: data.translatedText,
          provider: data.provider || "backend",
        };
      }
    }
  } catch (err) {
    console.warn("Backend translation API unavailable, trying client fallback:", err);
  }

  // 3. Fallback: Call MyMemory API directly from client (with Zulu fallback for IsiNdebele)
  const langPairsToTry = [
    `${src}|${tgt}`,
    ...(tgt === "nd" ? [`${src}|zu`, `${src}|nr`] : []),
    ...(src === "nd" ? [`zu|${tgt}`, `nr|${tgt}`] : []),
  ];

  const queryText = truncateToMaxBytes(cleanText, 500);

  for (const langpair of langPairsToTry) {
    try {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(queryText)}&langpair=${langpair}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data?.responseData?.translatedText) {
          const trans = data.responseData.translatedText;
          if (
            trans &&
            trans.toUpperCase() !== cleanText.toUpperCase() &&
            !trans.toLowerCase().includes("mymemory warning") &&
            !trans.toLowerCase().includes("is not available")
          ) {
            let cleanTrans = trans;
            if (langpair.endsWith("|zu") && tgt === "nd") {
              cleanTrans = cleanTrans
                .replace(/Sawubona/g, "Salibonani")
                .replace(/sawubona/g, "salibonani")
                .replace(/kanjani/g, "njani");
            }
            return { translatedText: cleanTrans, provider: "mymemory_client" };
          }
        }
      }
    } catch (err) {
      console.warn(`Client MyMemory translation failed for ${langpair}:`, err);
    }
  }

  // 4. Word-by-word & phrase dictionary substitution fallback
  const dict =
    src === "en"
      ? tgt === "nd"
        ? SUPPORT_NDEBELE_DICTIONARY
        : SUPPORT_DICTIONARY
      : src === "nd"
        ? REVERSE_NDEBELE_DICTIONARY
        : REVERSE_DICTIONARY;

  let phraseReplaced = cleanText;
  let substituted = false;

  const sortedKeys = Object.keys(dict).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    const value = dict[key];
    const regex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    if (regex.test(phraseReplaced)) {
      phraseReplaced = phraseReplaced.replace(regex, value);
      substituted = true;
    }
  }

  if (substituted) {
    return { translatedText: phraseReplaced, provider: "dictionary_partial" };
  }

  // 5. Ultimate fallback: Return original text with notice if unresolvable
  return { translatedText: cleanText, provider: "original" };
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
