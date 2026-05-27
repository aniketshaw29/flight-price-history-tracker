import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from tracker import db, scheduler
from tracker.db import _connect, update_threshold

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("api")


@asynccontextmanager
async def lifespan(app):
    db.init_db()
    log.info("API started — triggering startup poll in background")
    threading.Thread(target=scheduler.poll, daemon=True, name="startup-poll").start()
    yield


_frontend_origin = f"http://localhost:{os.getenv('FRONTEND_PORT', '4142')}"

app = FastAPI(title="Flight Price Tracker API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[_frontend_origin],
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
def get_history(route_id: int):
    with _connect() as conn:
        rows = conn.execute(
            "SELECT price, fetched_at FROM price_snapshots WHERE route_id=? ORDER BY fetched_at",
            (route_id,),
        ).fetchall()
    return [dict(r) for r in rows]


@app.get("/routes/{route_id}/options")
def get_flight_options(route_id: int, nonstop: bool = Query(False)):
    rows = db.get_latest_flight_options(route_id, nonstop_only=nonstop)
    return [dict(r) for r in rows]


@app.post("/poll")
def trigger_poll(background_tasks: BackgroundTasks):
    log.info("Manual poll triggered via API")
    background_tasks.add_task(scheduler.poll)
    return {"ok": True}


@app.get("/routes/{route_id}/flights/history")
def flight_price_history(
    route_id: int,
    airline:   str = Query(...),
    departure: str = Query(...),
    arrival:   str = Query(...),
):
    rows = db.get_flight_history(route_id, airline, departure, arrival)
    return [dict(r) for r in rows]


@app.get("/routes/{route_id}/watched")
def get_watched(route_id: int):
    rows = db.get_watched_flights(route_id)
    return [dict(r) for r in rows]


class WatchBody(BaseModel):
    airline:   str
    departure: str
    arrival:   str
    duration:  str | None = None
    stops:     int | None = None


@app.post("/routes/{route_id}/watched", status_code=201)
def watch_flight(route_id: int, body: WatchBody):
    watched_id = db.add_watched_flight(
        route_id, body.airline, body.departure, body.arrival, body.duration
    )
    return {"id": watched_id, "route_id": route_id, **body.model_dump()}


@app.delete("/watched/{watched_id}", status_code=204)
def unwatch_flight(watched_id: int):
    db.remove_watched_flight(watched_id)


class ThresholdUpdate(BaseModel):
    threshold: float


@app.patch("/routes/{route_id}/threshold")
def patch_threshold(route_id: int, body: ThresholdUpdate):
    update_threshold(route_id, body.threshold)
    return {"ok": True}
