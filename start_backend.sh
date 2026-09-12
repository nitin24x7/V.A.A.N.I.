#!/usr/bin/env bash
# VAANI — Standalone Backend Server Launcher
# Run this from any terminal without needing "source backend_venv/bin/activate"

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PYTHON_BIN="$DIR/backend_venv/bin/python3"

if [ ! -f "$PYTHON_BIN" ]; then
    echo "❌ Error: Virtualenv Python binary not found at $DIR/backend_venv/bin/python3"
    exit 1
fi

export PYTHONPATH="$DIR/backend/deps:$DIR/backend:$PYTHONPATH"
export HF_HOME="$DIR/backend/models/cache"
export HUGGINGFACE_HUB_CACHE="$DIR/backend/models/cache/hub"

echo "=========================================================="
echo "🚀 Starting VAANI Backend Server (FastAPI + AASIST + Whisper)"
echo "   Endpoint: http://0.0.0.0:8000"
echo "   No virtualenv activation needed!"
echo "=========================================================="

exec "$PYTHON_BIN" -m uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir backend --reload "$@"

