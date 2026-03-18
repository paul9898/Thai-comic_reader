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

## Current prep flow

- `npm run package:prep:mac`
  - builds the frontend
  - stages a macOS backend runtime from `backend_macos/.venv` if present
  - falls back to `backend/.venv` for local macOS development
- `npm run package:prep:win`
  - builds the frontend
  - expects a Windows runtime at `backend_windows/.venv`
  - fails fast if that runtime does not exist yet

## Why the split matters

The packaged app cannot reuse a macOS Python environment on Windows.

That means:

- macOS release packaging can be prepared on this machine
- Windows release packaging needs either:
  - a real Windows machine, or
  - CI that creates `backend_windows/.venv` before `electron-builder --win`
