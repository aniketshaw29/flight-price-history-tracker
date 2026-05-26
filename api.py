from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

from tracker.db import _connect

app = FastAPI(title="Flight Price Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.get("/routes")
def list_routes():
    with _connect() as conn:
        rows = conn.execute("SELECT * FROM routes WHERE active=1 ORDER BY id").fetchall()
    return [dict(r) for r in rows]


@app.get("/routes/{route_id}/history")
def get_history(
    route_id: int,
    from_date: str = Query(None),
    to_date: str = Query(None),
):
    query = "SELECT price, fetched_at FROM price_snapshots WHERE route_id=?"
    params: list = [route_id]

    if from_date:
        query += " AND fetched_at >= ?"
        params.append(from_date)
    if to_date:
        query += " AND fetched_at <= ?"
        params.append(to_date + "T23:59:59")

    query += " ORDER BY fetched_at"

    with _connect() as conn:
        rows = conn.execute(query, params).fetchall()
    return [dict(r) for r in rows]
