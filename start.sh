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

# ── find a free port (tries preferred, increments until one is free) ──────────
find_free_port() {
  python3 - "$1" <<'EOF'
import socket, sys
port = int(sys.argv[1])
while True:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.bind(("", port))
        s.close()
        print(port)
        break
    except OSError:
        port += 1
EOF
}

API_PORT=$(find_free_port 4314)
FRONTEND_PORT=$(find_free_port 4142)
export API_PORT FRONTEND_PORT

if [ "$API_PORT" != "4314" ]; then
  echo "Port 4314 in use — using $API_PORT for API"
fi
if [ "$FRONTEND_PORT" != "4142" ]; then
  echo "Port 4142 in use — using $FRONTEND_PORT for frontend"
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
echo "Starting API server on http://localhost:$API_PORT ..."
uvicorn api:app --app-dir "$ROOT" --port "$API_PORT" --reload &
API_PID=$!

# ── start React dev server ────────────────────────────────────────────────────
echo "Starting React app on http://localhost:$FRONTEND_PORT ..."
(cd "$ROOT/frontend" && npm run dev -- --port "$FRONTEND_PORT") &
FRONTEND_PID=$!

echo ""
echo "  App:  http://localhost:$FRONTEND_PORT"
echo "  API:  http://localhost:$API_PORT/docs"
echo ""
echo "Press Ctrl+C to stop everything."

wait
