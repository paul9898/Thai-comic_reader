# Thai Comic Reader Basic

Cross-platform React + FastAPI app for reading Thai comic pages with offline OCR, region OCR, word lookup, and vocabulary saving.

## Stack

- Frontend: React + Vite
- Backend: FastAPI
- OCR: EasyOCR (Thai)
- Segmentation: PyThaiNLP
- Storage: SQLite

## Setup

## Quick Start For Sharing

If you are sending this project to someone else on macOS, the easiest path is:

1. Keep `dictionary.js` and `telex-utf8.csv` in the project root
2. Zip the whole folder
3. Tell them to unzip it and double-click [start-basic.command](/Users/pauljames/Documents/Codex/Thai%20comic%20reader/start-basic.command)

That launcher:

- creates the backend virtual environment if needed
- installs backend and frontend dependencies
- starts the backend on `8000`
- starts the frontend on `5173`

They can also run [run-basic.sh](/Users/pauljames/Documents/Codex/Thai%20comic%20reader/run-basic.sh) from Terminal.

### 1. System dependency

Install Poppler so PDF pages can be rendered:

```bash
brew install poppler
```

### 2. Backend

```bash
cd /Users/pauljames/Documents/Codex/Thai\ comic\ reader/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Optional corpus download:

```bash
python -c "import pythainlp; pythainlp.corpus.download('wordnet')"
```

### 3. Frontend

```bash
cd /Users/pauljames/Documents/Codex/Thai\ comic\ reader/frontend
npm install
npm run dev
```

Then open `http://localhost:5173`.

To stop both servers when using the launcher, press `Ctrl+C` in the launcher window.

## Keyboard shortcuts

- `R`: toggle OCR region mode on the current page
- `O`: run full-page OCR on the current page
- `Left Arrow` / `Right Arrow`: move between pages
- `Escape`: close the popup and exit region mode

## Popup Editing

- Click an OCR box to open the popup.
- `Lookup Words` shows the current lookup chips for that OCR result.
- Open `Edit / Re-Segment OCR` to correct OCR text, use the Thai keyboard, or combine split words.
- `Re-Segment / Update` refreshes the lookup chips from your corrected text.
- `Combine Selected` keeps your manual combined phrase as a lookup chip instead of splitting it apart again.
- `Search AI` copies a ready-to-paste prompt and opens your selected AI provider.

## AI Provider Setting

- The app has one shared AI provider setting for all AI actions.
- You can choose `ChatGPT`, `Claude`, `Gemini`, or `DeepSeek` in the in-app Help panel.
- That setting applies to popup `Search AI` and region `Ask AI` actions.

## Notes

- The app boots even if EasyOCR or PyThaiNLP are missing, but OCR/dictionary features will show clear errors until dependencies are installed.
- `backend/data/lexitron.json` is a tiny starter dataset. Replace it with a fuller offline LEXiTRON export for better lookups.
- If a Royal Institute-style `dictionary.js` file is present at the project root, the backend imports it into SQLite on startup and uses it for Thai (`TH`) definitions.
- If a `telex-utf8.csv` file is present at the project root, the backend imports it into SQLite on startup and uses it for English (`EN`) lookup.
- EasyOCR downloads its Thai detection model on first OCR use. If that fails on macOS with an SSL certificate error, run `/Applications/Python 3.11/Install Certificates.command`, restart the backend, and try OCR again.
- Apple-specific experiments live separately in `backend_macos/` and `macos_reader_app/` so this baseline can stay stable and shareable.
