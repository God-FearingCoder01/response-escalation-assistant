import re

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


def translate_text(text_input: str, target_lang: str) -> str:
    lang = target_lang.strip().lower()
    dictionary = SUPPORT_DICTIONARY_SHONA if lang in ["shona", "sn"] else SUPPORT_DICTIONARY_NDEBELE

    result = text_input
    # Sort phrases by length descending to match longest matches first
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

    return result
