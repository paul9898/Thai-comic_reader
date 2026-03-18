# Thai Comic OCR Dictionary App — Project Spec & Build Instructions

> **Purpose**: This document is a complete specification for a coding agent (OpenAI Codex, Claude Code, etc.) to build a local Thai comic reader with tap-to-lookup dictionary functionality. The app runs entirely offline after setup — no API costs per use.

---

## 1. Project Overview

**What it does**: A desktop web app that lets a Thai-language learner:
1. Load Thai comic pages (from PDF or image files)
2. See OCR-detected Thai text overlaid on the comic page
3. Click/tap any Thai word to instantly see its English definition, transliteration, and word class
4. Save unknown words to a personal vocabulary list for review

**Key constraint**: Must run locally with zero ongoing API costs. All OCR and dictionary lookup happens offline.

---

## 2. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React + Vite | Fast dev, hot reload |
| Backend | Python (FastAPI) | Best Thai NLP ecosystem |
| OCR | EasyOCR (Thai) | Better Thai accuracy than Tesseract, GPU optional |
| Word segmentation | PyThaiNLP (`newmm` engine) | Gold standard for Thai tokenization |
| Dictionary (EN) | PyThaiNLP `wordnet` + bundled LEXiTRON CSV | Offline English lookup |
| Dictionary (TH) | Royal Institute Dictionary (RID) data via PyThaiNLP | Thai-Thai definitions for advanced learners |
| PDF rendering | pdf2image (poppler) | Converts PDF pages to images |
| Vocab storage | SQLite | Simple, no server needed |

---

## 3. Architecture

```
┌─────────────────────────────────────────────┐
│  React Frontend (localhost:5173)             │
│  ┌───────────────────────────────────────┐   │
│  │  Comic Page Viewer                    │   │
│  │  - Displays page image                │   │
│  │  - Overlays clickable OCR text boxes   │   │
│  │  - Word popup on click                │   │
│  └───────────────────────────────────────┘   │
│  ┌───────────────────────────────────────┐   │
│  │  Vocab Sidebar                        │   │
│  │  - Saved words list                   │   │
│  │  - Export to Anki CSV                 │   │
│  └───────────────────────────────────────┘   │
└──────────────┬──────────────────────────────┘
               │ HTTP (JSON)
┌──────────────▼──────────────────────────────┐
│  FastAPI Backend (localhost:8000)            │
│                                              │
│  POST /api/load-pdf     → pdf2image → pages │
│  POST /api/load-image   → store page        │
│  POST /api/ocr          → EasyOCR → boxes   │
│  POST /api/segment      → PyThaiNLP → words │
│  GET  /api/lookup/{word} → dictionary       │
│  CRUD /api/vocab         → SQLite           │
│  GET  /api/vocab/export  → Anki CSV         │
└─────────────────────────────────────────────┘
```

---

## 4. Backend — Detailed API Spec

### 4.1 `POST /api/load-pdf`

**Request**: `multipart/form-data` with PDF file  
**Response**:
```json
{
  "id": "abc123",
  "total_pages": 42,
  "pages": [
    { "page_num": 1, "image_url": "/api/pages/abc123/1.png" }
  ]
}
```
**Implementation**:
- Use `pdf2image.convert_from_bytes()` to render each page at 300 DPI
- Store page images in a temp directory (e.g., `/tmp/thai-reader/{id}/`)
- Serve images via a static file route

### 4.2 `POST /api/load-image`

**Request**: `multipart/form-data` with image file (PNG/JPG)  
**Response**: Same shape as load-pdf but with 1 page

### 4.3 `POST /api/ocr`

