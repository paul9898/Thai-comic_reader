from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from pathlib import Path

from database import dictionary_entry_count, lookup_dictionary_entries, upsert_dictionary_entries
from models import DefinitionEntry, LookupResponse
from segmenter import segment_text

BASE_DIR = Path(__file__).resolve().parent
LEXITRON_PATH = BASE_DIR / "data" / "lexitron.json"
ROYAL_DICTIONARY_PATH = BASE_DIR.parent / "dictionary.js"
TELEX_DICTIONARY_PATH = BASE_DIR.parent / "telex-utf8.csv"
THAI_WORD_RE = re.compile(r"[\u0E00-\u0E7F]+")
HEADWORD_NUMBER_RE = re.compile(r"\s+[๐-๙0-9]+$")

FALLBACK_ENGLISH: dict[str, list[DefinitionEntry]] = {
    "สวัสดี": [DefinitionEntry(pos="interjection", meaning="hello; greetings")],
    "ครับ": [DefinitionEntry(pos="particle", meaning="polite sentence-final particle used by male speakers")],
    "ค่ะ": [DefinitionEntry(pos="particle", meaning="polite sentence-final particle used by female speakers")],
    "เหรอ": [DefinitionEntry(pos="particle", meaning="question particle expressing surprise, doubt, or confirmation, similar to 'really?' or 'is that so?'")],
    "หรอ": [DefinitionEntry(pos="particle", meaning="informal spelling of เหรอ; question particle expressing surprise or confirmation")],
    "จ๊ะ": [DefinitionEntry(pos="particle", meaning="soft sentence-final particle, often friendly or feminine in tone")],
    "จ้ะ": [DefinitionEntry(pos="particle", meaning="soft sentence-final particle, often friendly or feminine in tone")],
    "นะ": [DefinitionEntry(pos="particle", meaning="sentence-final particle used to soften, persuade, or seek agreement")],
    "ใคร": [DefinitionEntry(pos="pronoun", meaning="who")],
    "อะไร": [DefinitionEntry(pos="pronoun", meaning="what; anything")],
    "มา": [DefinitionEntry(pos="verb", meaning="to come")],
    "จะ": [DefinitionEntry(pos="auxiliary", meaning="marker of future tense, intention, or likelihood")],
    "ความ": [DefinitionEntry(pos="prefix", meaning="nominalizing prefix marking a state, quality, or abstract noun")],
    "ลับ": [DefinitionEntry(pos="adjective", meaning="secret; hidden; confidential")],
    "ความลับ": [DefinitionEntry(pos="noun", meaning="secret; secrecy; confidential matter")],
    "ถ่าย": [DefinitionEntry(pos="verb", meaning="to film; to photograph; to transfer or copy")],
    "กล้อง": [DefinitionEntry(pos="noun", meaning="camera")],
    "กล้องถ่าย": [DefinitionEntry(pos="noun", meaning="camera; recording device")],
    "บ้าน": [DefinitionEntry(pos="noun", meaning="house; home")],
    "พรุ่งนี้": [DefinitionEntry(pos="adverb", meaning="tomorrow")],
    "วันนี้": [DefinitionEntry(pos="adverb", meaning="today")],
    "นาย": [DefinitionEntry(pos="pronoun", meaning="you; he; young man, depending on context")],
    "ออกมา": [DefinitionEntry(pos="verb", meaning="to come out; to turn out; to be produced")],
    "ดี": [DefinitionEntry(pos="adjective", meaning="good; well")],
    "บอก": [DefinitionEntry(pos="verb", meaning="to tell; to inform")],
    "ให้": [DefinitionEntry(pos="verb", meaning="to give; to let; to allow")],
    "เจอ": [DefinitionEntry(pos="verb", meaning="to meet; to encounter")],
    "เจอกัน": [DefinitionEntry(pos="phrase", meaning="see you; meet each other")],
    "ถ้า": [DefinitionEntry(pos="conjunction", meaning="if")],
    "ใน": [DefinitionEntry(pos="preposition", meaning="in; within")],
    "วัน": [DefinitionEntry(pos="noun", meaning="day")],
}

