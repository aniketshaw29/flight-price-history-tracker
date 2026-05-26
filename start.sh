#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── activate venv ─────────────────────────────────────────────────────────────
if [ ! -d "$ROOT/.venv" ]; then
  echo "ERROR: .venv not found. Run:"
  echo "  python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi
source "$ROOT/.venv/bin/activate"

# ── load secrets ──────────────────────────────────────────────────────────────
if [ -f "$ROOT/.env" ]; then
  set -a && source "$ROOT/.env" && set +a
else
  echo "WARNING: .env not found — email alerts will not work. See .env.example"
fi

# ── check node / npm ──────────────────────────────────────────────────────────
if ! command -v npm &>/dev/null; then
  echo "ERROR: npm not found. Install Node.js from https://nodejs.org"
  exit 1
fi

# ── install frontend deps if needed ───────────────────────────────────────────
if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "Installing frontend dependencies..."
  (cd "$ROOT/frontend" && npm install)
fi

# ── kill all children on exit ─────────────────────────────────────────────────
cleanup() {
  echo ""
  echo "Stopping all processes..."
  kill "$TRACKER_PID" "$API_PID" "$FRONTEND_PID" 2>/dev/null
  exit
}
trap cleanup INT TERM

# ── start tracker ─────────────────────────────────────────────────────────────
echo "Starting price tracker..."
python "$ROOT/cli.py" run-tracker &
TRACKER_PID=$!

# ── start FastAPI ─────────────────────────────────────────────────────────────
echo "Starting API server on http://localhost:8000 ..."
uvicorn api:app --app-dir "$ROOT" --port 8000 --reload &
API_PID=$!

# ── start React dev server ────────────────────────────────────────────────────
echo "Starting React app on http://localhost:5173 ..."
(cd "$ROOT/frontend" && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "  App:  http://localhost:5173"
echo "  API:  http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop everything."

wait
