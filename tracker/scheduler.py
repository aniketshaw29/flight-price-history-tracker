import logging
import tomllib
from pathlib import Path

from apscheduler.schedulers.blocking import BlockingScheduler

from . import alerts, db, scraper

log = logging.getLogger(__name__)
CONFIG_PATH = Path(__file__).parent.parent / "config.toml"


def load_config():
    with open(CONFIG_PATH, "rb") as f:
        return tomllib.load(f)


def _sync_routes(config):
    for r in config.get("routes", []):
        db.upsert_route(
            origin=r["origin"].upper(),
            destination=r["destination"].upper(),
            depart_date=r["depart_date"],
            return_date=r.get("return_date"),
            trip_type=r["trip_type"],
            threshold=r["threshold"],
        )


def poll(config=None):
    if config is None:
        config = load_config()

    routes = db.get_active_routes()
    log.info("Polling %d route(s)...", len(routes))

    for route in routes:
        label = f"{route['origin']}→{route['destination']} ({route['depart_date']})"
        try:
            from datetime import datetime, timezone
            fetched_at = datetime.now(timezone.utc).isoformat()

            flights = scraper.fetch_all(route)
            if not flights:
                log.warning("No flights returned for route %d %s", route["id"], label)
                continue

            price = min(f["price"] for f in flights)
            db.insert_snapshot(route["id"], price, fetched_at)
            db.insert_flight_options(route["id"], flights, fetched_at)
            log.info("Route %d %s: ₹%s (%d options)",
                     route["id"], label, f"{price:,.0f}", len(flights))

            prev_two = db.get_latest_two(route["id"])
            # prev_two[0] is the snapshot just inserted; [1] is the one before
            if (
                len(prev_two) >= 2
                and price < route["threshold"]
                and prev_two[1]["price"] >= route["threshold"]
            ):
                try:
                    alerts.send_alert(config, dict(route), price, prev_two[1]["price"])
                except Exception as exc:
                    log.error("Alert failed for route %d: %s", route["id"], exc)

        except Exception:
            log.exception("Unexpected error polling route %d %s", route["id"], label)


def run():
    config = load_config()
    interval_hours = config.get("tracker", {}).get("poll_interval_hours", 6)

    db.init_db()
    _sync_routes(config)

    log.info("Tracker started — polling every %dh", interval_hours)
    poll(config)  # immediate first run

    scheduler = BlockingScheduler()
    scheduler.add_job(poll, "interval", hours=interval_hours, args=[config])
    scheduler.start()
