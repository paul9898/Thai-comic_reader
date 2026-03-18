from __future__ import annotations

import csv
import io
import sqlite3
from pathlib import Path

from fastapi import HTTPException

from models import VocabCreate, VocabItem, VocabListResponse

BASE_DIR = Path(__file__).resolve().parent.parent
DATABASE_PATH = BASE_DIR / "vocab.db"


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS vocab (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL,
                definition TEXT,
                definition_lang TEXT DEFAULT 'en',
                context_sentence TEXT,
                comic_source TEXT,
                page_num INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(word)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS dictionary_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                word TEXT NOT NULL,
                lang TEXT NOT NULL CHECK(lang IN ('en', 'th')),
                pos TEXT DEFAULT '',
                meaning TEXT NOT NULL,
                source TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_dictionary_entries_lookup
            ON dictionary_entries(word, lang)
            """
        )
        connection.commit()


def _row_to_item(row: sqlite3.Row) -> VocabItem:
    return VocabItem(
        id=row["id"],
        word=row["word"],
        definition=row["definition"] or "",
        definition_lang=row["definition_lang"] or "en",
        context_sentence=row["context_sentence"] or "",
        comic_source=row["comic_source"] or "",
        page_num=row["page_num"],
        created_at=row["created_at"],
    )


def list_vocab(search: str = "", limit: int = 200, offset: int = 0) -> VocabListResponse:
    search_pattern = f"%{search.strip()}%"
    with get_connection() as connection:
        items = connection.execute(
            """
            SELECT *
            FROM vocab
            WHERE word LIKE ? OR definition LIKE ?
            ORDER BY created_at DESC, id DESC
            LIMIT ? OFFSET ?
            """,
            (search_pattern, search_pattern, limit, offset),
        ).fetchall()
        total = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM vocab
            WHERE word LIKE ? OR definition LIKE ?
            """,
            (search_pattern, search_pattern),
        ).fetchone()["count"]

    return VocabListResponse(items=[_row_to_item(row) for row in items], total=total)


def create_vocab(payload: VocabCreate) -> VocabItem:
    try:
        with get_connection() as connection:
            cursor = connection.execute(
                """
                INSERT INTO vocab (word, definition, definition_lang, context_sentence, comic_source, page_num)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    payload.word,
                    payload.definition,
                    payload.definition_lang,
                    payload.context_sentence,
                    payload.comic_source,
                    payload.page_num,
                ),
            )
            connection.commit()
            row = connection.execute("SELECT * FROM vocab WHERE id = ?", (cursor.lastrowid,)).fetchone()
    except sqlite3.IntegrityError as exc:
        raise HTTPException(status_code=409, detail="Word already exists in vocab.") from exc

    return _row_to_item(row)


def delete_vocab(item_id: int) -> None:
    with get_connection() as connection:
        cursor = connection.execute("DELETE FROM vocab WHERE id = ?", (item_id,))
        connection.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Vocab item not found.")


def export_vocab_csv() -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["word", "definition"])
    with get_connection() as connection:
        for row in connection.execute("SELECT word, definition FROM vocab ORDER BY created_at DESC, id DESC"):
            writer.writerow([row["word"], row["definition"] or ""])
    return output.getvalue()


def dictionary_entry_count(source: str | None = None) -> int:
    with get_connection() as connection:
        if source:
            row = connection.execute(
                "SELECT COUNT(*) AS count FROM dictionary_entries WHERE source = ?",
                (source,),
            ).fetchone()
        else:
            row = connection.execute("SELECT COUNT(*) AS count FROM dictionary_entries").fetchone()
    return int(row["count"])


def upsert_dictionary_entries(entries: list[dict[str, str]], source: str) -> int:
    if not entries:
        return 0

    normalized_rows: list[tuple[str, str, str, str, str]] = []
    seen: set[tuple[str, str, str, str]] = set()
    for entry in entries:
        word = entry.get("word", "").strip()
        lang = entry.get("lang", "").strip()
        meaning = entry.get("meaning", "").strip()
        pos = entry.get("pos", "").strip()
        if not word or lang not in {"en", "th"} or not meaning:
            continue
        key = (word, lang, pos, meaning)
        if key in seen:
            continue
        seen.add(key)
        normalized_rows.append((word, lang, pos, meaning, source))

    with get_connection() as connection:
        connection.execute("DELETE FROM dictionary_entries WHERE source = ?", (source,))
        connection.executemany(
            """
            INSERT INTO dictionary_entries (word, lang, pos, meaning, source)
            VALUES (?, ?, ?, ?, ?)
            """,
            normalized_rows,
        )
        connection.commit()
    return len(normalized_rows)


def lookup_dictionary_entries(word: str, lang: str, limit: int = 12) -> list[sqlite3.Row]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT word, lang, pos, meaning, source
            FROM dictionary_entries
            WHERE word = ? AND lang = ?
            ORDER BY
                CASE source
                    WHEN 'royal-institute' THEN 0
                    WHEN 'telex' THEN 1
                    WHEN 'thai_dict' THEN 2
                    WHEN 'fallback-thai' THEN 3
                    WHEN 'lexitron' THEN 4
                    ELSE 9
                END,
                LENGTH(meaning),
                id
            LIMIT ?
            """,
            (word.strip(), lang, limit),
        ).fetchall()
    return list(rows)
