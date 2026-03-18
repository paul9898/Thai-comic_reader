# Windows Packaging

## Goal

Build a Windows desktop package that carries its own backend runtime instead of depending on the macOS Python environment.

## One-time runtime setup on Windows

From PowerShell at the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\electron_app\scripts\bootstrap-windows-runtime.ps1
```

This creates:

- `backend_windows/.venv`

## Packaging commands on Windows

```powershell
cd .\electron_app
npm install
npm run package:prep:win
npm run package:win
```

## Notes

- `package:prep:win` will fail fast if `backend_windows/.venv` does not exist yet.
- The Electron main process already knows how to prefer Windows-style Python paths inside the packaged app.
- The Windows package should be built on Windows or a Windows CI runner.
