# NativeApp

This folder will hold the Apple-first macOS application.

Recommended initial stack:

- SwiftUI app shell
- PDFKit viewer for PDFs
- NSImage support for image-based comics
- Apple OCR/text APIs for extracted text
- native inspector panel for lookup results

## First implementation target

Build a minimal app that can:

1. open a PDF
2. display the page natively
3. capture selected Thai text
4. send that text to the backend bridge
5. show lookup results in a side panel

