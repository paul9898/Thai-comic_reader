# Backend Bridge

This folder is for the Thai language-processing bridge used by the native macOS app.

## Initial approach

Reuse the existing logic from:

- `../backend/segmenter.py`
- `../backend/dictionary.py`
- `../backend/database.py`

The first version does not need to reimplement Thai NLP natively.
The native app can call a local bridge process and receive:

- segmented words
- definitions
- transliteration
- save/delete vocab actions

## Why keep this separate

- native UI can evolve independently
- Thai NLP can stay shared with the web app at first
- easier to test and iterate

