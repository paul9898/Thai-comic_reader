from __future__ import annotations

from pydantic import BaseModel


class VisionOcrRequest(BaseModel):
    image_path: str


class VisionOcrBox(BaseModel):
    id: int
    text: str
    bbox: list[int]
    confidence: float


class VisionOcrResponse(BaseModel):
    boxes: list[VisionOcrBox]

