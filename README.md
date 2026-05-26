# Flight Price History Tracker

A local-only tool that tracks flight prices over time, stores history in SQLite, and alerts you via email when prices drop below a threshold.

**Never hosted. Runs entirely on your machine.**

---

## Features

- Track one-way and round-trip routes (CCU ↔ BLR and any other pair)
- Configurable polling interval (default: every 6 hours)
- Price history stored locally in SQLite — accumulates forever, never dropped
- React dashboard to visualize price trends with interactive filters
- Email alerts when price drops below your threshold
- CLI to manage routes, view history, and trigger manual polls

---

## Quick Start

```bash
# 1. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Set email credentials (never committed)
cp .env.example .env
# edit .env — fill in SMTP_SENDER, SMTP_PASSWORD, SMTP_RECIPIENT

# 4. Edit config.toml — set your routes, departure dates, thresholds

# 5. Run everything with one command
./start.sh
```

Then open **http://localhost:5173**

---

## Dashboard

React app served at `http://localhost:5173`.

**Search bar (top of page):**
| Control | Type | Description |
|---|---|---|
| From | Dropdown | Origin airport (e.g. CCU) |
| To | Dropdown | Destination — cascades from From |
| Trip type | Dropdown | one-way or round-trip |
| Departure date | Dropdown | Which tracked flight date to view |
| History from | Date picker | Start of history window |
| History to | Date picker | End of history window |

**Main view:**
- 5 metrics: current price, previous price, lowest ever, highest ever, threshold status
- Price line chart with red dashed threshold line and rich tooltip (date + time + price)
- Collapsible raw data table with per-row price change column

---

## Project Structure

```
flight-price-history-tracker/
├── api.py                  ← FastAPI backend (serves SQLite data to the React app)
├── cli.py                  ← Click CLI (add-route, list, poll, history, run-tracker)
├── start.sh                ← starts tracker + API + React dev server
├── config.toml             ← routes, thresholds, SMTP host/port (safe to commit)
├── .env                    ← SMTP credentials (gitignored — never commit)
├── .env.example            ← template for .env
├── requirements.txt
├── tracker/
│   ├── db.py               ← SQLite schema + all queries
│   ├── scraper.py          ← fast-flights price fetch + price parsing
│   ├── scheduler.py        ← APScheduler poll loop
│   └── alerts.py           ← email via smtplib (reads creds from env)
├── frontend/               ← React + Vite app
│   ├── package.json
│   ├── vite.config.js      ← proxies /api → localhost:8000
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── SearchBar.jsx
│       │   ├── MetricsRow.jsx
│       │   ├── PriceChart.jsx
│       │   └── PriceTable.jsx
│       └── index.css
├── docs/
│   ├── ARCHITECTURE.md
│   └── TECH_STACK.md
└── data/
    └── flights.db          ← SQLite database (auto-created, gitignored)
```

---

## Configuration (`config.toml`)

Safe to commit — no credentials here.

```toml
[tracker]
poll_interval_hours = 6

[email]
smtp_host = "smtp.gmail.com"
smtp_port = 587
# credentials come from .env

# Home → Work  (Kolkata → Bangalore)
[[routes]]
origin      = "CCU"
destination = "BLR"
depart_date = "2026-07-01"
trip_type   = "one-way"
threshold   = 4000

# Work → Home  (Bangalore → Kolkata)
[[routes]]
origin      = "BLR"
destination = "CCU"
depart_date = "2026-07-10"
trip_type   = "one-way"
threshold   = 4000
```

## Credentials (`.env`)

```bash
SMTP_SENDER=you@gmail.com
SMTP_PASSWORD=your-gmail-app-password   # Gmail App Password, not your main password
SMTP_RECIPIENT=you@gmail.com
```

Use a [Gmail App Password](https://support.google.com/accounts/answer/185833) — Settings → Security → 2-Step Verification → App Passwords.

---

## CLI Reference

| Command | Description |
|---|---|
| `python cli.py add-route` | Add a new route to track |
| `python cli.py list-routes` | Show all active routes |
| `python cli.py remove-route <id>` | Deactivate a route |
| `python cli.py poll` | Manually trigger a price check now |
| `python cli.py history <id>` | Print full price log for a route |
| `python cli.py run-tracker` | Start background scheduler (used by start.sh) |

---

## API

FastAPI runs at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

| Endpoint | Description |
|---|---|
| `GET /routes` | List all active routes |
| `GET /routes/{id}/history` | Price snapshots for a route (optional `from_date`, `to_date` params) |

---

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Tech Stack](docs/TECH_STACK.md)
