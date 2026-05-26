import sqlite3
from pathlib import Path

import altair as alt
import pandas as pd
import streamlit as st

DB_PATH = Path("data/flights.db")

st.set_page_config(page_title="Flight Price Tracker", layout="wide")
st.title("Flight Price History Tracker")
st.caption("CCU ↔ BLR · local · never hosted")

if not DB_PATH.exists():
    st.warning("No data yet — run `python cli.py run-tracker` to start collecting prices.")
    st.stop()

conn = sqlite3.connect(DB_PATH)
conn.row_factory = sqlite3.Row

routes = conn.execute("SELECT * FROM routes WHERE active=1 ORDER BY id").fetchall()
if not routes:
    st.info("No routes being tracked. Add one with `python cli.py add-route`.")
    conn.close()
    st.stop()

route_labels = {
    f"[{r['id']}] {r['origin']} → {r['destination']}  |  {r['trip_type']}  |  {r['depart_date']}": r["id"]
    for r in routes
}
selected_label = st.selectbox("Route", list(route_labels.keys()))
route_id = route_labels[selected_label]
route = next(r for r in routes if r["id"] == route_id)

snapshots = conn.execute(
    "SELECT price, fetched_at FROM price_snapshots WHERE route_id=? ORDER BY fetched_at",
    (route_id,),
).fetchall()
conn.close()

if not snapshots:
    st.info("No price data yet for this route. Run a poll first.")
    st.stop()

df = pd.DataFrame([{"Price (₹)": s["price"], "Time": s["fetched_at"]} for s in snapshots])
df["Time"] = pd.to_datetime(df["Time"])

current = df["Price (₹)"].iloc[-1]
lowest = df["Price (₹)"].min()
highest = df["Price (₹)"].max()
threshold = route["threshold"]
delta = current - df["Price (₹)"].iloc[-2] if len(df) > 1 else 0

col1, col2, col3, col4 = st.columns(4)
col1.metric("Current Price", f"₹{current:,.0f}", delta=f"₹{delta:,.0f}" if delta else None)
col2.metric("Lowest Ever", f"₹{lowest:,.0f}")
col3.metric("Highest Ever", f"₹{highest:,.0f}")
col4.metric("Your Threshold", f"₹{threshold:,.0f}")

st.divider()

price_line = (
    alt.Chart(df)
    .mark_line(point=True, color="#4C8EF5")
    .encode(
        x=alt.X("Time:T", title="Time"),
        y=alt.Y("Price (₹):Q", title="Price (INR)", scale=alt.Scale(zero=False)),
        tooltip=["Time:T", "Price (₹):Q"],
    )
)

threshold_df = pd.DataFrame({"threshold": [threshold]})
threshold_line = (
    alt.Chart(threshold_df)
    .mark_rule(color="red", strokeDash=[6, 3])
    .encode(y="threshold:Q")
)

st.altair_chart(
    (price_line + threshold_line).properties(height=420),
    use_container_width=True,
)

st.subheader("Price History")
st.dataframe(
    df.sort_values("Time", ascending=False).reset_index(drop=True),
    use_container_width=True,
)