FALLBACK_THAI: dict[str, list[DefinitionEntry]] = {
    "สวัสดี": [DefinitionEntry(pos="คำอุทาน", meaning="คำทักทาย ใช้เมื่อพบกันหรือจากกัน")],
    "ครับ": [DefinitionEntry(pos="คำลงท้าย", meaning="คำสุภาพที่ผู้ชายใช้ลงท้ายประโยค")],
    "ค่ะ": [DefinitionEntry(pos="คำลงท้าย", meaning="คำสุภาพที่ผู้หญิงใช้ลงท้ายประโยค")],
    "เหรอ": [DefinitionEntry(pos="คำลงท้าย", meaning="คำที่ใช้ท้ายประโยคคำถาม เพื่อแสดงความสงสัยหรือขอให้ยืนยัน")],
    "หรอ": [DefinitionEntry(pos="คำลงท้าย", meaning="รูปไม่เป็นทางการของคำว่า เหรอ ใช้แสดงคำถามหรือความสงสัย")],
    "จ๊ะ": [DefinitionEntry(pos="คำลงท้าย", meaning="คำลงท้ายประโยคที่ให้ความรู้สึกเป็นกันเอง อ่อนโยน")],
    "จ้ะ": [DefinitionEntry(pos="คำลงท้าย", meaning="คำลงท้ายประโยคที่ให้ความรู้สึกเป็นกันเอง อ่อนโยน")],
    "นะ": [DefinitionEntry(pos="คำลงท้าย", meaning="คำลงท้ายที่ใช้เน้น ชวน หรือทำให้น้ำเสียงอ่อนลง")],
    "ใคร": [DefinitionEntry(pos="คำสรรพนาม", meaning="ใช้ถามหรือกล่าวถึงบุคคลที่ไม่ทราบว่าเป็นผู้ใด")],
    "อะไร": [DefinitionEntry(pos="คำสรรพนาม", meaning="ใช้ถามหรือกล่าวถึงสิ่งที่ไม่ทราบว่าเป็นสิ่งใด")],
    "กระทั่ง": [DefinitionEntry(pos="คำเชื่อม", meaning="แม้แต่; จนถึง; ใช้เน้นว่าบางสิ่งเกิดขึ้นหรือรวมอยู่ด้วยอย่างคาดไม่ถึง")],
    "คือ": [DefinitionEntry(pos="คำกริยา", meaning="ใช้บอกความเป็นหรืออธิบายว่าเป็นสิ่งใด")],
    "มี": [DefinitionEntry(pos="คำกริยา", meaning="แสดงการมีอยู่หรือครอบครอง")],
    "คน": [DefinitionEntry(pos="คำนาม", meaning="มนุษย์; บุคคล")],
    "เรียก": [DefinitionEntry(pos="คำกริยา", meaning="เปล่งเสียงหรือใช้คำเพื่อให้สนใจ เข้ามา หรือระบุชื่อ")],
    "หา": [DefinitionEntry(pos="คำกริยา", meaning="มุ่งไปพบ ติดต่อ หรือค้นหา")],
    "ความลับ": [DefinitionEntry(pos="คำนาม", meaning="เรื่องที่ปกปิดไว้ไม่ให้ผู้อื่นรู้")],
    "ถ่าย": [DefinitionEntry(pos="คำกริยา", meaning="บันทึกภาพหรือวิดีโอ; เคลื่อนย้ายหรือถอดแบบจากสิ่งหนึ่งไปสู่อีกสิ่งหนึ่ง")],
    "บ้าน": [DefinitionEntry(pos="คำนาม", meaning="ที่อยู่อาศัย; เรือน")],
    "พรุ่งนี้": [DefinitionEntry(pos="คำวิเศษณ์", meaning="วันถัดจากวันนี้")],
    "วันนี้": [DefinitionEntry(pos="คำวิเศษณ์", meaning="วันปัจจุบัน")],
    "นาย": [DefinitionEntry(pos="คำสรรพนาม", meaning="คำใช้เรียกหรือแทนบุคคลเพศชาย หรือใช้แทนคู่สนทนาในบางบริบท")],
}


