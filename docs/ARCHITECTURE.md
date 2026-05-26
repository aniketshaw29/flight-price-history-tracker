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
          │ :4314        │
          └──────┬───────┘
                 │ JSON (proxied via /api)
                 ▼
          ┌──────────────┐
          │  frontend/   │
          │    React     │
          │    :4142     │
          └──────────────┘
                 ▲
           browser (localhost)
```

---

## Components

### `config.toml`
Defines routes to watch, per-route thresholds, poll interval, and SMTP host/port. No credentials — those live in `.env`. Safe to commit to git. Routes can also be added/edited/removed directly from the React UI without touching this file.

### `.env`
Holds `SMTP_SENDER`, `SMTP_PASSWORD`, `SMTP_RECIPIENT`. Gitignored. Loaded by `start.sh` before any process starts.

### `cli.py`
Click-based CLI. Manages routes (`add-route`, `list-routes`, `remove-route`), triggers manual polls, prints history, and starts the scheduler (`run-tracker`). Delegates all logic to the `tracker/` package.

### `tracker/scraper.py`
Wraps `fast-flights` to fetch all available flights for a route + date. `fetch_all()` returns a list of dicts `{airline, departure, arrival, duration, stops, price}`. `fetch_price()` is a convenience wrapper returning the cheapest price. Only component that makes outbound network requests.

### `tracker/db.py`
All SQLite interactions. Schema: `routes`, `price_snapshots`, `flight_options`. Uses `CREATE TABLE IF NOT EXISTS` — additive only, never drops data.

Key functions: `init_db`, `upsert_route`, `set_route`, `get_active_routes`, `get_active_routes_with_latest`, `get_route`, `deactivate_route`, `update_threshold`, `insert_snapshot`, `insert_flight_options`, `get_latest_flight_options`, `get_history`, `get_latest_two`.

### `tracker/scheduler.py`
APScheduler `BlockingScheduler`. On each interval: reads active routes from DB → calls `scraper.fetch_all()` → writes cheapest price snapshot → stores all flight options → checks if price crossed threshold → fires alert if so. Runs an immediate poll on startup.

### `tracker/alerts.py`
Sends email via `smtplib` when a new snapshot price drops below threshold and the previous snapshot was above it (prevents repeated emails for a sustained low price). Reads SMTP credentials from environment variables — raises `EnvironmentError` at send time if any are missing.

### `api.py`
FastAPI app. CORS restricted to `http://localhost:4142`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/routes` | All active routes with latest price |
| POST | `/routes` | Add a new tracked route |
| PATCH | `/routes/{id}` | Edit a route's fields |
| DELETE | `/routes/{id}` | Deactivate a route |
| GET | `/routes/{id}/history` | Price snapshots, optional `from_date`/`to_date` |
| GET | `/routes/{id}/options` | Latest poll's flight options, optional `nonstop` filter |
| PATCH | `/routes/{id}/threshold` | Update alert threshold only |

### `frontend/`
React + Vite app. Vite proxies `/api/*` to `http://localhost:4314`.

**Pages:**
| File | Route | Purpose |
|---|---|---|
| `pages/Dashboard.jsx` | `/` | Grid of route cards with Add / Delete |
| `pages/RoutePage.jsx` | `/route/:id` | Full detail: search, metrics, chart, table, flights |

**Components:**
| File | Purpose |
|---|---|
| `components/SearchBar.jsx` | Free-text airport inputs, trip type, departure date, history date range |
| `components/MetricsRow.jsx` | 5 metric cards; threshold card is click-to-edit |
| `components/PriceChart.jsx` | Recharts `LineChart` with threshold `ReferenceLine` |
| `components/PriceTable.jsx` | Collapsible table, newest-first, with per-row delta |
| `components/FlightsTable.jsx` | All flights for latest poll; nonstop-only toggle |
| `components/RouteFormModal.jsx` | Modal form used for both Add Route and Edit Route |

---

## Data Flow — Single Poll Cycle

```
scheduler fires
    │
    ├─ db.get_active_routes()
    │
    └─ for each route:
           │
           ├─ fetched_at = datetime.now(utc).isoformat()
           │
           ├─ scraper.fetch_all(route)
           │       └─ returns list of {airline, dep, arr, duration, stops, price}
           │
           ├─ db.insert_snapshot(route_id, min_price, fetched_at)
           │
           ├─ db.insert_flight_options(route_id, flights, fetched_at)
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

CREATE TABLE IF NOT EXISTS flight_options (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id    INTEGER NOT NULL REFERENCES routes(id),
    fetched_at  TEXT NOT NULL,
    airline     TEXT,
    departure   TEXT,
    arrival     TEXT,
    duration    TEXT,
    stops       INTEGER NOT NULL DEFAULT 0,
    price       REAL NOT NULL
);
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
