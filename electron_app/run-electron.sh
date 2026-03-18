#!/bin/zsh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ELECTRON_DIR="$ROOT_DIR/electron_app"
FRONTEND_DIR="$ROOT_DIR/frontend"

cd "$ELECTRON_DIR"

if [[ ! -d node_modules ]]; then
  echo "Installing Electron dependencies..."
  npm install
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "Installing frontend dependencies..."
  cd "$FRONTEND_DIR"
  npm install
  cd "$ELECTRON_DIR"
fi

if [[ ! -f "$FRONTEND_DIR/dist/index.html" ]]; then
  echo "Building frontend bundle for Electron..."
  cd "$FRONTEND_DIR"
  npm run build
  cd "$ELECTRON_DIR"
fi

echo "Starting Thai Comic Reader Electron..."
npm run dev