class DictionaryService:
    def __init__(self) -> None:
        self._lexitron = self._load_lexitron()

    def ensure_dictionary_sources(self) -> None:
        self._bootstrap_english_dictionary_db()
        self._bootstrap_thai_dictionary_db()

    def _bootstrap_english_dictionary_db(self) -> None:
        if TELEX_DICTIONARY_PATH.exists():
            if dictionary_entry_count("telex") == 0:
                upsert_dictionary_entries(_parse_telex_dictionary(TELEX_DICTIONARY_PATH), source="telex")
            return

        if dictionary_entry_count("lexitron") > 0:
            return

        bootstrap_entries: list[dict[str, str]] = []
        for word, definitions in self._lexitron.items():
            for definition in definitions:
                bootstrap_entries.append(
                    {
                        "word": word,
                        "lang": "en",
                        "pos": definition.pos,
                        "meaning": definition.meaning,
                    }
                )
        upsert_dictionary_entries(bootstrap_entries, source="lexitron")

    def _bootstrap_thai_dictionary_db(self) -> None:
        if dictionary_entry_count("royal-institute") > 0:
            return

        if not ROYAL_DICTIONARY_PATH.exists():
            bootstrap_entries: list[dict[str, str]] = []
            for word, definitions in FALLBACK_THAI.items():
                for definition in definitions:
                    bootstrap_entries.append(
                        {
                            "word": word,
                            "lang": "th",
                            "pos": definition.pos,
                            "meaning": definition.meaning,
                        }
                    )
            upsert_dictionary_entries(bootstrap_entries, source="fallback-thai")
            return

        upsert_dictionary_entries(_parse_royal_dictionary(ROYAL_DICTIONARY_PATH), source="royal-institute")

    def _load_lexitron(self) -> dict[str, list[DefinitionEntry]]:
        entries: dict[str, list[DefinitionEntry]] = defaultdict(list)
        if not LEXITRON_PATH.exists():
            return {word: list(definitions) for word, definitions in FALLBACK_ENGLISH.items()}

        try:
            payload = json.loads(LEXITRON_PATH.read_text(encoding="utf-8"))
        except Exception:
            payload = []

        for item in payload if isinstance(payload, list) else []:
            word = str(item.get("word", "")).strip()
            meaning = str(item.get("meaning", "")).strip()
            pos = str(item.get("pos", "unknown")).strip() or "unknown"
            if not word or not meaning:
                continue
            entries[word].append(DefinitionEntry(pos=pos, meaning=meaning))
        for word, definitions in FALLBACK_ENGLISH.items():
            entries[word].extend(definitions)
        return dict(entries)

    def transliterate(self, word: str) -> str:
        try:
            from pythainlp.transliterate import romanize

            return romanize(word, engine="royin")
        except Exception:
            return ""

    def _english_definitions(self, word: str) -> list[DefinitionEntry]:
        definitions = _rows_to_definitions(lookup_dictionary_entries(word, "en"))
        if not definitions:
            definitions = list(self._lexitron.get(word, []))
        thai_word_exists = False
        try:
            from pythainlp.corpus import thai_words

            thai_word_exists = word in thai_words()
        except Exception:
            pass
        try:
            from pythainlp.corpus import wordnet

            synsets = wordnet.synsets(word, lang="tha")
            for synset in synsets[:5]:
                definition = synset.definition()
                pos = getattr(synset, "pos", lambda: "unknown")()
                if definition:
                    definitions.append(DefinitionEntry(pos=str(pos), meaning=str(definition)))
        except Exception:
            pass

        if not definitions:
            definitions = self._compound_fallback(word, FALLBACK_ENGLISH, "English")
        if not definitions:
            definitions = self._thai_reference_fallback(word)
        if not definitions and thai_word_exists:
            definitions = [
                DefinitionEntry(
                    pos="unknown",
                    meaning="recognized Thai word in the offline corpus; exact English gloss is not bundled yet",
                )
            ]
        return _dedupe_definitions(definitions)

    def _thai_definitions(self, word: str) -> list[DefinitionEntry]:
        definitions = _rows_to_definitions(lookup_dictionary_entries(word, "th"))
        if not definitions:
            definitions = self._compound_fallback(word, FALLBACK_THAI, "Thai")
        if not definitions:
            try:
                from pythainlp.corpus import thai_words

                if word in thai_words():
                    definitions = [
                        DefinitionEntry(
                            pos="คำไทย",
                            meaning="พบในคลังคำภาษาไทยออฟไลน์ แต่ยังไม่มีคำอธิบายเชิงพจนานุกรมที่ละเอียดในชุดข้อมูลที่บันเดิลมา",
                        )
                    ]
            except Exception:
                pass
        return _dedupe_definitions(definitions)

    def _compound_fallback(
        self,
        word: str,
        fallback_dict: dict[str, list[DefinitionEntry]],
        label: str,
    ) -> list[DefinitionEntry]:
        direct = fallback_dict.get(word, [])
        if direct:
            return list(direct)

        entries: list[DefinitionEntry] = []
        pieces = [piece for piece in segment_text(word) if piece != word]
        component_glosses: list[str] = []
        for piece in pieces:
            piece_defs = fallback_dict.get(piece, [])
            if piece_defs:
                component_glosses.append(f"{piece} = {piece_defs[0].meaning}")
        if component_glosses:
            entries.append(
                DefinitionEntry(
                    pos="compound",
                    meaning=f"{label} fallback from components: " + "; ".join(component_glosses),
                )
            )

        if word.startswith("ความ") and word != "ความ":
            root = word.removeprefix("ความ")
            root_defs = fallback_dict.get(root, [])
            if root_defs:
                root_meaning = root_defs[0].meaning
                if label == "English":
                    entries.append(
                        DefinitionEntry(
                            pos="noun",
                            meaning=f"state or quality related to '{root}'; often an abstract noun built from {root_meaning}",
                        )
                    )
                else:
                    entries.append(
                        DefinitionEntry(
                            pos="คำนาม",
                            meaning=f"คำที่สร้างจาก '{root}' เพื่อบอกสภาพหรือภาวะ เช่น {root_meaning}",
                        )
                    )
        return entries

    def _thai_reference_fallback(self, word: str) -> list[DefinitionEntry]:
        thai_rows = lookup_dictionary_entries(word, "th", limit=3)
        if not thai_rows:
            thai_defs = self._compound_fallback(word, FALLBACK_THAI, "Thai")
            return [
                DefinitionEntry(
                    pos="thai reference",
                    meaning=f"Thai definition: {entry.meaning}",
                )
                for entry in thai_defs[:2]
            ]

        definitions: list[DefinitionEntry] = []
        for row in thai_rows[:3]:
            definitions.append(
                DefinitionEntry(
                    pos="thai reference",
                    meaning=f"Thai definition: {str(row['meaning'])}",
                )
            )
        return definitions

    def lookup(self, word: str, lang: str) -> LookupResponse:
        clean_word = word.strip()
        transliteration = self.transliterate(clean_word)
        definitions = self._english_definitions(clean_word) if lang == "en" else self._thai_definitions(clean_word)
        return LookupResponse(
            word=clean_word,
            lang=lang,
            transliteration=transliteration,
            definitions=definitions,
            found=bool(definitions),
        )


