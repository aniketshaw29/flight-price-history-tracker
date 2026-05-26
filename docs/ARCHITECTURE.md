# Architecture

## Overview

The tracker is a single-machine Python application with four loosely coupled layers: data collection, storage, alerting, and presentation. There is no server, no network exposure, and no external dependencies beyond the scraping library and email SMTP.

```
┌─────────────────────────────────────────────────────────┐
│                    config.toml                          │
│         (routes, thresholds, email, interval)           │
└────────────────────────┬────────────────────────────────┘
                         │ read at startup + each poll
                         ▼
┌─────────────────────────────────────────────────────────┐
│                  scheduler.py                           │
│           APScheduler — fires every N hours             │
│     loops over routes → calls scraper → stores → alerts │
└────┬───────────────────┬──────────────────┬─────────────┘
     │                   │                  │
     ▼                   ▼                  ▼
┌─────────┐       ┌──────────┐       ┌──────────────┐
│scraper.py│      │  db.py   │       │  alerts.py   │
│          │      │          │       │              │
│fast-     │      │ SQLite   │       │ smtplib      │
│flights   │      │flights.db│       │ email alert  │
│(Google   │      │          │       │ on threshold │
│Flights)  │      │          │       │ breach       │
└─────────┘       └────┬─────┘       └──────────────┘
                       │ read history
                       ▼
              ┌─────────────────┐
              │     app.py      │
              │   Streamlit     │
              │  price charts   │
              │  per route      │
              └─────────────────┘
                       ▲
                  browser (localhost)
```

---

## Components

### `config.toml`
Single source of truth. Defines routes to watch, per-route thresholds, email credentials, and poll interval. Edited by hand or via `cli.py add-route`.

### `cli.py`
Thin Click-based CLI. Entry point for all user interactions: adding/removing routes, triggering manual polls, viewing history. Does not contain business logic — delegates to the other modules.

### `tracker/scraper.py`
Wraps `fast-flights` to fetch the current cheapest price for a route + date. Returns a plain `float`. Handles one-way and round-trip by passing the appropriate parameters. This is the only component that makes outbound network requests.

### `tracker/db.py`
All SQLite interactions. Two tables:

| Table | Purpose |
|---|---|
| `routes` | Persists tracked routes from config (id, origin, dest, dates, trip type, threshold) |
| `price_snapshots` | One row per poll per route (route_id, price, fetched_at) |

Exposes simple functions: `upsert_route`, `insert_snapshot`, `get_history`, `get_latest_price`.

### `tracker/scheduler.py`
APScheduler `BlockingScheduler` that runs the poll job on the configured interval. Each job execution: loads routes from DB → scrapes price → writes snapshot → checks threshold → fires alert if needed.

### `tracker/alerts.py`
Sends an email via `smtplib` + `config.toml` SMTP credentials when a new snapshot price is below the route threshold. Only sends if the *previous* snapshot was above threshold (avoids repeated emails for the same drop).

### `app.py`
Streamlit app. Reads directly from `flights.db`. Sidebar lets you filter by origin, destination, trip type, departure date, and a history date-window. Main area shows 5 key metrics and a price-over-time line chart with threshold marker. Raw data in a collapsible table. Runs separately from the scheduler via `./start.sh`.

---

## Data Flow — Single Poll Cycle

```
scheduler fires
    │
    ├─ db.get_all_routes()
    │
    └─ for each route:
           │
           ├─ scraper.fetch_price(origin, dest, depart, return, trip_type)
           │       └─ returns float or None (if scrape fails)
           │
           ├─ db.insert_snapshot(route_id, price, now)
           │
           └─ alerts.check_and_send(route, price, db.get_prev_snapshot())
                   └─ if price < threshold AND prev_price >= threshold:
                          send email
```

---

## SQLite Schema

```sql
CREATE TABLE routes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    origin      TEXT NOT NULL,
    destination TEXT NOT NULL,
    depart_date TEXT NOT NULL,
    return_date TEXT,               -- NULL for one-way
    trip_type   TEXT NOT NULL,      -- 'one-way' | 'round-trip'
    threshold   REAL NOT NULL,
    active      INTEGER DEFAULT 1
);

CREATE TABLE price_snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    route_id    INTEGER NOT NULL REFERENCES routes(id),
    price       REAL NOT NULL,
    fetched_at  TEXT NOT NULL       -- ISO 8601 UTC
);
```

---

## Error Handling

- Scrape failures (rate-limited, layout change, network error) log a warning and skip the snapshot — no crash, scheduler continues.
- Email failures log an error but do not stop the scheduler.
- Config file missing or malformed raises a clear error at startup with the offending key.

---

## Limitations

- `fast-flights` scrapes Google Flights and may break if Google changes its layout.
- Prices are point-in-time snapshots; the tracker does not guarantee it captures the absolute lowest price between polls.
- Email credentials are stored in plaintext in `config.toml` — keep it out of version control (add `config.toml` to `.gitignore`).
