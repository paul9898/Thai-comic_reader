from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import VisionOcrRequest, VisionOcrResponse
from vision_ocr import recognize_text

app = FastAPI(title="Thai Comic Reader macOS Vision Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
PAGES_DIR = BASE_DIR / "backend" / "storage" / "pages"


def resolve_shared_image_path(image_path: str) -> Path:
    if image_path.startswith("/api/pages/"):
        relative = image_path.removeprefix("/api/pages/")
        resolved = PAGES_DIR / relative
        if not resolved.exists():
            raise HTTPException(status_code=404, detail=f"Shared page image not found: {relative}")
        return resolved
    return Path(image_path)


@app.get("/api/health")
def healthcheck() -> dict[str, str]:
    return {
        "status": "ok",
        "variant": "macos-vision",
    }


@app.post("/api/vision-ocr", response_model=VisionOcrResponse)
def vision_ocr(payload: VisionOcrRequest) -> VisionOcrResponse:
    return VisionOcrResponse(boxes=recognize_text(resolve_shared_image_path(payload.image_path)))
