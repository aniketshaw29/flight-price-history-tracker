import './MetricsRow.css'

const fmt = n => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const fmtDelta = n => (n >= 0 ? '+' : '') + fmt(n)

export default function MetricsRow({ history, threshold }) {
  if (!history.length) return null

  const prices  = history.map(h => h.price)
  const current = prices.at(-1)
  const prev    = prices.length > 1 ? prices.at(-2) : null
  const delta   = prev !== null ? current - prev : null
  const lowest  = Math.min(...prices)
  const highest = Math.max(...prices)
  const below   = current < threshold

  return (
    <div className="metrics">
      <Metric
        label="Current Price"
        value={fmt(current)}
        sub={delta !== null ? fmtDelta(delta) : null}
        subColor={delta < 0 ? 'green' : delta > 0 ? 'red' : 'muted'}
      />
      <Metric label="Previous" value={prev !== null ? fmt(prev) : '—'} />
      <Metric label="Lowest Ever"  value={fmt(lowest)}  highlight={current === lowest} />
      <Metric label="Highest Ever" value={fmt(highest)} />
      <Metric
        label="vs Threshold"
        value={fmt(threshold)}
        sub={below ? 'Below ✓' : 'Above'}
        subColor={below ? 'green' : 'red'}
      />
    </div>
  )
}

function Metric({ label, value, sub, subColor = 'muted', highlight }) {
  return (
    <div className={`metric-card${highlight ? ' metric-highlight' : ''}`}>
      <span className="metric-label">{label}</span>
      <span className="metric-value">{value}</span>
      {sub && <span className={`metric-sub metric-${subColor}`}>{sub}</span>}
    </div>
  )
}
