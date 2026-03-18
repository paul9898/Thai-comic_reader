# Electron Reader Notes

## OCR Editing

- Click an OCR box to open the popup.
- `Lookup Words` shows the current lookup chips for that OCR box.
- Open `Edit / Re-Segment OCR` to:
  - correct OCR text manually
  - use the built-in Thai keyboard
  - combine split words into a single lookup token
- `Re-Segment / Update` refreshes the popup lookup chips from the edited text.
- `Combine Selected` now keeps the combined phrase as the lookup chip instead of immediately splitting it again.
- `Search AI` copies a prompt for the selected word or phrase and opens your configured AI site.

## AI Provider

- The Electron reader now uses one saved AI provider setting across the app.
- Supported providers are `ChatGPT`, `Claude`, `Gemini`, and `DeepSeek`.
- The chosen provider is used for popup `Search AI` and region `Ask AI` actions.

## OCR Speed

- The first OCR on a newly opened book can be noticeably slower.
- Region OCR is usually much faster than full-page OCR.
- Repeating OCR on the same page or region is typically faster because results are cached.

## Library

- Books opened from the Electron app are saved in the local library.
- The library remembers the last page and lets you resume, restart, or remove an entry.
