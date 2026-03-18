from __future__ import annotations

import re

THAI_TOKEN_RE = re.compile(r"[\u0E00-\u0E7Fa-zA-Z0-9]+")


def segment_text(text: str) -> list[str]:
    try:
        from pythainlp.tokenize import word_tokenize

        tokens = word_tokenize(text, engine="newmm")
    except Exception:
        tokens = THAI_TOKEN_RE.findall(text)

    return [token.strip() for token in tokens if THAI_TOKEN_RE.search(token or "")]

