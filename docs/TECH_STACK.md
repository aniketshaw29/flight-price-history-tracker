# Tech Stack

## Backend Language

**Python 3.11+**

- Rich scraping and scheduling ecosystem
- `tomllib` and `sqlite3` are standard library — zero extra deps for config and DB
- Fast iteration for a local tool

---

## Frontend Language

**React 18 + Vite**

- Component-based UI with proper state management
- Native `<input type="date">` and `<select>` — no third-party date picker needed
- Vite dev server proxies `/api` to FastAPI — no CORS juggling during development
- Hot module reload on save

---

## Price Data Source

**[fast-flights](https://github.com/AWeirdDev/fast-flights)**

| Attribute | Detail |
|---|---|
| Cost | Free — no API key |
| Source | Scrapes Google Flights |
| Coverage | One-way and round-trip |
| Risk | Can break on Google layout changes |

Alternatives considered:

| Option | Cost | Notes |
|---|---|---|
| Amadeus API | Free tier (2000 req/month) | Requires sign-up, API key, rate limits |
| Skyscanner API | Closed to new devs | No longer publicly available |
| Serpapi Google Flights | $50/month after trial | Reliable but paid |
| selenium DIY scrape | Free | Heavy, brittle, requires ChromeDriver |

`fast-flights` wins for zero-friction local use. If it breaks, swapping in Amadeus only requires changing `scraper.py`.

---

## Database

**SQLite** (via Python `sqlite3` standard library)

- Zero setup — single file at `data/flights.db`
- No server process
- Additive schema (`CREATE TABLE IF NOT EXISTS`) — restarts never drop data
- Queryable with any SQLite GUI (e.g. DB Browser for SQLite)
- More than sufficient for years of price snapshots from a handful of routes

---

## API Server

**[FastAPI](https://fastapi.tiangolo.com/) + [Uvicorn](https://www.uvicorn.org/)**

- REST API between SQLite and the React frontend
- Endpoints: `GET /routes`, `POST /routes`, `PATCH /routes/{id}`, `DELETE /routes/{id}`, `GET /routes/{id}/history`, `GET /routes/{id}/options`, `PATCH /routes/{id}/threshold`
- Auto-generated interactive docs at `http://localhost:4314/docs`
- CORS restricted to `localhost:4142`

---

## Scheduling

**[APScheduler](https://apscheduler.readthedocs.io/) 3.x**

- In-process scheduler — no cron config, no separate daemon
- `BlockingScheduler` keeps the process alive
- Interval jobs with configurable hours
- Runs an immediate poll on startup before entering the schedule

---

## Charts

**[Recharts](https://recharts.org/)**

- React-native charting library — no canvas manipulation
- `LineChart` with `ReferenceLine` for the threshold marker
- Custom tooltip component for date + time + price display

---

## CLI

**[Click](https://click.palletsprojects.com/)**

- Declarative argument/option parsing
- Clean auto-generated help text
- Composable command groups

---

## Alerting

**Python `smtplib` + `email` (standard library)**

- No third-party dependency
- Works with any SMTP provider
- Credentials loaded from environment variables (`SMTP_SENDER`, `SMTP_PASSWORD`, `SMTP_RECIPIENT`)
- Gmail: use an [App Password](https://support.google.com/accounts/answer/185833), not your main password
- Only alerts on the first snapshot below threshold — not on every subsequent poll

---

## Configuration

**[TOML](https://toml.io/) via `tomllib` (stdlib, Python 3.11+)**

- Human-readable, safe to commit (no credentials)
- Routes defined as `[[routes]]` array of tables
- SMTP credentials kept separately in `.env`

---

## Secrets

**Environment variables via `.env`**

- `SMTP_SENDER`, `SMTP_PASSWORD`, `SMTP_RECIPIENT`
- Loaded by `start.sh` before any process starts (`source .env`)
- `.env` is gitignored; `.env.example` is committed as a template

---

## Full Dependency List

**Python (`requirements.txt`)**
```
fast-flights       # Google Flights scraping
apscheduler>=3.10  # background polling scheduler
click>=8.0         # CLI
fastapi>=0.111     # REST API for the React frontend
uvicorn>=0.30      # ASGI server for FastAPI
```

`sqlite3`, `smtplib`, `email`, `tomllib` — standard library, no install needed.

**JavaScript (`frontend/package.json`)**
```
react ^18             # UI framework
react-dom ^18         # DOM renderer
react-router-dom ^7   # multi-page routing (Dashboard + RoutePage)
recharts ^2           # price charts
vite ^5               # build tool + dev server
@vitejs/plugin-react  # Vite React plugin
```

---

## What Was Deliberately Not Used

| Skipped | Reason |
|---|---|
| Docker | Unnecessary complexity for a local-only tool |
| PostgreSQL / MySQL | SQLite is sufficient; no server needed |
| Celery / Redis | APScheduler covers scheduling without a broker |
| Streamlit | Replaced by React — better date inputs and layout control |
| Pandas | Raw SQL + JSON is enough; avoided a heavy dependency |
| Tailwind CSS | Plain CSS variables cover the styling needs without a build step |
| dotenv (Python) | `start.sh` sources `.env` directly before launching processes |
