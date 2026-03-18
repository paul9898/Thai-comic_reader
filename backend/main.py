from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse

from database import create_vocab, delete_vocab, export_vocab_csv, init_db, list_vocab
from dictionary import dictionary_service
from models import LoadDocumentResponse, LoadLocalDocumentRequest, OcrRegionRequest, OcrRequest, OcrResponse, SegmentRequest, SegmentResponse, VocabCreate, VocabItem, VocabListResponse
from ocr_engine import ocr_engine
from pdf_handler import resolve_image_path, save_uploaded_image, save_uploaded_pdf
from segmenter import segment_text

app = FastAPI(title="Thai Comic Reader API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    dictionary_service.ensure_dictionary_sources()
    ocr_engine.warm_up_async()


@app.get("/api/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/load-pdf", response_model=LoadDocumentResponse)
async def load_pdf(file: UploadFile = File(...)) -> LoadDocumentResponse:
    return save_uploaded_pdf(file.filename or "document.pdf", await file.read())


@app.post("/api/load-image", response_model=LoadDocumentResponse)
async def load_image(file: UploadFile = File(...)) -> LoadDocumentResponse:
    return save_uploaded_image(file.filename or "image.png", await file.read())


@app.post("/api/load-local-document", response_model=LoadDocumentResponse)
def load_local_document(payload: LoadLocalDocumentRequest) -> LoadDocumentResponse:
    source_path = Path(payload.path).expanduser()
    if not source_path.exists() or not source_path.is_file():
        raise HTTPException(status_code=404, detail="The selected file could not be found.")

    document_type = payload.type or infer_document_type(source_path)
    file_bytes = source_path.read_bytes()

    if document_type == "pdf":
        return save_uploaded_pdf(source_path.name, file_bytes)
    if document_type == "image":
        return save_uploaded_image(source_path.name, file_bytes)

    raise HTTPException(status_code=400, detail="Unsupported document type.")


@app.get("/api/pages/{doc_id}/{page_name}")
def get_page(doc_id: str, page_name: str) -> FileResponse:
    file_path = resolve_image_path(f"/api/pages/{doc_id}/{page_name}")
    return FileResponse(file_path)


@app.post("/api/ocr", response_model=OcrResponse)
def run_ocr(payload: OcrRequest) -> OcrResponse:
    image_path = resolve_image_path(payload.image_path)
    return OcrResponse(boxes=ocr_engine.read(image_path))


@app.post("/api/ocr-region", response_model=OcrResponse)
def run_ocr_region(payload: OcrRegionRequest) -> OcrResponse:
    image_path = resolve_image_path(payload.image_path)
    return OcrResponse(boxes=ocr_engine.read_region(image_path, payload.region))


@app.post("/api/segment", response_model=SegmentResponse)
def segment(payload: SegmentRequest) -> SegmentResponse:
    return SegmentResponse(words=segment_text(payload.text))


@app.get("/api/lookup/{word}")
def lookup_word(word: str, lang: str = Query("en", pattern="^(en|th)$")):
    return dictionary_service.lookup(word, lang)


@app.get("/api/vocab", response_model=VocabListResponse)
def get_vocab(
    search: str = Query("", max_length=100),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> VocabListResponse:
    return list_vocab(search=search, limit=limit, offset=offset)


@app.post("/api/vocab", response_model=VocabItem)
def save_vocab(payload: VocabCreate) -> VocabItem:
    return create_vocab(payload)


@app.delete("/api/vocab/{item_id}", status_code=204)
def remove_vocab(item_id: int) -> None:
    delete_vocab(item_id)


@app.get("/api/vocab/export")
def export_vocab(format: str = Query("anki")) -> PlainTextResponse:
    if format != "anki":
        return PlainTextResponse("Unsupported export format.", status_code=400)
    csv_payload = export_vocab_csv()
    headers = {"Content-Disposition": 'attachment; filename="thai-comic-reader-anki.csv"'}
    return PlainTextResponse(csv_payload, media_type="text/csv", headers=headers)


def infer_document_type(source_path: Path) -> str:
    suffix = source_path.suffix.lower()
    if suffix == ".pdf":
        return "pdf"
    if suffix in {".png", ".jpg", ".jpeg", ".webp"}:
        return "image"
    raise HTTPException(status_code=400, detail="Unsupported file type for library reopen.")
