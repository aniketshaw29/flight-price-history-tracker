import { useState, useRef, useEffect } from 'react'
import './MetricsRow.css'

const fmt = n => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const fmtDelta = n => (n >= 0 ? '+' : '') + fmt(n)

export default function MetricsRow({ history, threshold, onSaveThreshold }) {
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
      <Metric label="Previous"     value={prev !== null ? fmt(prev) : '—'} />
      <Metric label="Lowest Ever"  value={fmt(lowest)}  highlight={current === lowest} />
      <Metric label="Highest Ever" value={fmt(highest)} />
      <ThresholdMetric
        threshold={threshold}
        below={below}
        onSave={onSaveThreshold}
      />
    </div>
  )
}

function ThresholdMetric({ threshold, below, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(String(threshold))
  const inputRef = useRef(null)

  useEffect(() => { setDraft(String(threshold)) }, [threshold])
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commit() {
    const val = Number(draft)
    if (!isNaN(val) && val > 0 && val !== threshold) onSave(val)
    setEditing(false)
  }

  function onKey(e) {
    if (e.key === 'Enter')  commit()
    if (e.key === 'Escape') { setDraft(String(threshold)); setEditing(false) }
  }

  return (
    <div
      className={`metric-card threshold-card${editing ? ' editing' : ''}`}
      title="Click to edit alert threshold"
      onClick={() => !editing && setEditing(true)}
    >
      <span className="metric-label">
        Alert Threshold <span className="edit-hint">{editing ? 'Enter to save · Esc to cancel' : '✎ click to edit'}</span>
      </span>

      {editing ? (
        <input
          ref={inputRef}
          className="threshold-input"
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={onKey}
        />
      ) : (
        <span className="metric-value">{fmt(threshold)}</span>
      )}

      <span className={`metric-sub metric-${below ? 'green' : 'red'}`}>
        {below ? 'Current is below ✓' : 'Current is above'}
      </span>
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
