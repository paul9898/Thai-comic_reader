# Architecture

## Product split

There are now two distinct apps in this workspace:

### 1. Cross-platform web app

- current location: `../frontend/` + `../backend/`
- purpose: shareable baseline, non-Apple compatible
- OCR model: EasyOCR / Vision experiments only as optional support

### 2. macOS-native app

- current location: `./`
- purpose: Preview-like reading and selection workflow
- OCR/text extraction: Apple frameworks

## Native app architecture

```text
┌──────────────────────────────────────────────┐
│ SwiftUI / AppKit macOS App                   │
│                                              │
│  PDFKit / image viewer                       │
│  Native text selection layer                 │
│  Selection → lookup panel                    │
└───────────────────────┬──────────────────────┘
                        │
                        │ selected Thai text
                        ▼
┌──────────────────────────────────────────────┐
│ Thai backend bridge                          │
│                                              │
│  segment text                                │
│  lookup definitions                          │
│  transliteration                             │
│  vocab storage / export                      │
└──────────────────────────────────────────────┘
```

## Why this is better than browser overlay OCR

- Apple already solves text recognition/selection better than our web overlay
- we avoid rebuilding Preview’s selection UX badly in HTML
- our differentiated value becomes Thai learning features, not raw OCR UX

## Early implementation plan

### Phase 1

- SwiftUI app shell
- open PDF/image
- render with PDFKit / NSImage
- local panel for selected text

### Phase 2

- Apple OCR / text recognition extraction
- map selected text into lookup card

### Phase 3

- connect to backend bridge for Thai NLP
- vocab save/export

