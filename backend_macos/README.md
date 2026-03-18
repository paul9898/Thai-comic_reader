# macOS Vision Backend

This folder is the Apple-specific OCR/text-layer variant.

It exists so we can keep the current EasyOCR-based app intact in `backend/`
while building a better macOS-only OCR pipeline here.

## Current stack

- FastAPI
- Apple Vision via PyObjC
- Output designed to evolve toward a text-layer selection model

## Why this exists

The current `backend/` is the portable baseline:

- works beyond Apple devices
- uses EasyOCR
- good for sharing later with non-macOS users

The `backend_macos/` variant is for:

- better OCR quality on manga/comics
- line/word selection closer to Preview
- eventual selectable text layer in the frontend

## Run

```bash
cd /Users/pauljames/Documents/Codex/Thai\ comic\ reader/backend_macos
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

## Current endpoint

- `POST /api/vision-ocr`
  - request: `{ "image_path": "/absolute/path/to/image.png" }`
  - response: OCR boxes from Apple Vision in pixel coordinates

## Next step

1. group Vision observations into lines/paragraphs
2. build a selectable text layer in the frontend
3. let the app switch between baseline and macOS OCR backends
