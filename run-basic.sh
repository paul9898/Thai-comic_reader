#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
RUN_DIR="$ROOT_DIR/.run"
BACKEND_LOG="$RUN_DIR/backend.log"
FRONTEND_LOG="$RUN_DIR/frontend.log"
BACKEND_PID_FILE="$RUN_DIR/backend.pid"
FRONTEND_PID_FILE="$RUN_DIR/frontend.pid"

mkdir -p "$RUN_DIR"

cleanup() {
  if [[ -f "$BACKEND_PID_FILE" ]]; then
    kill "$(cat "$BACKEND_PID_FILE")" 2>/dev/null || true
    rm -f "$BACKEND_PID_FILE"
  fi
  if [[ -f "$FRONTEND_PID_FILE" ]]; then
    kill "$(cat "$FRONTEND_PID_FILE")" 2>/dev/null || true
    rm -f "$FRONTEND_PID_FILE"
  fi
}

trap cleanup EXIT INT TERM

echo "Starting Thai Comic Reader Basic..."

if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
  echo "Creating backend virtual environment..."
  python3 -m venv "$BACKEND_DIR/.venv"
fi

echo "Installing backend dependencies if needed..."
source "$BACKEND_DIR/.venv/bin/activate"
pip install -r "$BACKEND_DIR/requirements.txt" >/dev/null

echo "Installing frontend dependencies if needed..."
cd "$FRONTEND_DIR"
npm install >/dev/null

echo "Starting backend on http://127.0.0.1:8000 ..."
cd "$BACKEND_DIR"
source .venv/bin/activate
uvicorn main:app --host 127.0.0.1 --port 8000 >"$BACKEND_LOG" 2>&1 &
echo $! > "$BACKEND_PID_FILE"

echo "Starting frontend on http://127.0.0.1:5173 ..."
cd "$FRONTEND_DIR"
npm run dev -- --host 127.0.0.1 --port 5173 >"$FRONTEND_LOG" 2>&1 &
echo $! > "$FRONTEND_PID_FILE"

sleep 3

echo
echo "Thai Comic Reader Basic is starting."
echo "Frontend: http://127.0.0.1:5173"
echo "Backend:  http://127.0.0.1:8000"
echo
echo "Logs:"
echo "  $BACKEND_LOG"
echo "  $FRONTEND_LOG"
echo
echo "Press Ctrl+C in this window to stop both servers."

tail -f "$BACKEND_LOG" "$FRONTEND_LOG"
