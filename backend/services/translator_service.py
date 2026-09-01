import json
import re
import urllib.parse
import urllib.request

SUPPORT_DICTIONARY_SHONA = {
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
    "account number": "nhamba yeakaundi",
    "phone number": "nhamba yerunhare",
    "email address": "kero ye-email",
    "reference number": "nhamba dereferensi",
    "ticket number": "nhamba yetikiti",
    "customer care": "rutsigiro rwatengi",
    "support team": "chikwata cherutsigiro",
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
    "resolved": "zvatadzoreredzwa panzvimbo",
    "the issue has been resolved": "dambudziko ragadziriswa",
    "service restored": "basa radzoreredzwa",
    "payment": "mubhadharo",
    "invoice": "nhoroondo yemubhadharo (invoice)",
    "balance": "mhedzisiro yemari",
    "thank you for choosing us": "tinokutendai nekusarudza isu",
}

SUPPORT_DICTIONARY_NDEBELE = {
    "hello": "salibonani",
    "hi": "salibonani",
    "good morning": "livukile",
    "good afternoon": "litshone njani",
    "good evening": "litshone njani",
    "thank you": "siyabonga",
    "thank you very much": "siyabonga kakhulu",
    "you are welcome": "wamukelekile",
    "please": "sicela",
    "sorry for the inconvenience": "siyaxolisa ngokuphazamiseka",
    "how can i help you today?": "singakusiza njani lamuhla?",
    "how can i help you": "singakusiza njani",
    "account number": "inamba ye-akhawunti",
    "phone number": "inamba yefoni",
    "email address": "ikheli ye-imeyili",
    "reference number": "inamba yerifarensi",
    "ticket number": "inamba yetikiti",
    "customer care": "usonhlalakahle wabathengi",
    "support team": "ithimu yesizo",
    "technical support": "isizo lobuchwepheshe",
    "technical team": "ithimu yezobuchwepheshe",
    "network team": "ithimu yezokuxhumana",
    "escalated": "kudluliselwe kubaphathi benkonzo",
    "your ticket has been escalated": "itikiti lakho lidluliselwe kwabezobuchwepheshe",
    "your query has been escalated to technical support": "umbuzo wakho udluliselwe kwabezobuchwepheshe",
    "we are currently investigating the issue": "okwamanje siphenya ngale ndaba",
    "connection issue": "inkinga yokuxhumana",
    "internet down": "intanethi ayisebenzi",
    "slow connection": "intanethi ihamba kancane",
    "no signal": "akula sinyali",
    "router": "irawutha (router)",
    "please restart your router": "sicela ucime ubuye uvuse irawutha yakho",
    "turn off the router for 30 seconds": "cima irawutha imizuzwana engamashumi amathathu",
    "fibre connection": "uxhumano lwe-fibre",
    "power light": "isibani samandla",
    "red light": "isibani esibovu",
    "resolved": "kulungisiwe",
    "the issue has been resolved": "inkinga isilungisiwe",
    "service restored": "inthanethi isibuyele esimeni",
    "payment": "imbhadhalo",
    "invoice": "an-invoyisi",
    "balance": "amabalansi",
    "thank you for choosing us": "siyabonga ngokukhetha thina",
}


def _mask_placeholders(text: str):
    placeholders = re.findall(r"\{[^}]+\}", text)
    token_map = {}
    masked_text = text
    for i, ph in enumerate(placeholders):
        tok = f"__PH_{i}__"
        token_map[tok] = ph
        masked_text = masked_text.replace(ph, tok)
    return masked_text, token_map


def _unmask_placeholders(text: str, token_map: dict) -> str:
    out = text
    for tok, original_ph in token_map.items():
        out = out.replace(tok, original_ph)
        out = out.replace(tok.lower(), original_ph)
    return out


def _call_google_translate_api(text: str, target_lang_code: str) -> str | None:
    try:
        masked_text, token_map = _mask_placeholders(text)
        url = (
            "https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl="
            + urllib.parse.quote(target_lang_code)
            + "&dt=t&q="
            + urllib.parse.quote(masked_text)
        )
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode("utf-8"))
            if data and isinstance(data, list) and len(data) > 0 and data[0]:
                translated_pieces = [item[0] for item in data[0] if item and len(item) > 0 and item[0]]
                translated_full = "".join(translated_pieces)
                return _unmask_placeholders(translated_full, token_map)
    except Exception as e:
        print("Google Translate API call failed:", e)
    return None


def translate_text_with_engine(text_input: str, target_lang: str) -> tuple[str, str]:
    if not text_input or not text_input.strip():
        return "", "empty"

    lang = target_lang.strip().lower()
    is_shona = lang in ["shona", "sn"]
    dictionary = SUPPORT_DICTIONARY_SHONA if is_shona else SUPPORT_DICTIONARY_NDEBELE

    clean = text_input.strip()
    clean_lower = clean.lower()

    # 1. Exact dictionary phrase match
    if clean_lower in dictionary:
        return dictionary[clean_lower], "dictionary"

    # 2. External Engine API call (Google Translate / NLLB-200)
    if is_shona:
        gt_result = _call_google_translate_api(clean, "sn")
        if gt_result and gt_result.strip():
            return gt_result, "google_translate"
    else:
        # Ndebele -> NLLB-200 / Google Engine (tl=nr / tl=zu)
        gt_result = _call_google_translate_api(clean, "nr")
        if not gt_result:
            gt_result = _call_google_translate_api(clean, "zu")
        if gt_result and gt_result.strip():
            return gt_result, "nllb_200"

    # 3. Fallback: Phrase substitution using support dictionary
    result = clean
    sorted_phrases = sorted(dictionary.keys(), key=lambda x: len(x), reverse=True)
    for phrase in sorted_phrases:
        pattern = re.compile(re.escape(phrase), re.IGNORECASE)
        translated = dictionary[phrase]

        def replace_match(match):
            m = match.group(0)
            if m.isupper():
                return translated.upper()
            elif m and m[0].isupper():
                return translated.capitalize()
            return translated

        result = pattern.sub(replace_match, result)

    provider = "dictionary" if result != clean else "fallback"
    return result, provider


def translate_text(text_input: str, target_lang: str) -> str:
    res, _ = translate_text_with_engine(text_input, target_lang)
    return res
