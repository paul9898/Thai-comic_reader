# Thai Comic Reader for macOS

Apple-first companion app focused on native text selection and Thai learning workflows.

## Why this exists

The browser app in this workspace is still the cross-platform version.
This app is the macOS-native fork intended to feel much closer to Preview:

- native PDF/image viewing
- native OCR/text extraction via Apple frameworks
- text selection on the page itself
- Thai segmentation, lookup, vocab save, and export layered on top

## High-level design

- `NativeApp/`
  - SwiftUI macOS app shell
  - PDF/image viewing
  - native text selection UX
  - sends selected Thai text into the backend bridge

- `backend_bridge/`
  - small service boundary for Thai parsing and lookup
  - can initially reuse existing Python logic from `../backend/`
  - later can be replaced or embedded if needed

- `docs/`
  - architecture notes
  - implementation milestones

## Initial direction

1. Build a native macOS viewer with PDFKit
2. Use Apple OCR/text APIs for selectable text
3. Send selected Thai text into the Thai lookup pipeline
4. Show popup/card with:
   - segmentation
   - definition
   - transliteration
   - save to vocab

## Non-goal

This project is not trying to preserve browser parity. It is explicitly the Apple-native UX fork.

