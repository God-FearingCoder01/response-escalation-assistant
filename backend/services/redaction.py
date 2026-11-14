"""Masks customer-identifying details before text leaves REA for an outside AI provider.

Detected values are swapped for stable placeholders such as ``[EMAIL_1]``. The AI sees
only the placeholders; once its reply comes back, ``Redactor.restore`` puts the real
values back so the agent sees a ready-to-send message. The mapping lives only in memory
for the duration of one request and is never stored or logged.

This is a safety net, not a guarantee: free-text names cannot be detected reliably, so
agents can list names to hide explicitly (``hide_terms``). The patterns deliberately
over-mask rather than under-mask (any token holding six or more digits in a row is
treated as a reference/account number).
"""
import re
from typing import Dict, Iterable, List

# Order matters: more specific patterns first so e.g. a phone number is labelled PHONE
# rather than swallowed by the generic long-number rule.
_PATTERNS: List[tuple[str, re.Pattern]] = [
    ("EMAIL", re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")),
    # Zimbabwean national ID, e.g. 63-123456 A 78.
    ("ID", re.compile(r"(?<![\w])\d{2}[ \-]?\d{6,7}[ \-]?[A-Za-z][ \-]?\d{2}(?![\w])")),
    # International numbers such as +263 77 212 3456. Must run before CARD, otherwise the
    # digits would be taken as a card number and the leading "+" left behind.
    ("PHONE", re.compile(r"(?<![\w])\+\d[\d \-()]{7,16}\d(?![\w])")),
    # 13-19 digits, optionally grouped by spaces or dashes (payment card numbers).
    ("CARD", re.compile(r"(?<![\w])(?:\d[ \-]?){12,18}\d(?![\w])")),
    # Local numbers in any grouping (0772123456, 077 212 3456, 0772 123 456): a leading 0
    # followed by 8-10 more digits with optional single spaces or dashes between them.
    ("PHONE", re.compile(r"(?<![\w])0(?:[ \-]?\d){8,10}(?![\w])")),
    # Anything that looks like an account, ticket, transaction or reference number:
    # a token containing six or more consecutive digits.
    ("REF", re.compile(r"(?<![\w])(?=[A-Za-z0-9._\-]*\d{6})[A-Za-z0-9][A-Za-z0-9._\-]{5,}(?![\w])")),
]

_TOKEN = re.compile(r"\[(?:EMAIL|CARD|ID|PHONE|REF|NAME)_\d+\]")


class Redactor:
    def __init__(self, hide_terms: Iterable[str] = ()):
        # Longest first so "John Banda" is masked before "John".
        cleaned = {t.strip() for t in hide_terms if t and len(t.strip()) >= 2}
        self._terms = sorted(cleaned, key=len, reverse=True)
        # One combined pattern (longest alternatives first) so every name is masked in a
        # single pass and a placeholder that was just created is never scanned again.
        self._terms_pattern = (
            re.compile("|".join(re.escape(t) for t in self._terms), re.IGNORECASE) if self._terms else None
        )
        self._by_value: Dict[str, str] = {}
        self._originals: Dict[str, str] = {}
        self._counters: Dict[str, int] = {}

    def _token_for(self, kind: str, value: str) -> str:
        key = f"{kind}\0{value}"  # exact text, so original casing is restored exactly
        existing = self._by_value.get(key)
        if existing:
            return existing
        self._counters[kind] = self._counters.get(kind, 0) + 1
        token = f"[{kind}_{self._counters[kind]}]"
        self._by_value[key] = token
        self._originals[token] = value
        return token

    def redact(self, text: str) -> str:
        if not text:
            return text
        # Structured data first, so an email such as "tendai.m@mail.com" is masked whole
        # even when "Tendai" is also a hidden name.
        for kind, pattern in _PATTERNS:
            text = pattern.sub(lambda m, k=kind: self._token_for(k, m.group(0)), text)
        return self._hide_terms(text)

    def _hide_terms(self, text: str) -> str:
        if not self._terms_pattern:
            return text
        # Work only on the text between existing placeholders, so a hidden term like "ID"
        # or "NAME" can never corrupt a token such as [ID_1].
        pieces = []
        last = 0
        for token in _TOKEN.finditer(text):
            pieces.append(self._mask_names(text[last:token.start()]))
            pieces.append(token.group(0))
            last = token.end()
        pieces.append(self._mask_names(text[last:]))
        return "".join(pieces)

    def _mask_names(self, segment: str) -> str:
        return self._terms_pattern.sub(lambda m: self._token_for("NAME", m.group(0)), segment)

    def restore(self, text: str) -> str:
        if not text:
            return text
        return _TOKEN.sub(lambda m: self._originals.get(m.group(0), m.group(0)), text)

    def summary(self) -> Dict[str, int]:
        """How many distinct items of each kind were masked (never the values)."""
        return dict(self._counters)