def _dedupe_definitions(entries: list[DefinitionEntry]) -> list[DefinitionEntry]:
    seen: set[tuple[str, str]] = set()
    deduped: list[DefinitionEntry] = []
    for entry in entries:
        key = (entry.pos, entry.meaning)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(entry)
    return deduped


def _rows_to_definitions(rows: list[object]) -> list[DefinitionEntry]:
    definitions: list[DefinitionEntry] = []
    for row in rows:
        definitions.append(
            DefinitionEntry(
                pos=str(row["pos"] or "unknown"),
                meaning=str(row["meaning"]),
            )
        )
    return definitions


def _parse_royal_dictionary(path: Path) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    prefix = 'THAI_DICTIONARY["'

    with path.open(encoding="utf-8", errors="replace") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line.startswith(prefix):
                continue

            try:
                key_end = line.index('"] = ')
                headword = line[len(prefix):key_end]
                values_blob = line[key_end + len('"] = '):].rstrip(";")
                definitions = json.loads(values_blob)
            except Exception:
                continue

            normalized_headwords = _expand_royal_headwords(headword)
            normalized_definitions = _normalize_royal_definitions(definitions)
            if not normalized_headwords or not normalized_definitions:
                continue

            for normalized_word in normalized_headwords:
                for meaning in normalized_definitions:
                    entries.append(
                        {
                            "word": normalized_word,
                            "lang": "th",
                            "pos": _infer_thai_pos(meaning),
                            "meaning": meaning,
                        }
                    )

    return entries


