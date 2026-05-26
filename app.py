import sqlite3
from pathlib import Path
from datetime import date, timedelta

import altair as alt
import pandas as pd
import streamlit as st

DB_PATH = Path("data/flights.db")

st.set_page_config(page_title="Flight Price Tracker", layout="wide", page_icon="✈️")

# ── css tweaks ────────────────────────────────────────────────────────────────
st.markdown("""
<style>
[data-testid="stSidebar"] { min-width: 280px; max-width: 280px; }
.metric-card { background: #f8f9fb; border-radius: 10px; padding: 16px 20px; }
.block-container { padding-top: 2rem; }
</style>
""", unsafe_allow_html=True)

# ── guard: no db yet ──────────────────────────────────────────────────────────
if not DB_PATH.exists():
    st.warning("No data yet — run `./start.sh` to start the tracker.")
    st.stop()

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
routes = conn.execute("SELECT * FROM routes WHERE active=1 ORDER BY id").fetchall()

if not routes:
    st.info("No routes tracked yet. Add one via `config.toml` and restart the tracker.")
    conn.close()
    st.stop()

# ── sidebar: filters ──────────────────────────────────────────────────────────
with st.sidebar:
    st.title("✈️ Flight Tracker")
    st.divider()

    origins      = sorted(set(r["origin"]      for r in routes))
    destinations = sorted(set(r["destination"] for r in routes))

    origin = st.selectbox("From", origins)
    dest   = st.selectbox("To",   destinations)

    trip_types     = sorted(set(r["trip_type"] for r in routes
                                if r["origin"] == origin and r["destination"] == dest))
    trip_type      = st.selectbox("Trip type", trip_types) if trip_types else None

    depart_dates   = sorted(set(r["depart_date"] for r in routes
                                if r["origin"] == origin
                                and r["destination"] == dest
                                and r["trip_type"] == trip_type))
    depart_date    = st.selectbox("Departure date", depart_dates) if depart_dates else None

    st.divider()
    st.caption("History window")
    today     = date.today()
    date_from = st.date_input("From", value=today - timedelta(days=30), max_value=today)
    date_to   = st.date_input("To",   value=today,                      max_value=today)

# ── resolve selected route ────────────────────────────────────────────────────
route = next(
    (r for r in routes
     if r["origin"]      == origin
     and r["destination"] == dest
     and r["trip_type"]   == trip_type
     and r["depart_date"] == depart_date),
    None,
)

if route is None:
    st.info("No route matches your selection. Adjust the filters in the sidebar.")
    conn.close()
    st.stop()

# ── fetch snapshots ───────────────────────────────────────────────────────────
snapshots = conn.execute(
    "SELECT price, fetched_at FROM price_snapshots WHERE route_id=? ORDER BY fetched_at",
    (route["id"],),
).fetchall()
conn.close()

if not snapshots:
    st.info("No price data yet for this route — the tracker hasn't polled it yet.")
    st.stop()

df = pd.DataFrame([{"Price (₹)": s["price"], "Time": s["fetched_at"]} for s in snapshots])
df["Time"] = pd.to_datetime(df["Time"])

# apply date window filter
df_filtered = df[
    (df["Time"].dt.date >= date_from) &
    (df["Time"].dt.date <= date_to)
]

# ── header ────────────────────────────────────────────────────────────────────
ret_str = f" → {route['return_date']}" if route["return_date"] else ""
st.markdown(f"## {origin} → {dest}{ret_str}")
st.caption(f"{trip_type}  ·  departs {depart_date}  ·  threshold ₹{route['threshold']:,.0f}")
st.divider()

# ── metrics ───────────────────────────────────────────────────────────────────
current  = df["Price (₹)"].iloc[-1]
lowest   = df["Price (₹)"].min()
highest  = df["Price (₹)"].max()
delta    = current - df["Price (₹)"].iloc[-2] if len(df) > 1 else None
below    = current < route["threshold"]

c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("Current Price",  f"₹{current:,.0f}",  delta=f"₹{delta:,.0f}"  if delta is not None else None)
c2.metric("Lowest Ever",    f"₹{lowest:,.0f}")
c3.metric("Highest Ever",   f"₹{highest:,.0f}")
c4.metric("Your Threshold", f"₹{route['threshold']:,.0f}")
c5.metric("vs Threshold",   "BELOW ✓" if below else "ABOVE", delta_color="off")

st.divider()

# ── chart ─────────────────────────────────────────────────────────────────────
if df_filtered.empty:
    st.info("No data in the selected date window. Widen the range in the sidebar.")
else:
    price_line = (
        alt.Chart(df_filtered)
        .mark_line(point=alt.OverlayMarkDef(size=60), color="#4C8EF5", strokeWidth=2)
        .encode(
            x=alt.X("Time:T", title="Date / Time", axis=alt.Axis(format="%b %d %H:%M")),
            y=alt.Y(
                "Price (₹):Q",
                title="Price (INR)",
                scale=alt.Scale(zero=False),
            ),
            tooltip=[
                alt.Tooltip("Time:T", title="Time",       format="%b %d %Y %H:%M"),
                alt.Tooltip("Price (₹):Q", title="Price", format=",.0f"),
            ],
        )
    )

    threshold_line = (
        alt.Chart(pd.DataFrame({"t": [route["threshold"]]}))
        .mark_rule(color="#e05252", strokeDash=[6, 3], strokeWidth=1.5)
        .encode(y=alt.Y("t:Q", title=""))
    )

    st.altair_chart(
        (price_line + threshold_line).properties(height=400),
        use_container_width=True,
    )

# ── raw data table ────────────────────────────────────────────────────────────
with st.expander("Raw price history", expanded=False):
    st.dataframe(
        df_filtered
        .sort_values("Time", ascending=False)
        .reset_index(drop=True),
        use_container_width=True,
    )
