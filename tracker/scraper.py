import logging
import re

from fast_flights import FlightData, Passengers, create_filter, get_flights

log = logging.getLogger(__name__)

_PRICE_RE = re.compile(r"[\d,]+")


def _parse_price(raw) -> float | None:
    """Convert a price value like '₹3,500' or 3500 to a plain float."""
    if isinstance(raw, (int, float)):
        return float(raw)
    if isinstance(raw, str):
        digits = _PRICE_RE.search(raw.replace(",", ""))
        if digits:
            return float(digits.group().replace(",", ""))
    return None


def fetch_price(route) -> float | None:
    """
    Fetch the cheapest available price for a route dict / sqlite3.Row.
    Returns a float (INR) or None if the scrape fails.
    """
    origin = route["origin"]
    dest = route["destination"]
    depart = route["depart_date"]
    ret = route["return_date"]
    trip_type = route["trip_type"]

    try:
        flight_data = [FlightData(date=depart, from_airport=origin, to_airport=dest)]
        if trip_type == "round-trip" and ret:
            flight_data.append(FlightData(date=ret, from_airport=dest, to_airport=origin))

        f = create_filter(
            flight_data=flight_data,
            trip=trip_type,
            passengers=Passengers(adults=1),
        )
        result = get_flights(f, currency="INR")

        # Try result.current_price first (cheapest banner price), then first flight
        raw = getattr(result, "current_price", None)
        if raw is None and result.flights:
            raw = result.flights[0].price

        price = _parse_price(raw)
        if price is None:
            log.warning("Could not parse price '%s' for %s→%s", raw, origin, dest)
        return price

    except Exception as exc:
        log.warning("Scrape failed for %s→%s on %s: %s", origin, dest, depart, exc)
        return None
