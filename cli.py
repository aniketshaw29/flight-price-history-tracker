import logging
from pathlib import Path

import click

from tracker import db
from tracker import scheduler as sched

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


@click.group()
def cli():
    db.init_db()


@cli.command("add-route")
@click.option("--origin", required=True, help="IATA code, e.g. CCU")
@click.option("--dest", required=True, help="IATA code, e.g. BLR")
@click.option("--depart", required=True, help="Departure date YYYY-MM-DD")
@click.option("--return-date", default=None, help="Return date YYYY-MM-DD (round-trip only)")
@click.option(
    "--type", "trip_type",
    type=click.Choice(["one-way", "round-trip"]),
    required=True,
)
@click.option("--threshold", type=float, required=True, help="Alert if price drops below this (INR)")
def add_route(origin, dest, depart, return_date, trip_type, threshold):
    """Add a route to track."""
    if trip_type == "round-trip" and not return_date:
        raise click.UsageError("--return-date is required for round-trip routes.")
    route_id = db.upsert_route(
        origin.upper(), dest.upper(), depart, return_date, trip_type, threshold
    )
    click.echo(f"Route {route_id} added: {origin.upper()} → {dest.upper()} ({trip_type}) on {depart}")


@cli.command("list-routes")
def list_routes():
    """List all active routes."""
    routes = db.get_active_routes()
    if not routes:
        click.echo("No active routes. Use `add-route` to add one.")
        return
    click.echo(f"\n{'ID':<4} {'Route':<12} {'Type':<12} {'Depart':<12} {'Return':<12} {'Threshold':>12}")
    click.echo("─" * 68)
    for r in routes:
        ret = r["return_date"] or "—"
        click.echo(
            f"{r['id']:<4} {r['origin']}→{r['destination']:<6} "
            f"{r['trip_type']:<12} {r['depart_date']:<12} {ret:<12} ₹{r['threshold']:>10,.0f}"
        )


@cli.command("remove-route")
@click.argument("route_id", type=int)
def remove_route(route_id):
    """Stop tracking a route."""
    db.deactivate_route(route_id)
    click.echo(f"Route {route_id} deactivated.")


@cli.command("poll")
def poll():
    """Manually trigger a price check right now."""
    sched.poll()
    click.echo("Poll complete.")


@cli.command("history")
@click.argument("route_id", type=int)
def history(route_id):
    """Print full price history for a route."""
    route = db.get_route(route_id)
    if not route:
        click.echo(f"Route {route_id} not found.")
        return
    rows = db.get_history(route_id)
    if not rows:
        click.echo("No price data yet for this route.")
        return
    ret = f" → {route['return_date']}" if route["return_date"] else ""
    click.echo(f"\n{route['origin']} → {route['destination']}{ret}  ({route['trip_type']})")
    click.echo(f"{'Fetched At (UTC)':<32} {'Price (INR)':>12}")
    click.echo("─" * 46)
    for row in rows:
        click.echo(f"{row['fetched_at']:<32} ₹{row['price']:>10,.0f}")


@cli.command("run-tracker")
def run_tracker():
    """Start the background scheduler (runs until interrupted)."""
    sched.run()


if __name__ == "__main__":
    cli()
