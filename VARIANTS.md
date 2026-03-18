# Project Variants

This workspace now supports two product directions:

## 1. Thai Comic Reader Basic

- Uses the existing `backend/` and `frontend/`
- OCR: EasyOCR
- Goal: stable, shareable baseline that runs on non-Apple machines

## 2. macOS Vision variant

- Uses `backend_macos/` as the future Apple-specific OCR backend
- Goal: replace rough OCR box overlays with a better text-layer extraction path using Apple frameworks
- Intended outcome: selection UX closer to Preview / Live Text on macOS

## 3. macOS-native reader app

- Uses `macos_reader_app/`
- Goal: stop imitating Preview in the browser and instead build an Apple-first native app
- Intended outcome: native document viewing + native text selection + Thai learning tools

## 4. Electron desktop wrapper

- Uses `electron_app/`
- Goal: make the current working app easier to share with non-technical users
- Intended outcome: desktop shell around the existing React + FastAPI app

## Current status

- `backend/` + `frontend/` are the active "Thai Comic Reader Basic" app today
- `backend_macos/` is kept separate so Apple-specific OCR experiments do not destabilize the baseline app
- `macos_reader_app/` is the separate Apple-native product direction
- `electron_app/` is the separate desktop-wrapper direction and does not replace the current live app

## Suggested development model

- Keep shared frontend behavior where possible
- Let the OCR/text extraction backend differ by variant
- Only move frontend to a selectable text layer after the macOS OCR output shape is stable
