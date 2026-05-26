import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "data" / "flights.db"


def init_db():
    DB_PATH.parent.mkdir(exist_ok=True)
    with _connect() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS routes (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                origin      TEXT NOT NULL,
                destination TEXT NOT NULL,
                depart_date TEXT NOT NULL,
                return_date TEXT,
                trip_type   TEXT NOT NULL,
                threshold   REAL NOT NULL,
                active      INTEGER DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS price_snapshots (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                route_id    INTEGER NOT NULL REFERENCES routes(id),
                price       REAL NOT NULL,
                fetched_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS flight_options (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                route_id    INTEGER NOT NULL REFERENCES routes(id),
                fetched_at  TEXT NOT NULL,
                airline     TEXT,
                departure   TEXT,
                arrival     TEXT,
                duration    TEXT,
                stops       INTEGER NOT NULL DEFAULT 0,
                price       REAL NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_snapshots_route
                ON price_snapshots(route_id, fetched_at);

            CREATE INDEX IF NOT EXISTS idx_options_route
                ON flight_options(route_id, fetched_at);
        """)


@contextmanager
def _connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def upsert_route(origin, destination, depart_date, return_date, trip_type, threshold):
    with _connect() as conn:
        existing = conn.execute(
            """SELECT id FROM routes
               WHERE origin=? AND destination=? AND depart_date=? AND trip_type=?""",
            (origin, destination, depart_date, trip_type),
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE routes SET threshold=?, active=1, return_date=? WHERE id=?",
                (threshold, return_date, existing["id"]),
            )
            return existing["id"]
        cursor = conn.execute(
            """INSERT INTO routes
               (origin, destination, depart_date, return_date, trip_type, threshold)
               VALUES (?,?,?,?,?,?)""",
            (origin, destination, depart_date, return_date, trip_type, threshold),
        )
        return cursor.lastrowid


def get_active_routes():
    with _connect() as conn:
        return conn.execute("SELECT * FROM routes WHERE active=1").fetchall()


def get_active_routes_with_latest():
    """Routes joined with their latest price snapshot."""
    with _connect() as conn:
        return conn.execute("""
            SELECT r.*,
                   ps.price      AS latest_price,
                   ps.fetched_at AS latest_fetched_at
            FROM routes r
            LEFT JOIN (
                SELECT route_id, price, fetched_at
                FROM price_snapshots
                WHERE id IN (
                    SELECT MAX(id) FROM price_snapshots GROUP BY route_id
                )
            ) ps ON r.id = ps.route_id
            WHERE r.active = 1
            ORDER BY r.id
        """).fetchall()


def get_route(route_id):
    with _connect() as conn:
        return conn.execute("SELECT * FROM routes WHERE id=?", (route_id,)).fetchone()


def deactivate_route(route_id):
    with _connect() as conn:
        conn.execute("UPDATE routes SET active=0 WHERE id=?", (route_id,))


def update_threshold(route_id, threshold):
    with _connect() as conn:
        conn.execute("UPDATE routes SET threshold=? WHERE id=?", (threshold, route_id))


def set_route(route_id, origin, destination, depart_date, return_date, trip_type, threshold):
    with _connect() as conn:
        conn.execute(
            """UPDATE routes
               SET origin=?, destination=?, depart_date=?, return_date=?,
                   trip_type=?, threshold=?, active=1
               WHERE id=?""",
            (origin, destination, depart_date, return_date, trip_type, threshold, route_id),
        )


def insert_snapshot(route_id, price, fetched_at=None):
    if fetched_at is None:
        fetched_at = datetime.now(timezone.utc).isoformat()
    with _connect() as conn:
        conn.execute(
            "INSERT INTO price_snapshots (route_id, price, fetched_at) VALUES (?,?,?)",
            (route_id, price, fetched_at),
        )


def insert_flight_options(route_id, flights, fetched_at):
    if not flights:
        return
    with _connect() as conn:
        conn.executemany(
            """INSERT INTO flight_options
               (route_id, fetched_at, airline, departure, arrival, duration, stops, price)
               VALUES (?,?,?,?,?,?,?,?)""",
            [
                (route_id, fetched_at,
                 f["airline"], f["departure"], f["arrival"],
                 f["duration"], f["stops"], f["price"])
                for f in flights
            ],
        )


def get_latest_flight_options(route_id, nonstop_only=False):
    with _connect() as conn:
        row = conn.execute(
            "SELECT MAX(fetched_at) AS lat FROM flight_options WHERE route_id=?",
            (route_id,),
        ).fetchone()
        if not row or not row["lat"]:
            return []
        query = "SELECT * FROM flight_options WHERE route_id=? AND fetched_at=?"
        params: list = [route_id, row["lat"]]
        if nonstop_only:
            query += " AND stops=0"
        query += " ORDER BY price ASC"
        return conn.execute(query, params).fetchall()


def get_history(route_id):
    with _connect() as conn:
        return conn.execute(
            "SELECT price, fetched_at FROM price_snapshots WHERE route_id=? ORDER BY fetched_at",
            (route_id,),
        ).fetchall()


def get_latest_two(route_id):
    with _connect() as conn:
        return conn.execute(
            """SELECT price FROM price_snapshots
               WHERE route_id=? ORDER BY fetched_at DESC LIMIT 2""",
            (route_id,),
        ).fetchall()
