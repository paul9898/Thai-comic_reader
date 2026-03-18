# Windows Backend Runtime

This folder is reserved for the Windows-specific Python runtime used by the Electron app packaging flow.

Expected structure after setup on Windows:

- `backend_windows/.venv/`

## Bootstrap on Windows

From PowerShell in the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\electron_app\scripts\bootstrap-windows-runtime.ps1
```

That script will:

- create `backend_windows/.venv`
- install backend dependencies from `backend/requirements.txt`

## Packaging after bootstrap

Once the Windows runtime exists, the Electron packaging flow can use:

```powershell
cd .\electron_app
npm run package:prep:win
npm run package:win
```
