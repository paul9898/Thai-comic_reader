#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
STAGE_DIR="$ROOT_DIR/electron_app/bundle/backend-runtime"

echo "Preparing backend runtime bundle..."

if [[ -d "$STAGE_DIR" ]]; then
  mv "$STAGE_DIR" "${STAGE_DIR}.old.$(date +%s)"
fi
mkdir -p "$STAGE_DIR"

mkdir -p "$STAGE_DIR/backend"
rsync -a \
  --exclude ".venv" \
  --exclude "__pycache__" \
  --exclude "storage" \
  "$BACKEND_DIR/" "$STAGE_DIR/backend/"

if [[ -d "$BACKEND_DIR/.venv" ]]; then
  cp -R "$BACKEND_DIR/.venv" "$STAGE_DIR/.venv"
fi

if [[ -d "$STAGE_DIR/.venv" ]]; then
  /bin/rm -rf \
    "$STAGE_DIR/.venv/include" \
    "$STAGE_DIR/.venv/share" \
    "$STAGE_DIR/.venv/lib/python3.11/site-packages/pip" \
    "$STAGE_DIR/.venv/lib/python3.11/site-packages/pip-"*.dist-info \
    "$STAGE_DIR/.venv/lib/python3.11/site-packages/setuptools" \
    "$STAGE_DIR/.venv/lib/python3.11/site-packages/setuptools-"*.dist-info

  find "$STAGE_DIR/.venv" \
    \( -type d \( -name "__pycache__" -o -name "tests" -o -name "test" -o -name ".pytest_cache" \) \
    -o -type f \( -name "*.pyc" -o -name "*.pyo" -o -name "*.a" \) \) \
    -exec /bin/rm -rf {} +
fi

if [[ -f "$ROOT_DIR/dictionary.js" ]]; then
  cp "$ROOT_DIR/dictionary.js" "$STAGE_DIR/dictionary.js"
fi

if [[ -f "$ROOT_DIR/telex-utf8.csv" ]]; then
  cp "$ROOT_DIR/telex-utf8.csv" "$STAGE_DIR/telex-utf8.csv"
fi

echo "Backend runtime staged at:"
echo "  $STAGE_DIR"