**Request**:
```json
{
  "image_path": "/api/pages/abc123/1.png"
}
```
**Response**:
```json
{
  "boxes": [
    {
      "id": 0,
      "text": "สวัสดีครับ",
      "bbox": [120, 45, 380, 95],
      "confidence": 0.92
    }
  ]
}
```
**Implementation**:
- Use `easyocr.Reader(['th'])` — initialize once at startup, reuse
- `reader.readtext(image_path)` returns bounding boxes + text
- bbox format: `[x_min, y_min, x_max, y_max]` (convert from EasyOCR's polygon format)
- Filter out low-confidence results (< 0.3)

### 4.4 `POST /api/segment`

**Request**:
```json
{ "text": "สวัสดีครับ" }
```
**Response**:
```json
{
  "words": ["สวัสดี", "ครับ"]
}
```
**Implementation**:
- Use `pythainlp.tokenize.word_tokenize(text, engine="newmm")`
- Filter out whitespace and punctuation tokens

### 4.5 `GET /api/lookup/{word}?lang=en|th`

**Query param**: `lang` — `en` for English definitions (default), `th` for Thai-Thai dictionary definitions. User toggles this globally in the toolbar.

**Response (lang=en)**:
```json
{
  "word": "สวัสดี",
  "lang": "en",
  "definitions": [
    { "pos": "interjection", "meaning": "hello; greetings" }
  ],
  "found": true
}
```

**Response (lang=th)**:
```json
{
  "word": "สวัสดี",
  "lang": "th",
  "definitions": [
    { "pos": "คำอุทาน", "meaning": "คำทักทาย ใช้พูดเมื่อพบกันหรือจากกัน" }
  ],
  "found": true
}
```

**Implementation**:
- **English mode (`lang=en`)**:
  1. **PyThaiNLP wordnet**: `pythainlp.corpus.wordnet.synsets(word)` — get English definitions
  2. **LEXiTRON data**: Download the NECTEC LEXiTRON Thai-English dictionary (freely available), load as a dict from CSV/JSON at startup
- **Thai mode (`lang=th`)**:
  1. **Royal Institute Dictionary (พจนานุกรม ราชบัณฑิตยสถาน)**: Use PyThaiNLP's `pythainlp.corpus.thai_dict()` or bundle the RID data as JSON
  2. **Fallback**: Thai Wordnet definitions via `pythainlp.corpus.wordnet` with Thai language gloss

### 4.6 `CRUD /api/vocab`

- `GET /api/vocab` — list all saved words (with pagination, optional search)
- `POST /api/vocab` — save a word: `{ "word", "definition", "definition_lang", "context_sentence", "comic_source", "page_num" }`
- `DELETE /api/vocab/{id}` — remove a word
- `GET /api/vocab/export?format=anki` — export as Anki-compatible CSV (front: word, back: definition)

**SQLite schema**:
```sql
CREATE TABLE vocab (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT NOT NULL,
    definition TEXT,
    definition_lang TEXT DEFAULT 'en',
    context_sentence TEXT,
    comic_source TEXT,
    page_num INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(word)
);
```

---

## 5. Frontend — Detailed Component Spec

### 5.1 `<App />`

- Top-level layout: toolbar at top, comic viewer in center, vocab sidebar on right (collapsible)
- State: current PDF/image id, current page number, OCR results, selected word

### 5.2 `<Toolbar />`

- "Open PDF" button → file picker, uploads to `/api/load-pdf`
- "Open Image" button → file picker, uploads to `/api/load-image`
- Page navigation: `< Page 3 of 42 >`
- **Dictionary language toggle**: `EN | TH` switch — controls whether lookups return English definitions or Thai-Thai dictionary definitions. Persisted in localStorage.
- "Run OCR" button → calls `/api/ocr` for current page (not auto — user controls when to OCR since it takes a few seconds)

### 5.3 `<ComicViewer />`

This is the core component.

**Layout**:
- Container div with `position: relative`
- `<img>` of the comic page filling the container
- For each OCR box: an absolutely-positioned transparent overlay `<div>` matching the bbox coordinates
- Scale bbox coordinates to match the displayed image size (OCR runs on full-res, display may be scaled)

**Interaction flow**:
1. User clicks an OCR overlay box
2. The raw text from that box is sent to `/api/segment`
3. Segmented words are shown in a **word picker popup** near the click point
4. Each word in the popup is a clickable chip/button
5. Clicking a word calls `/api/lookup/{word}`
6. Definition popup appears with: word, definition(s) in chosen language, "Save to vocab" button

**Styling for OCR overlays**:
- Default: `border: 1px dashed rgba(0, 150, 255, 0.3)` — subtle, doesn't ruin the comic
- Hover: `background: rgba(0, 150, 255, 0.15)` — highlights the speech bubble
- Active/clicked: `background: rgba(255, 200, 0, 0.2)`
- Overlays should have `cursor: pointer`

### 5.4 `<WordPopup />`

Appears on word click. Contains:
- Thai word in large font (24px+)
- Part of speech tag
- Definition(s) — displayed in whichever language (EN/TH) is currently selected
- Context: the full OCR text box this word came from
- "Save to Vocab" button (disabled if already saved, show ✓)
- "Copy" button to copy the Thai word

Position: anchored near the clicked overlay, smart-positioned to stay on screen.

### 5.5 `<VocabSidebar />`

- Scrollable list of saved words
- Each item: Thai word, short definition (in the language it was saved with)
- Click to expand full definition
- Delete button (with confirm)
- Search/filter input at top
- "Export to Anki" button at bottom → triggers CSV download

---

## 6. Setup & Installation

### 6.1 Prerequisites

```bash
# System dependencies
# macOS:
brew install poppler

# Ubuntu/Debian:
sudo apt-get install poppler-utils

# Windows:
# Download poppler from: https://github.com/oschwartz10612/poppler-windows/releases
# Add to PATH
```

### 6.2 Backend Setup

```bash
mkdir thai-comic-reader && cd thai-comic-reader
mkdir backend frontend

cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

pip install fastapi uvicorn python-multipart
pip install easyocr
pip install pythainlp
pip install pdf2image
pip install Pillow

# Download Thai OCR model (happens automatically on first use, ~100MB)
# Download PyThaiNLP data
python -c "import pythainlp; pythainlp.corpus.download('wordnet')"
```

### 6.3 Frontend Setup

```bash
cd ../frontend
npm create vite@latest . -- --template react
npm install
npm install axios
```

### 6.4 Running

```bash
# Terminal 1 — backend
cd backend
uvicorn main:app --reload --port 8000

# Terminal 2 — frontend
cd frontend
npm run dev
```

---

## 7. File Structure

```
thai-comic-reader/
├── backend/
│   ├── main.py              # FastAPI app, all routes
│   ├── ocr_engine.py        # EasyOCR wrapper (singleton)
│   ├── dictionary.py        # Dictionary lookup logic
│   ├── segmenter.py         # PyThaiNLP word segmentation
│   ├── pdf_handler.py       # PDF → images conversion
│   ├── database.py          # SQLite vocab CRUD
│   ├── models.py            # Pydantic request/response models
│   └── data/
│       └── lexitron.json    # LEXiTRON dictionary data (optional extra)
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Toolbar.jsx
│   │   │   ├── ComicViewer.jsx
│   │   │   ├── OcrOverlay.jsx
│   │   │   ├── WordPopup.jsx
│   │   │   └── VocabSidebar.jsx
│   │   ├── hooks/
│   │   │   └── useApi.js    # Axios wrapper for backend calls
│   │   └── styles/
│   │       └── app.css
│   ├── index.html
│   └── vite.config.js       # proxy /api → localhost:8000
├── vocab.db                  # SQLite database (created at runtime)
└── README.md
```

---

## 8. Build Order (for the coding agent)

Follow this order to build incrementally and test each piece:

### Phase 1: Backend Core
1. `main.py` — FastAPI app skeleton with CORS middleware
2. `pdf_handler.py` — PDF upload → page images
3. `ocr_engine.py` — EasyOCR singleton, `/api/ocr` route
4. `segmenter.py` — PyThaiNLP word tokenization
5. `dictionary.py` — Word lookup with romanization
6. **Test**: Upload a Thai comic PDF, get OCR boxes, segment text, look up a word — all via curl/httpie

### Phase 2: Frontend Shell
7. Vite + React scaffold
8. `vite.config.js` — proxy `/api` to backend
9. `Toolbar.jsx` — file upload, page nav
10. `ComicViewer.jsx` — display page image, render OCR overlay divs
11. **Test**: Can load a PDF and see the comic page with blue dashed boxes over detected text

### Phase 3: Interactive Lookup
12. Click handler on OCR overlays → call `/api/segment`
13. `WordPopup.jsx` — word chips from segmentation, then definition on click
14. **Test**: Click a speech bubble → see segmented words → click a word → see definition

### Phase 4: Vocabulary
15. `database.py` — SQLite init + CRUD
16. `VocabSidebar.jsx` — list, save, delete, search
17. Anki export endpoint + download button
18. **Test**: Save words, see them in sidebar, export CSV, import into Anki

### Phase 5: Polish
19. Loading spinners (OCR takes 2-5 seconds per page)
20. Error handling (no OCR results found, word not in dictionary)
21. Keyboard shortcuts: arrow keys for page nav, Esc to close popups
22. Responsive layout (works on tablet for reading comics)
23. Dark mode toggle (better for comic reading)

---

## 9. Known Gotchas & Tips

| Issue | Solution |
|-------|---------|
| EasyOCR first run downloads ~100MB model | Warn user, show progress. Model is cached after first download. |
| Thai OCR accuracy on stylized comic fonts | EasyOCR handles this better than Tesseract. If accuracy is poor, try preprocessing: convert to grayscale, increase contrast, resize to 2x. |
| PyThaiNLP word segmentation isn't perfect | It's ~95% accurate. Some compound words may be over-segmented. Allow user to manually select text ranges as a fallback. |
| LEXiTRON dictionary is large | Load it into a Python dict at startup, keep in memory. ~50MB RAM. |
| `pdf2image` needs poppler installed | This is the #1 setup failure. Make the error message very clear if poppler is missing. |
| EasyOCR bbox format | EasyOCR returns `[[x1,y1],[x2,y2],[x3,y3],[x4,y4]]` (polygon). Convert to `[x_min, y_min, x_max, y_max]` for simpler overlay positioning. |
| Image scaling on frontend | OCR coordinates are in original image pixels. When the image is displayed at a different size, scale all bbox coordinates by `(display_width / original_width)`. |
| CORS | FastAPI needs `CORSMiddleware` allowing `localhost:5173`. |
| Thai text rendering | Make sure the frontend loads a Thai-capable font. Use `Sarabun` (Google Fonts) or system fallback. |

---

## 10. Future Enhancements (Out of Scope for V1)

- Drag-select text on the image for manual OCR region
- SRS (spaced repetition) built into the app instead of Anki export
- Sentence-level translation via a local LLM (e.g., llamafile with a Thai model)
- Batch OCR all pages in background
- Comic panel detection (auto-order speech bubbles)
- Mobile PWA version
