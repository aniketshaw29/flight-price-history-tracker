import sqlite3
from datetime import date, timedelta
from pathlib import Path

import altair as alt
import pandas as pd
import streamlit as st

DB_PATH = Path("data/flights.db")

st.set_page_config(page_title="Flight Price Tracker", layout="wide", page_icon="✈️")

st.markdown("""
<style>
.block-container { padding-top: 1.5rem; padding-bottom: 1rem; }
div[data-testid="stSelectbox"] label { font-weight: 600; font-size: 0.8rem; color: #555; }
div[data-testid="stDateInput"] label { font-weight: 600; font-size: 0.8rem; color: #555; }
</style>
""", unsafe_allow_html=True)

# ── header ────────────────────────────────────────────────────────────────────
st.markdown("## ✈️ Flight Price Tracker")

if not DB_PATH.exists():
    st.warning("No data yet — run `./start.sh` to begin tracking.")
    st.stop()

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row
routes = conn.execute("SELECT * FROM routes WHERE active=1 ORDER BY id").fetchall()

if not routes:
    st.info("No routes tracked yet. Add routes in `config.toml` and restart the tracker.")
    conn.close()
    st.stop()

# ── search bar ────────────────────────────────────────────────────────────────
st.markdown("---")
c1, c2, c3, c4 = st.columns([2, 2, 2, 2])

all_origins = sorted(set(r["origin"] for r in routes))
all_dests   = sorted(set(r["destination"] for r in routes))

with c1:
    origin = st.selectbox("🛫  From", all_origins)

with c2:
    # only show destinations reachable from chosen origin
    valid_dests = sorted(set(r["destination"] for r in routes if r["origin"] == origin))
    dest = st.selectbox("🛬  To", valid_dests)

with c3:
    valid_types = sorted(set(
        r["trip_type"] for r in routes
        if r["origin"] == origin and r["destination"] == dest
    ))
    trip_type = st.selectbox("🔄  Trip type", valid_types)

with c4:
    valid_dates = sorted(set(
        r["depart_date"] for r in routes
        if r["origin"] == origin
        and r["destination"] == dest
        and r["trip_type"] == trip_type
    ))
    depart_date = st.selectbox("📅  Departure date", valid_dates)

st.markdown("---")

# ── resolve route ─────────────────────────────────────────────────────────────
route = next(
    (r for r in routes
     if r["origin"]      == origin
     and r["destination"] == dest
     and r["trip_type"]   == trip_type
     and r["depart_date"] == depart_date),
    None,
)

if route is None:
    st.info("No route matches this combination.")
    conn.close()
    st.stop()

# ── load snapshots ────────────────────────────────────────────────────────────
rows = conn.execute(
    "SELECT price, fetched_at FROM price_snapshots WHERE route_id=? ORDER BY fetched_at",
    (route["id"],),
).fetchall()
conn.close()

if not rows:
    st.info("No price data yet for this route — waiting for first poll.")
    st.stop()

df = pd.DataFrame([{"Price (₹)": r["price"], "Time": r["fetched_at"]} for r in rows])
df["Time"] = pd.to_datetime(df["Time"])

# ── history window filter ─────────────────────────────────────────────────────
today     = date.today()
min_date  = df["Time"].dt.date.min()

fw1, fw2, _ = st.columns([2, 2, 4])
with fw1:
    date_from = st.date_input("History from", value=min_date, min_value=min_date, max_value=today)
with fw2:
    date_to   = st.date_input("History to",   value=today,    min_value=min_date, max_value=today)

df_view = df[(df["Time"].dt.date >= date_from) & (df["Time"].dt.date <= date_to)]

# ── route title ───────────────────────────────────────────────────────────────
ret_str = f" → {route['return_date']}" if route["return_date"] else ""
st.markdown(f"### {origin} → {dest}{ret_str} &nbsp;&nbsp; <span style='font-size:0.9rem;color:#888'>{trip_type} · departs {depart_date}</span>", unsafe_allow_html=True)

# ── metrics ───────────────────────────────────────────────────────────────────
current   = df["Price (₹)"].iloc[-1]
prev      = df["Price (₹)"].iloc[-2] if len(df) > 1 else current
delta     = current - prev
lowest    = df["Price (₹)"].min()
highest   = df["Price (₹)"].max()
threshold = route["threshold"]
below     = current < threshold

m1, m2, m3, m4, m5 = st.columns(5)
m1.metric("Current Price",  f"₹{current:,.0f}",   delta=f"₹{delta:+,.0f}" if delta else None)
m2.metric("Lowest Ever",    f"₹{lowest:,.0f}")
m3.metric("Highest Ever",   f"₹{highest:,.0f}")
m4.metric("Alert Threshold",f"₹{threshold:,.0f}")
m5.metric("Status", "Below threshold ✓" if below else "Above threshold", delta_color="off")

st.markdown("")

# ── chart ─────────────────────────────────────────────────────────────────────
if df_view.empty:
    st.warning("No data in the selected history window — try widening the date range.")
else:
    line = (
        alt.Chart(df_view)
        .mark_line(point=alt.OverlayMarkDef(size=70, filled=True), strokeWidth=2.5, color="#2563EB")
        .encode(
            x=alt.X("Time:T", title="", axis=alt.Axis(format="%d %b %H:%M", labelAngle=-30)),
            y=alt.Y("Price (₹):Q", title="Price (INR)", scale=alt.Scale(zero=False)),
            tooltip=[
                alt.Tooltip("Time:T",      title="Time",  format="%d %b %Y %H:%M"),
                alt.Tooltip("Price (₹):Q", title="₹",     format=",.0f"),
            ],
        )
    )

    rule = (
        alt.Chart(pd.DataFrame({"y": [threshold]}))
        .mark_rule(color="#DC2626", strokeDash=[8, 4], strokeWidth=1.5)
        .encode(y="y:Q")
    )

    label = (
        alt.Chart(pd.DataFrame({"y": [threshold], "label": [f"Threshold ₹{threshold:,.0f}"]}))
        .mark_text(align="right", dy=-8, color="#DC2626", fontSize=11)
        .encode(
            y=alt.Y("y:Q"),
            x=alt.value("width"),
            text="label:N",
        )
    )

    st.altair_chart(
        (line + rule + label).properties(height=420),
        use_container_width=True,
    )

# ── raw table ─────────────────────────────────────────────────────────────────
with st.expander("Raw data"):
    st.dataframe(
        df_view.sort_values("Time", ascending=False).reset_index(drop=True),
        use_container_width=True,
    )
