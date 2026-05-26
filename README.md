# Flight Price History Tracker

A local-only tool that tracks flight prices over time, stores history in SQLite, and alerts you via email when prices drop below a threshold.

**Never hosted. Runs entirely on your machine.**

---

## Features

- Track one-way and round-trip routes
- Configurable polling interval (default: every 6 hours)
- Price history stored locally in SQLite
- Streamlit dashboard to visualize price trends
- Email alerts when price drops below your threshold
- CLI to manage routes, view history, and trigger manual polls

---

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure routes and email in config.toml

# 3. Add a route
python cli.py add-route --origin SFO --dest JFK --depart 2026-07-10 --return 2026-07-20 --type round-trip --threshold 400

# 4. Start the tracker (polls in background)
python cli.py run-tracker

# 5. Open the dashboard (separate terminal)
streamlit run app.py
```

---

## Project Structure

```
flight-price-history-tracker/
├── tracker/
│   ├── db.py           # SQLite schema and query helpers
│   ├── scraper.py      # Google Flights price fetching via fast-flights
│   ├── scheduler.py    # APScheduler polling loop
│   └── alerts.py       # Email alert logic
├── app.py              # Streamlit dashboard
├── cli.py              # CLI entrypoint (add-route, list, run, history)
├── config.toml         # Routes, alert thresholds, email settings, poll interval
├── requirements.txt
├── docs/
│   ├── ARCHITECTURE.md
│   └── TECH_STACK.md
└── data/
    └── flights.db      # SQLite database (auto-created)
```

---

## Configuration (`config.toml`)

```toml
[tracker]
poll_interval_hours = 6

[email]
smtp_host = "smtp.gmail.com"
smtp_port = 587
sender = "you@gmail.com"
password = "your-app-password"   # use a Gmail App Password, not your main password
recipient = "you@gmail.com"

[[routes]]
origin      = "SFO"
destination = "JFK"
depart_date = "2026-07-10"
return_date = "2026-07-20"     # omit for one-way
trip_type   = "round-trip"     # "round-trip" or "one-way"
threshold   = 400              # alert if price drops below this (USD)
```

---

## CLI Reference

| Command | Description |
|---|---|
| `python cli.py add-route` | Add a new route to track |
| `python cli.py list-routes` | Show all tracked routes |
| `python cli.py remove-route <id>` | Stop tracking a route |
| `python cli.py poll` | Manually trigger a price check now |
| `python cli.py history <id>` | Print price history for a route |
| `python cli.py run-tracker` | Start background scheduler |

---

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Tech Stack](docs/TECH_STACK.md)
