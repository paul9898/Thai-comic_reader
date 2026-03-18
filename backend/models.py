from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class PageInfo(BaseModel):
    page_num: int
    image_url: str
    width: int
    height: int


class LoadDocumentResponse(BaseModel):
    id: str
    total_pages: int
    pages: list[PageInfo]


class LoadLocalDocumentRequest(BaseModel):
    path: str = Field(min_length=1)
    type: Literal["pdf", "image"] | None = None


class OcrRequest(BaseModel):
    image_path: str


class OcrRegion(BaseModel):
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    width: int = Field(gt=0)
    height: int = Field(gt=0)


class OcrRegionRequest(OcrRequest):
    region: OcrRegion


class OcrBox(BaseModel):
    id: int
    text: str
    bbox: list[int]
    confidence: float


class OcrResponse(BaseModel):
    boxes: list[OcrBox]


class SegmentRequest(BaseModel):
    text: str


class SegmentResponse(BaseModel):
    words: list[str]


class DefinitionEntry(BaseModel):
    pos: str
    meaning: str


class LookupResponse(BaseModel):
    word: str
    lang: Literal["en", "th"]
    transliteration: str
    definitions: list[DefinitionEntry]
    found: bool


class VocabCreate(BaseModel):
    word: str = Field(min_length=1)
    definition: str = ""
    definition_lang: Literal["en", "th"] = "en"
    context_sentence: str = ""
    comic_source: str = ""
    page_num: int | None = None


class VocabItem(VocabCreate):
    id: int
    created_at: str


class VocabListResponse(BaseModel):
    items: list[VocabItem]
    total: int
