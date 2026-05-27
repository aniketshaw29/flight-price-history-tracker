import logging
from datetime import datetime, timezone

from apscheduler.schedulers.blocking import BlockingScheduler

from . import alerts, db, scraper

log = logging.getLogger(__name__)

POLL_INTERVAL_HOURS = 6


def poll():
    routes = db.get_active_routes()
    log.info("Polling %d route(s)...", len(routes))

    for route in routes:
        label = f"{route['origin']}→{route['destination']} ({route['depart_date']})"
        try:
            fetched_at = datetime.now(timezone.utc).isoformat()

            flights = scraper.fetch_all(route)
            if not flights:
                log.warning("No flights returned for route %d %s", route["id"], label)
                continue

            price = min(f["price"] for f in flights)
            db.insert_snapshot(route["id"], price, fetched_at)
            db.insert_flight_options(route["id"], flights, fetched_at)
            log.info("Route %d %s: ₹%s (%d nonstop options)",
                     route["id"], label, f"{price:,.0f}", len(flights))

            prev_two = db.get_latest_two(route["id"])
            if (
                len(prev_two) >= 2
                and price < route["threshold"]
                and prev_two[1]["price"] >= route["threshold"]
            ):
                try:
                    alerts.send_alert(dict(route), price, prev_two[1]["price"])
                except Exception as exc:
                    log.error("Alert failed for route %d: %s", route["id"], exc)

        except Exception:
            log.exception("Unexpected error polling route %d %s", route["id"], label)


def run():
    db.init_db()

    log.info("Tracker started — polling every %dh", POLL_INTERVAL_HOURS)
    poll()  # immediate first run

    scheduler = BlockingScheduler()
    scheduler.add_job(poll, "interval", hours=POLL_INTERVAL_HOURS)
    scheduler.start()
