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

## Dashboard

Open `http://localhost:8501` after running `./start.sh`.

**Sidebar filters:**
- **From / To** — pick origin and destination airport (e.g. CCU → BLR)
- **Trip type** — one-way or round-trip
- **Departure date** — which specific flight date to inspect
- **History window** — date range to zoom the chart into

**Main view:**
- 5 metrics: current price, lowest ever, highest ever, your threshold, and whether current price is above/below threshold
- Line chart with red dashed threshold line
- Collapsible raw data table

```bash
# 1. Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set email credentials
cp .env.example .env
# edit .env with your Gmail + App Password
source .env

# 4. Edit config.toml — update depart_date / return_date and thresholds

# 5. Start the tracker (polls in background)
python cli.py run-tracker

# 6. Open the dashboard in a second terminal
source .venv/bin/activate && source .env
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
