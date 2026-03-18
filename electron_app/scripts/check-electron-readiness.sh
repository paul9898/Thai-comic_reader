#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"
ELECTRON_DIR="$ROOT_DIR/electron_app"

echo "Checking Thai Comic Reader Electron readiness..."
echo

if [[ -f "$FRONTEND_DIR/dist/index.html" ]]; then
  echo "[ok] Frontend build exists"
else
  echo "[warn] Frontend build missing at frontend/dist/index.html"
fi

if [[ -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "[ok] Frontend dependencies exist"
else
  echo "[warn] Frontend node_modules missing"
fi

if [[ -d "$BACKEND_DIR/.venv" ]]; then
  echo "[ok] Backend virtual environment exists"
else
  echo "[warn] Backend virtual environment missing"
fi

if [[ -f "$ROOT_DIR/dictionary.js" ]]; then
  echo "[ok] Thai dictionary file exists"
else
  echo "[warn] dictionary.js missing"
fi

if [[ -f "$ROOT_DIR/telex-utf8.csv" ]]; then
  echo "[ok] English dictionary file exists"
else
  echo "[warn] telex-utf8.csv missing"
fi

if [[ -d "$ELECTRON_DIR/node_modules" ]]; then
  echo "[ok] Electron dependencies exist"
else
  echo "[warn] Electron node_modules missing"
fi

echo
echo "Next manual packaging step:"
echo "  cd \"$ELECTRON_DIR\" && npm run package"
