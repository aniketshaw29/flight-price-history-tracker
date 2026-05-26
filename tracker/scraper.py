import logging
import re

from fast_flights import FlightData, Passengers, create_filter, get_flights

log = logging.getLogger(__name__)

_PRICE_RE = re.compile(r"[\d,]+")


def _parse_price(raw) -> float | None:
    if isinstance(raw, (int, float)):
        return float(raw)
    if isinstance(raw, str):
        digits = _PRICE_RE.search(raw.replace(",", ""))
        if digits:
            return float(digits.group().replace(",", ""))
    return None


def _parse_stops(raw) -> int:
    if isinstance(raw, int):
        return raw
    if isinstance(raw, str):
        low = raw.lower()
        if "nonstop" in low or low.strip() == "0":
            return 0
        m = re.search(r"\d+", raw)
        if m:
            return int(m.group())
    return 0


def _build_filter(route):
    origin    = route["origin"]
    dest      = route["destination"]
    depart    = route["depart_date"]
    ret       = route["return_date"]
    trip_type = route["trip_type"]

    flight_data = [FlightData(date=depart, from_airport=origin, to_airport=dest)]
    if trip_type == "round-trip" and ret:
        flight_data.append(FlightData(date=ret, from_airport=dest, to_airport=origin))

    return create_filter(
        flight_data=flight_data,
        trip=trip_type,
        passengers=Passengers(adults=1),
    )


def fetch_all(route) -> list[dict]:
    """
    Fetch all available flights for a route.
    Returns a list of flight dicts sorted by price, or [] on failure.
    """
    origin = route["origin"]
    dest   = route["destination"]
    depart = route["depart_date"]

    try:
        result = get_flights(_build_filter(route), currency="INR")
        flights = []
        for f in result.flights:
            price = _parse_price(f.price)
            if price is None:
                continue
            flights.append({
                "airline":   getattr(f, "name",      None),
                "departure": getattr(f, "departure", None),
                "arrival":   getattr(f, "arrival",   None),
                "duration":  getattr(f, "duration",  None),
                "stops":     _parse_stops(getattr(f, "stops", 0)),
                "price":     price,
            })
        flights.sort(key=lambda x: x["price"])
        return flights

    except Exception as exc:
        log.warning("Scrape failed for %s→%s on %s: %s", origin, dest, depart, exc)
        return []


def fetch_price(route) -> float | None:
    """Cheapest price — convenience wrapper around fetch_all."""
    flights = fetch_all(route)
    if not flights:
        return None
    return min(f["price"] for f in flights)
