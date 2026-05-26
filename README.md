# Flight Price History Tracker

A local-only tool that tracks flight prices over time, stores history in SQLite, and alerts you via email when prices drop below a threshold.

**Never hosted. Runs entirely on your machine.**

---

## Features

- Track one-way and round-trip routes (CCU ↔ BLR and any other pair)
- Add, edit, and remove tracked routes directly from the UI — no config file editing needed
- Configurable polling interval (default: every 6 hours)
- Price history stored locally in SQLite — accumulates forever, never dropped
- All available flights stored per poll (not just the cheapest), with nonstop filter
- React dashboard: route cards, price chart, metrics, price table, flights table
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

# 4. (Optional) Edit config.toml to seed initial routes
# You can also add routes from the UI after starting

# 5. Run everything with one command
./start.sh
```

Then open **http://localhost:4142**

---

## Dashboard

React app served at `http://localhost:4142`.

**Dashboard (`/`):**
- Grid of route cards showing origin → destination, latest price, threshold status
- **＋ Add Route** button — opens a form to add any airport pair
- Hover a card to reveal the **✕** delete button
- Click any card to open its detail page

**Route detail page (`/route/:id`):**
- SearchBar: free-text airport inputs, trip type, departure date, history date range filter
- **Edit route** button — edit origin, destination, dates, trip type, threshold
- 5 metrics: current price, previous price, lowest ever, highest ever, alert threshold (click-to-edit)
- Price line chart with red dashed threshold line
- Collapsible price history table with per-row delta
- Available flights table for the latest poll (nonstop-only toggle)

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
│   ├── scraper.py          ← fast-flights: fetch_all() + fetch_price()
│   ├── scheduler.py        ← APScheduler poll loop
│   └── alerts.py           ← email via smtplib (reads creds from env)
├── frontend/               ← React + Vite app
│   ├── package.json
│   ├── vite.config.js      ← port 4142, proxies /api → localhost:4314
│   └── src/
│       ├── App.jsx          ← BrowserRouter shell
│       ├── pages/
│       │   ├── Dashboard.jsx      ← route card grid, add/delete routes
│       │   ├── Dashboard.css
│       │   ├── RoutePage.jsx      ← detail page with all charts and tables
│       │   └── RoutePage.css
│       ├── components/
│       │   ├── SearchBar.jsx      ← airport inputs, dates, history filter
│       │   ├── MetricsRow.jsx     ← 5 metric cards, threshold click-to-edit
│       │   ├── PriceChart.jsx     ← Recharts line chart with threshold line
│       │   ├── PriceTable.jsx     ← collapsible history table
│       │   ├── FlightsTable.jsx   ← latest poll flights, nonstop toggle
│       │   └── RouteFormModal.jsx ← add / edit route modal form
│       └── index.css
├── docs/
│   ├── ARCHITECTURE.md
│   └── TECH_STACK.md
└── data/
    └── flights.db          ← SQLite database (auto-created, gitignored)
```

---

## Configuration (`config.toml`)

Safe to commit — no credentials here. Routes defined here are seeded into the DB at startup. You can also manage routes entirely through the UI.

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

FastAPI runs at `http://localhost:4314`. Interactive docs at `http://localhost:4314/docs`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/routes` | All active routes with latest price |
| POST | `/routes` | Add a new tracked route |
| PATCH | `/routes/{id}` | Edit a route (all fields) |
| DELETE | `/routes/{id}` | Deactivate a route |
| GET | `/routes/{id}/history` | Price snapshots (`from_date`, `to_date` optional) |
| GET | `/routes/{id}/options` | Latest poll's flights (`nonstop=true` optional) |
| PATCH | `/routes/{id}/threshold` | Update alert threshold only |

---

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Tech Stack](docs/TECH_STACK.md)
