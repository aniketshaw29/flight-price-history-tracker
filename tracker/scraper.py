import logging
import re

from fast_flights import FlightData, Passengers, get_flights

log = logging.getLogger(__name__)

_PRICE_RE = re.compile(r"[\d,]+")


def _parse_price(raw) -> float | None:
    if isinstance(raw, (int, float)):
        return float(raw)
    if isinstance(raw, str):
        m = _PRICE_RE.search(raw.replace(",", ""))
        if m:
            return float(m.group().replace(",", ""))
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


def fetch_all(route) -> list[dict]:
    if not isinstance(route, dict):
        route = dict(route)

    origin    = route["origin"]
    dest      = route["destination"]
    depart    = route["depart_date"]
    ret       = route.get("return_date")
    trip_type = route["trip_type"]

    flight_data = [FlightData(date=depart, from_airport=origin, to_airport=dest)]
    if trip_type == "round-trip" and ret:
        flight_data.append(FlightData(date=ret, from_airport=dest, to_airport=origin))

    try:
        result = get_flights(
            flight_data=flight_data,
            trip=trip_type,
            passengers=Passengers(adults=1),
            seat="economy",
        )
        flights = []
        for f in result.flights:
            price = _parse_price(f.price)
            if price is None:
                continue
            stops = _parse_stops(getattr(f, "stops", 0))
            if stops != 0:
                continue
            flights.append({
                "airline":   getattr(f, "name",      None),
                "departure": getattr(f, "departure", None),
                "arrival":   getattr(f, "arrival",   None),
                "duration":  getattr(f, "duration",  None),
                "stops":     stops,
                "price":     price,
            })
        flights.sort(key=lambda x: x["price"])
        log.info("Fetched %d nonstop flights for %s→%s on %s", len(flights), origin, dest, depart)
        return flights

    except Exception as exc:
        log.warning("Scrape failed for %s→%s on %s: %s", origin, dest, depart, exc)
        return []


def fetch_price(route) -> float | None:
    flights = fetch_all(route)
    return min(f["price"] for f in flights) if flights else None
