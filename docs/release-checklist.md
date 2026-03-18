# Thai Comic Reader Release Checklist

## Stabilization

- Confirm library entries dedupe correctly for moved or copied books with the same title.
- Confirm library persistence survives a full app restart.
- Confirm native `Open PDF` and `Open Image` flows work from the desktop app.
- Confirm sidebar collapse and restore works cleanly.
- Confirm popup editing, Thai keyboard, and re-segmentation stay stable during normal use.
- Confirm repeat OCR on previously read pages benefits from disk cache.

## Packaging Prep

- Split backend runtime prep by platform instead of reusing the macOS environment everywhere.
- Verify the Electron main process resolves Python paths for both macOS and Windows builds.
- Add a repeatable bootstrap path for `backend_windows/.venv`.
- Decide which runtime assets stay in the app bundle and which should be fetched or generated at first run.
- Add release metadata: app name, icon set, version, and target output names.

## Release Builds

- Build and test a macOS desktop package.
- Build and test a Windows desktop package from a Windows environment or CI worker.
- Smoke-test: open book, reopen from library, run OCR, edit OCR text, save vocab, export vocab.
- Publish tagged release artifacts only after both desktop flows pass the smoke test.
