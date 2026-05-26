# Architecture

## Overview

The tracker is a three-process local application: a Python background scheduler that collects prices, a FastAPI server that exposes the SQLite data, and a React frontend that the user interacts with. All three run on localhost via `./start.sh`.

```
┌─────────────────────────────────────────────────────────────┐
│                      config.toml                            │
│          (routes, thresholds, smtp host/port, interval)     │
│                       + .env                                │
│          (SMTP_SENDER, SMTP_PASSWORD, SMTP_RECIPIENT)        │
└───────────────────┬─────────────────────────────────────────┘
                    │ read at startup
                    ▼
┌───────────────────────────────────┐
│          scheduler.py             │
│   APScheduler — every N hours     │
│   poll → store → alert            │
└──┬──────────────┬──────────────┬──┘
   │              │              │
   ▼              ▼              ▼
┌──────────┐ ┌─────────┐ ┌────────────┐
│scraper.py│ │  db.py  │ │ alerts.py  │
│          │ │         │ │            │
│fast-     │ │ SQLite  │ │ smtplib    │
│flights   │ │  .db    │ │ reads creds│
│(Google   │ │         │ │ from env   │
│Flights)  │ └────┬────┘ └────────────┘
└──────────┘      │ read via SQL
                  ▼
          ┌──────────────┐
          │    api.py    │
          │   FastAPI    │
          │ :8000        │
          └──────┬───────┘
                 │ JSON (proxied via /api)
                 ▼
          ┌──────────────┐
          │  frontend/   │
          │    React     │
          │    :5173     │
          └──────────────┘
                 ▲
           browser (localhost)
```

---

## Components

### `config.toml`
Defines routes to watch, per-route thresholds, poll interval, and SMTP host/port. No credentials — those live in `.env`. Safe to commit to git.

### `.env`
Holds `SMTP_SENDER`, `SMTP_PASSWORD`, `SMTP_RECIPIENT`. Gitignored. Loaded by `start.sh` before any process starts.

### `cli.py`
Click-based CLI. Manages routes (`add-route`, `list-routes`, `remove-route`), triggers manual polls, prints history, and starts the scheduler (`run-tracker`). Delegates all logic to the `tracker/` package.

### `tracker/scraper.py`
Wraps `fast-flights` to fetch the current cheapest price for a route + date. Returns a plain `float` or `None` on failure. Handles one-way and round-trip. Only component that makes outbound network requests.

### `tracker/db.py`
All SQLite interactions. Schema: `routes` table (what to track) and `price_snapshots` table (time-series price data). Uses `CREATE TABLE IF NOT EXISTS` — additive only, never drops data.

Key functions: `init_db`, `upsert_route`, `get_active_routes`, `insert_snapshot`, `get_history`, `get_latest_two`.

### `tracker/scheduler.py`
APScheduler `BlockingScheduler`. On each interval: reads active routes from DB → scrapes price → writes snapshot → checks if price crossed threshold → fires alert if so. Runs an immediate poll on startup before entering the schedule.

### `tracker/alerts.py`
Sends email via `smtplib` when a new snapshot price drops below threshold and the previous snapshot was above it (prevents repeated emails for a sustained low price). Reads SMTP credentials from environment variables — raises `EnvironmentError` at send time if any are missing.

### `api.py`
FastAPI app with two endpoints:
- `GET /routes` — returns all active routes from SQLite
- `GET /routes/{id}/history` — returns price snapshots for a route, with optional `from_date` / `to_date` query params

CORS is restricted to `http://localhost:5173`.

### `frontend/`
React + Vite app. Vite proxies `/api/*` to `http://localhost:8000` so the React code just calls `/api/routes` etc. without hardcoding ports.

Components:
| File | Purpose |
|---|---|
| `App.jsx` | State, data fetching, cascading filter logic |
| `SearchBar.jsx` | From / To / Trip type / Departure date dropdowns + date range pickers |
| `MetricsRow.jsx` | 5 metric cards (current, previous, lowest, highest, threshold status) |
| `PriceChart.jsx` | Recharts `LineChart` with threshold `ReferenceLine` |
| `PriceTable.jsx` | Collapsible scrollable table with per-row delta column |

---

## Data Flow — Single Poll Cycle

```
scheduler fires
    │
    ├─ db.get_active_routes()
    │
    └─ for each route:
           │
           ├─ scraper.fetch_price(route)
           │       └─ returns float (INR) or None
           │
           ├─ db.insert_snapshot(route_id, price)
           │
           └─ db.get_latest_two(route_id)
                   └─ if price < threshold AND prev >= threshold:
                          alerts.send_alert(...)
```

---

## SQLite Schema

```sql
CREATE TABLE IF NOT EXISTS routes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    origin      TEXT NOT NULL,
    destination TEXT NOT NULL,
    depart_date TEXT NOT NULL,
    return_date TEXT,               -- NULL for one-way
    trip_type   TEXT NOT NULL,      -- 'one-way' | 'round-trip'
    threshold   REAL NOT NULL,
    active      INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS price_snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id    INTEGER NOT NULL REFERENCES routes(id),
    price       REAL NOT NULL,
    fetched_at  TEXT NOT NULL       -- ISO 8601 UTC
);

CREATE INDEX IF NOT EXISTS idx_snapshots_route
    ON price_snapshots(route_id, fetched_at);
```

Schema is **additive only** — `IF NOT EXISTS` on every statement means restarts never lose data.

---

## Error Handling

- Scrape failures (rate-limited, layout change, network error) log a warning and skip the snapshot — scheduler continues with the next route.
- Email failures log an error but do not crash the scheduler.
- Missing `.env` credentials raise `EnvironmentError` at alert-send time (not at startup), so the tracker still runs and collects data even without email configured.
- Config file missing or malformed raises a clear error at startup.

---

## Limitations

- `fast-flights` scrapes Google Flights and may break if Google changes its layout.
- Price history only goes back to when you first added a route — there is no historical data before tracking began.
- Prices are point-in-time snapshots; drops between polls are not captured.
