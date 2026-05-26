# Tech Stack

## Language

**Python 3.11+**

- Rich scraping and scheduling ecosystem
- Streamlit requires no frontend knowledge
- SQLite support is in the standard library
- Fast iteration for a local tool

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
- Queryable with any SQLite GUI (e.g. DB Browser for SQLite)
- More than sufficient for years of price snapshots from a handful of routes

---

## Scheduling

**[APScheduler](https://apscheduler.readthedocs.io/) 3.x**

- In-process scheduler — no cron config, no separate daemon
- `BlockingScheduler` keeps the process alive in the terminal
- Interval jobs with configurable hours
- Survives missed runs on wakeup (misfire grace time configurable)

Alternative: plain `time.sleep` loop — simpler but no misfire handling and harder to extend.

---

## Dashboard

**[Streamlit](https://streamlit.io/)**

- Pure Python — no HTML/CSS/JS
- Runs on `localhost` only
- Built-in line charts via Altair/Plotly
- Live reload on file save
- Runs as a separate process from the scheduler

---

## CLI

**[Click](https://click.palletsprojects.com/)**

- Declarative argument/option parsing
- Clean help text auto-generated
- Composable command groups (`cli.py add-route`, `cli.py run-tracker`, etc.)

---

## Alerting

**Python `smtplib` + `email` (standard library)**

- No third-party dependency for sending
- Works with any SMTP provider
- Gmail recommended: use an [App Password](https://support.google.com/accounts/answer/185833) (not your main password)
- Config in `config.toml`: host, port, sender, password, recipient

---

## Configuration

**[TOML](https://toml.io/) via Python `tomllib` (stdlib, 3.11+)**

- Human-readable config file
- Supports arrays of tables for multiple routes
- No parsing library needed in Python 3.11+

---

## Full Dependency List

```
fast-flights       # Google Flights scraping
apscheduler>=3.10  # background polling scheduler
streamlit>=1.35    # local dashboard
click>=8.0         # CLI
```

SQLite, `smtplib`, `email`, `tomllib` — all standard library, no install needed.

---

## What Was Deliberately Not Used

| Skipped | Reason |
|---|---|
| Docker | Unnecessary complexity for a local tool |
| PostgreSQL / MySQL | SQLite is sufficient; no server needed |
| Celery / Redis | APScheduler covers scheduling without a broker |
| FastAPI / Flask | No HTTP server needed; Streamlit handles the UI |
| Pandas | Avoided to keep dependencies minimal; raw SQL is enough |
| dotenv | `config.toml` serves the same purpose more readably |
