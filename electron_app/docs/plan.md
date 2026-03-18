# Electron Plan

## Goal

Wrap the existing Thai Comic Reader Basic app in a desktop shell for non-technical users.

## Phase 1

- Separate Electron project
- Opens the existing frontend in a desktop window
- Starts the existing backend if the virtual environment already exists

## Phase 2

- Replace the Vite dev server dependency with a packaged frontend build
- Add startup checks and friendlier error screens
- Add app icons and proper window polish
- Carry frontend/backend/dictionary resources inside the Electron bundle

## Phase 3

- Package or embed a Python runtime for Mac distribution
- Produce a signed or unsigned DMG for sharing
- Add app-level file open handling
