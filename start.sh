#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── activate venv ─────────────────────────────────────────────────────────────
if [ ! -d "$ROOT/.venv" ]; then
  echo "ERROR: .venv not found. Run: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi
source "$ROOT/.venv/bin/activate"

# ── load secrets ──────────────────────────────────────────────────────────────
if [ -f "$ROOT/.env" ]; then
  set -a && source "$ROOT/.env" && set +a
else
  echo "WARNING: .env not found — email alerts will not work. See .env.example"
fi

# ── start tracker in background ───────────────────────────────────────────────
echo "Starting price tracker..."
python "$ROOT/cli.py" run-tracker &
TRACKER_PID=$!

# ── kill tracker when this script exits ───────────────────────────────────────
trap "echo ''; echo 'Stopping tracker...'; kill $TRACKER_PID 2>/dev/null; exit" INT TERM EXIT

# ── start dashboard (foreground) ──────────────────────────────────────────────
echo "Starting dashboard → http://localhost:8501"
streamlit run "$ROOT/app.py"
