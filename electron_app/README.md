# Thai Comic Reader Electron

This is a separate Electron wrapper for the existing working app.

## Important

- It does not replace the current `backend/` + `frontend/` workflow.
- It is intentionally isolated so the live app can keep running unchanged.
- The first scaffold assumes the regular app is already installed.

## Current behavior

- Uses `frontend/dist` if it exists
- Starts the frontend on `http://127.0.0.1:5173` only as a fallback when no built frontend is available
- Starts the backend from `backend/.venv` if it is not already running
- Opens the app in an Electron window
- Packaging is now set up to carry the built frontend, backend source, and dictionary files as app resources

## Current limitation

This is now a self-starting desktop dev shell, but it is not a packaged desktop release yet.

To use it later:

1. Make sure the backend virtual environment exists once
2. Install Electron dependencies in this folder
3. Run `npm run dev`

Or use:

- [start-electron.command](/Users/pauljames/Documents/Codex/Thai%20comic%20reader/electron_app/start-electron.command)
- [run-electron.sh](/Users/pauljames/Documents/Codex/Thai%20comic%20reader/electron_app/run-electron.sh)
- [scripts/check-electron-readiness.sh](/Users/pauljames/Documents/Codex/Thai%20comic%20reader/electron_app/scripts/check-electron-readiness.sh)

The shell launcher will install Electron dependencies, install frontend dependencies if needed, and build the frontend bundle if it is missing.

## Next steps

- Add packaging with `electron-builder`
- Bundle or ship a Python runtime cleanly for non-technical friends
- Add app icons and a polished startup experience

## Packaging note

The first packaging attempt in this workspace reached the Electron download step and then failed because the environment could not resolve `github.com`.

That means the current blocker is:

- network access for Electron binary download during `electron-builder`

Not a JavaScript syntax issue or app-structure issue.

## Backend bundling

See [docs/backend-bundling.md](/Users/pauljames/Documents/Codex/Thai%20comic%20reader/electron_app/docs/backend-bundling.md) for the next runtime-packaging step.
