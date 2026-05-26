from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from tracker import db
from tracker.db import _connect, update_threshold

app = FastAPI(title="Flight Price Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4142"],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)


@app.get("/routes")
def list_routes():
    rows = db.get_active_routes_with_latest()
    return [dict(r) for r in rows]


class RouteBody(BaseModel):
    origin: str
    destination: str
    trip_type: str
    depart_date: str
    return_date: str | None = None
    threshold: float


@app.post("/routes", status_code=201)
def create_route(body: RouteBody):
    route_id = db.upsert_route(
        body.origin.upper(),
        body.destination.upper(),
        body.depart_date,
        body.return_date,
        body.trip_type,
        body.threshold,
    )
    return dict(db.get_route(route_id))


@app.patch("/routes/{route_id}")
def update_route(route_id: int, body: RouteBody):
    route = db.get_route(route_id)
    if not route:
        raise HTTPException(status_code=404, detail="Route not found")
    db.set_route(
        route_id,
        body.origin.upper(),
        body.destination.upper(),
        body.depart_date,
        body.return_date,
        body.trip_type,
        body.threshold,
    )
    return dict(db.get_route(route_id))


@app.delete("/routes/{route_id}", status_code=204)
def delete_route(route_id: int):
    db.deactivate_route(route_id)


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


@app.get("/routes/{route_id}/options")
def get_flight_options(route_id: int, nonstop: bool = Query(False)):
    rows = db.get_latest_flight_options(route_id, nonstop_only=nonstop)
    return [dict(r) for r in rows]


class ThresholdUpdate(BaseModel):
    threshold: float


@app.patch("/routes/{route_id}/threshold")
def patch_threshold(route_id: int, body: ThresholdUpdate):
    update_threshold(route_id, body.threshold)
    return {"ok": True}
