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

// Reverse dictionary (Shona -> English)
const REVERSE_DICTIONARY = Object.entries(SUPPORT_DICTIONARY).reduce((acc, [en, sn]) => {
  acc[sn.toLowerCase()] = en;
  return acc;
}, {});

/**
 * Translate text between English and Shona
 * @param {string} text - Source text
 * @param {string} sourceLang - 'en' or 'sn'
 * @param {string} targetLang - 'sn' or 'en'
 * @returns {Promise<{ translatedText: string, provider: string }>}
 */
export async function translateText(text, sourceLang = "en", targetLang = "sn") {
  if (!text || !text.trim()) {
    return { translatedText: "", provider: "empty" };
  }

  const cleanText = text.trim();
  const src = sourceLang.toLowerCase();
  const tgt = targetLang.toLowerCase();

  // 1. Direct dictionary exact match check
  const lowerText = cleanText.toLowerCase();
  if (src === "en" && tgt === "sn" && SUPPORT_DICTIONARY[lowerText]) {
    return { translatedText: matchCase(cleanText, SUPPORT_DICTIONARY[lowerText]), provider: "dictionary" };
  }
  if (src === "sn" && tgt === "en" && REVERSE_DICTIONARY[lowerText]) {
    return { translatedText: matchCase(cleanText, REVERSE_DICTIONARY[lowerText]), provider: "dictionary" };
  }

  // 2. Call backend `/translate` endpoint
  try {
    const res = await fetch(`${API_BASE}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: cleanText, source_lang: src, target_lang: tgt }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.translatedText && data.translatedText.trim()) {
        return {
          translatedText: data.translatedText,
          provider: data.provider || "backend",
        };
      }
    }
  } catch (err) {
    console.warn("Backend translation API unavailable, trying client fallback:", err);
  }

  // 3. Fallback: Call MyMemory API directly from client
  try {
    const langpair = `${src}|${tgt}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleanText)}&langpair=${langpair}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data?.responseData?.translatedText) {
        const trans = data.responseData.translatedText;
        if (trans && trans.toUpperCase() !== cleanText.toUpperCase()) {
          return { translatedText: trans, provider: "mymemory_client" };
        }
      }
    }
  } catch (err) {
    console.warn("Client MyMemory translation failed:", err);
  }

  // 4. Word-by-word phrase dictionary fallback if available
  const dict = src === "en" ? SUPPORT_DICTIONARY : REVERSE_DICTIONARY;
  let phraseReplaced = lowerText;
  let substituted = false;

  for (const [key, value] of Object.entries(dict)) {
    if (phraseReplaced.includes(key)) {
      phraseReplaced = phraseReplaced.replaceAll(key, value);
      substituted = true;
    }
  }

  if (substituted) {
    return { translatedText: matchCase(cleanText, phraseReplaced), provider: "dictionary_partial" };
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

// Preset common support phrases for quick selection in UI
export const PRESET_TRANSLATION_PHRASES = [
  { label: "Greeting", en: "Hello, thank you for contacting technical support. How can I assist you today?", sn: "Mhoroi, tinokutendai nekutibata pane rutsigiro rweunyanzvi. Ndingagone kukubatsirai sei nhasi?" },
  { label: "Ticket Escalation", en: "Your ticket has been escalated to our senior technical team for investigation.", sn: "Tikiti renyu rakwidziridzwa kune chikwata chedu chikuru cheunyanzvi kuti vakuferefete." },
  { label: "Restart Router", en: "Please restart your router by turning it off for 30 seconds and turning it back on.", sn: "Ndapota dzimurayi router yenyu kwemasekonzi makumi matatu uyezve moidzidzisa zvakare." },
  { label: "Request Account ID", en: "Please provide your account number or registered phone number.", sn: "Ndapota ipai nhamba yeakaundi yenyu kana nhamba yerunhare yakanyoreswa." },
  { label: "Issue Resolved", en: "We are pleased to inform you that your connection issue has been resolved.", sn: "Tinofara kukuzivisai kuti dambudziko renyu rekubatana kwewebhu ragadziriswa." },
];
