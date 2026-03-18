from __future__ import annotations

import io
import json
import shutil
import threading
import uuid
from pathlib import Path

from fastapi import HTTPException
from PIL import Image

from models import LoadDocumentResponse, PageInfo

BASE_DIR = Path(__file__).resolve().parent
STORAGE_DIR = BASE_DIR / "storage"
PAGES_DIR = STORAGE_DIR / "pages"
PDF_SOURCE_NAME = "source.pdf"
METADATA_NAME = "document.json"
PDF_RENDER_DPI = 220
PDF_PAGE_EXTENSION = "jpg"
PDF_PRELOAD_PAGE_COUNT = 3


def ensure_storage() -> None:
    PAGES_DIR.mkdir(parents=True, exist_ok=True)


def _doc_dir(doc_id: str) -> Path:
    return PAGES_DIR / doc_id


def _metadata_path(doc_id: str) -> Path:
    return _doc_dir(doc_id) / METADATA_NAME


def _pdf_path(doc_id: str) -> Path:
    return _doc_dir(doc_id) / PDF_SOURCE_NAME


def resolve_image_path(image_url: str) -> Path:
    prefix = "/api/pages/"
    if not image_url.startswith(prefix):
        raise HTTPException(status_code=400, detail="Unsupported image path.")

    relative = image_url.removeprefix(prefix)
    parts = Path(relative).parts
    if len(parts) != 2:
        raise HTTPException(status_code=400, detail="Unsupported image path.")

    doc_id, page_name = parts
    file_path = PAGES_DIR / relative
    if not file_path.exists() and page_name.endswith((".png", ".jpg", ".jpeg")):
        try:
            page_num = int(Path(page_name).stem)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid page name.") from exc
        ensure_pdf_page_rendered(doc_id, page_num)

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found.")
    return file_path


def _write_page(image: Image.Image, output_path: Path) -> tuple[int, int]:
    rgb_image = image.convert("RGB")
    suffix = output_path.suffix.lower()
    if suffix in {".jpg", ".jpeg"}:
        rgb_image.save(output_path, format="JPEG", quality=82, optimize=True)
    else:
        rgb_image.save(output_path, format="PNG", optimize=True)
    return rgb_image.size


def _page_output_path(doc_id: str, page_num: int) -> Path:
    return _doc_dir(doc_id) / f"{page_num}.{PDF_PAGE_EXTENSION}"


def save_uploaded_image(filename: str, payload: bytes) -> LoadDocumentResponse:
    ensure_storage()
    doc_id = uuid.uuid4().hex[:12]
    doc_dir = _doc_dir(doc_id)
    doc_dir.mkdir(parents=True, exist_ok=True)

    try:
        image = Image.open(io.BytesIO(payload))
        width, height = _write_page(image, doc_dir / "1.png")
    except Exception as exc:  # pragma: no cover - depends on image backend
        shutil.rmtree(doc_dir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=f"Could not read image: {exc}") from exc

    return LoadDocumentResponse(
        id=doc_id,
        total_pages=1,
        pages=[
            PageInfo(
                page_num=1,
                image_url=f"/api/pages/{doc_id}/1.png",
                width=width,
                height=height,
            )
        ],
    )


def save_uploaded_pdf(filename: str, payload: bytes) -> LoadDocumentResponse:
    ensure_storage()
    doc_id = uuid.uuid4().hex[:12]
    doc_dir = _doc_dir(doc_id)
    doc_dir.mkdir(parents=True, exist_ok=True)

    try:
        metadata = _inspect_pdf(payload)
        _pdf_path(doc_id).write_bytes(payload)
        _metadata_path(doc_id).write_text(json.dumps(metadata), encoding="utf-8")
        # Render the first page immediately so upload fails fast if PDF rendering is broken.
        ensure_pdf_page_rendered(doc_id, 1)
        _preload_pdf_pages_async(doc_id, total_pages=len(metadata["pages"]))
    except HTTPException:
        shutil.rmtree(doc_dir, ignore_errors=True)
        raise
    except Exception as exc:
        shutil.rmtree(doc_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Failed to prepare PDF pages: {exc}") from exc

    pages = [
        PageInfo(
            page_num=page["page_num"],
            image_url=f"/api/pages/{doc_id}/{page['page_num']}.{PDF_PAGE_EXTENSION}",
            width=page["width"],
            height=page["height"],
        )
        for page in metadata["pages"]
    ]
    return LoadDocumentResponse(id=doc_id, total_pages=len(pages), pages=pages)


def _preload_pdf_pages_async(doc_id: str, total_pages: int) -> None:
    max_page = min(total_pages, PDF_PRELOAD_PAGE_COUNT)
    if max_page <= 1:
        return

    def runner() -> None:
        for page_num in range(2, max_page + 1):
            try:
                ensure_pdf_page_rendered(doc_id, page_num)
            except Exception:
                # Preload should not block or fail user-facing document load.
                return

    threading.Thread(target=runner, name=f"pdf-preload-{doc_id}", daemon=True).start()


def ensure_pdf_page_rendered(doc_id: str, page_num: int) -> Path:
    metadata = _load_metadata(doc_id)
    page_lookup = {page["page_num"]: page for page in metadata["pages"]}
    if page_num not in page_lookup:
        raise HTTPException(status_code=404, detail="Page not found.")

    output_path = _page_output_path(doc_id, page_num)
    if output_path.exists():
        return output_path

    payload = _pdf_path(doc_id).read_bytes()
    image = _render_pdf_page(payload, page_num)
    _write_page(image, output_path)
    return output_path


def _load_metadata(doc_id: str) -> dict:
    metadata_path = _metadata_path(doc_id)
    if not metadata_path.exists():
        raise HTTPException(status_code=404, detail="Document metadata not found.")
    return json.loads(metadata_path.read_text(encoding="utf-8"))


def _inspect_pdf(payload: bytes) -> dict:
    try:
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(io.BytesIO(payload))
        scale = PDF_RENDER_DPI / 72
        pages = []
        for page_index in range(len(pdf)):
            width, height = pdf[page_index].get_size()
            pages.append(
                {
                    "page_num": page_index + 1,
                    "width": round(width * scale),
                    "height": round(height * scale),
                }
            )
        if not pages:
            raise HTTPException(status_code=400, detail="No pages were found in the PDF.")
        return {"pages": pages}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to inspect PDF: {exc}") from exc


def _render_pdf_page(payload: bytes, page_num: int) -> Image.Image:
    try:
        from pdf2image import convert_from_bytes

        images = convert_from_bytes(
            payload,
            dpi=PDF_RENDER_DPI,
            fmt="jpeg",
            first_page=page_num,
            last_page=page_num,
        )
        if not images:
            raise HTTPException(status_code=404, detail="Requested PDF page was not rendered.")
        return images[0]
    except Exception as pdf2image_exc:  # pragma: no cover - poppler/runtime specific
        try:
            import pypdfium2 as pdfium
        except ImportError as exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Failed to render PDF. Install Poppler or pypdfium2. "
                    f"Original error: {pdf2image_exc}"
                ),
            ) from exc

        try:
            pdf = pdfium.PdfDocument(io.BytesIO(payload))
            page = pdf[page_num - 1]
            bitmap = page.render(scale=PDF_RENDER_DPI / 72)
            pil_image = bitmap.to_pil()
            return pil_image.convert("RGB")
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Failed to render the requested PDF page with both pdf2image and pypdfium2. "
                    f"Original errors: pdf2image={pdf2image_exc}; pypdfium2={exc}"
                ),
            ) from exc