def _expand_royal_headwords(headword: str) -> list[str]:
    candidates = [headword]
    if "," in headword:
        candidates.extend(part.strip() for part in headword.split(","))

    expanded: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        normalized = _normalize_headword(candidate)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        expanded.append(normalized)
    return expanded


def _normalize_headword(headword: str) -> str:
    normalized = headword.strip()
    normalized = HEADWORD_NUMBER_RE.sub("", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip(" .;")


def _normalize_royal_definitions(definitions: object) -> list[str]:
    if not isinstance(definitions, list):
        return []

    normalized: list[str] = []
    seen: set[str] = set()
    for item in definitions:
        meaning = str(item).strip()
        if not meaning:
            continue
        meaning = meaning.replace("**", "")
        meaning = re.sub(r"\s+", " ", meaning).strip()
        if meaning in seen:
            continue
        seen.add(meaning)
        normalized.append(meaning)
    return normalized


def _infer_thai_pos(meaning: str) -> str:
    prefix_map = {
        "ก.": "คำกริยา",
        "น.": "คำนาม",
        "ว.": "คำวิเศษณ์",
        "ส.": "คำสันธาน",
        "สรรพ.": "คำสรรพนาม",
        "บุพ.": "คำบุพบท",
        "อ.": "คำอุทาน",
    }
    stripped = meaning.lstrip()
    for marker, part_of_speech in prefix_map.items():
        if stripped.startswith(marker):
            return part_of_speech
    return "คำไทย"


dictionary_service = DictionaryService()


def _parse_telex_dictionary(path: Path) -> list[dict[str, str]]:
    entries: list[dict[str, str]] = []
    with path.open(encoding="utf-8-sig", errors="replace", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            word = str(row.get("t-search") or row.get("t-entry") or "").strip()
            if not word:
                continue

            meanings = _normalize_telex_meanings(
                [
                    row.get("e-entry", ""),
                    row.get("e-related", ""),
                ]
            )
            if not meanings:
                continue

            pos = _map_telex_pos(str(row.get("t-cat") or "").strip())
            for meaning in meanings:
                entries.append(
                    {
                        "word": word,
                        "lang": "en",
                        "pos": pos,
                        "meaning": meaning,
                    }
                )
    return entries


def _normalize_telex_meanings(chunks: list[object]) -> list[str]:
    meanings: list[str] = []
    seen: set[str] = set()
    for chunk in chunks:
        text = str(chunk or "").strip()
        if not text:
            continue
        for part in text.split(";"):
            meaning = re.sub(r"\s+", " ", part).strip(" ,.")
            if not meaning or meaning in seen:
                continue
            seen.add(meaning)
            meanings.append(meaning)
    return meanings


def _map_telex_pos(raw_pos: str) -> str:
    pos_map = {
        "N": "noun",
        "V": "verb",
        "ADV": "adverb",
        "ADJ": "adjective",
        "PRON": "pronoun",
        "DET": "determiner",
        "CONJ": "conjunction",
        "PREP": "preposition",
    }
    return pos_map.get(raw_pos.upper(), raw_pos.lower() or "unknown")
