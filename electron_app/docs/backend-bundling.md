# Backend Bundling

## Current state

The Electron wrapper can already:

- launch a built frontend bundle
- launch the backend from `backend/.venv`
- fall back to system `python3` if needed

## Planned packaged-backend path

The Electron main process now also looks for a future bundled runtime at:

- `backend-runtime/.venv/bin/python`

inside the Electron resources folder.

That gives us a clean future path:

1. Build or copy a backend runtime bundle
2. Place it under `backend-runtime/`
3. Let Electron prefer that runtime over the dev virtual environment

## Why this matters

For non-technical users, the hardest remaining problem is not Electron itself. It is making sure the packaged desktop app still has:

- Python
- FastAPI / Uvicorn
- OCR dependencies
- Thai NLP dependencies
- dictionary files

without asking the user to install them manually.

## Likely next implementation

- Stage a Mac-only backend runtime bundle with:
  - [scripts/prepare-backend-runtime.sh](/Users/pauljames/Documents/Codex/Thai%20comic%20reader/electron_app/scripts/prepare-backend-runtime.sh)
- Add that runtime bundle to Electron `extraResources`
- Update the package flow to include the staged runtime automatically
