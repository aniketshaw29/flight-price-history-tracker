import { useState, useEffect } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'
import './FlightHistoryModal.css'

const fmt = n => n != null ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'

function fmtTs(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function FlightHistoryModal({ flight, routeId, threshold, watchedId: initialWatchedId, onClose, onWatchChange }) {
  const [history, setHistory]     = useState([])
  const [watchedId, setWatchedId] = useState(initialWatchedId ?? null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)

  useEffect(() => {
    if (!flight?.airline || !flight?.departure || !flight?.arrival) return
    const p = new URLSearchParams({
      airline:   flight.airline   ?? '',
      departure: flight.departure ?? '',
      arrival:   flight.arrival   ?? '',
    })
    fetch(`/api/routes/${routeId}/flights/history?${p}`)
      .then(r => r.json())
      .then(data => { setHistory(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [routeId, flight])

  async function handleSave() {
    setSaving(true)
    const res = await fetch(`/api/routes/${routeId}/watched`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        airline:   flight.airline,
        departure: flight.departure,
        arrival:   flight.arrival,
        duration:  flight.duration,
        stops:     flight.stops,
      }),
    })
    const data = await res.json()
    setWatchedId(data.id)
    setSaving(false)
    onWatchChange?.()
  }

  async function handleUnwatch() {
    setSaving(true)
    await fetch(`/api/watched/${watchedId}`, { method: 'DELETE' })
    setWatchedId(null)
    setSaving(false)
    onWatchChange?.()
  }

  const chartData = history.map(h => ({
    label: fmtTs(h.fetched_at),
    price: h.price,
  }))

  const latestPrice  = history.length ? history[history.length - 1].price : null
  const prevPrice    = history.length >= 2 ? history[history.length - 2].price : null
  const priceDelta   = latestPrice != null && prevPrice != null ? latestPrice - prevPrice : null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="fhm-box" onClick={e => e.stopPropagation()}>

        <div className="fhm-header">
          <div className="fhm-flight-info">
            <span className="fhm-airline">{flight.airline}</span>
            <span className="fhm-route">
              {flight.departure} → {flight.arrival}
            </span>
            <span className="fhm-meta">
              {flight.duration}
              {flight.stops === 0
                ? ' · Nonstop'
                : flight.stops != null ? ` · ${flight.stops} stop` : ''}
            </span>
          </div>
          <div className="fhm-actions">
            {watchedId
              ? <button className="btn-unwatch" onClick={handleUnwatch} disabled={saving}>
                  {saving ? '…' : '★ Saved — Remove'}
                </button>
              : <button className="btn-watch" onClick={handleSave} disabled={saving}>
                  {saving ? '…' : '☆ Save flight'}
                </button>
            }
            <button className="modal-close" onClick={onClose} type="button">✕</button>
          </div>
        </div>

        {latestPrice != null && (
          <div className="fhm-current">
            <span className="fhm-price">{fmt(latestPrice)}</span>
            {priceDelta !== null && priceDelta !== 0 && (
              <span className={priceDelta < 0 ? 'fhm-down' : 'fhm-up'}>
                {priceDelta < 0 ? '↓' : '↑'} {fmt(Math.abs(priceDelta))} from last poll
              </span>
            )}
          </div>
        )}

        {loading ? (
          <div className="fhm-empty">Loading history…</div>
        ) : history.length === 0 ? (
          <div className="fhm-empty">No history yet — this flight will be tracked from the next poll.</div>
        ) : history.length === 1 ? (
          <div className="fhm-empty">Only one data point so far. More polls needed for a trend.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis
                tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
                domain={['auto', 'auto']}
              />
              <Tooltip formatter={v => [fmt(v), 'Price']} />
              {threshold && (
                <ReferenceLine y={threshold} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Alert', fontSize: 10, fill: '#ef4444' }} />
              )}
              <Line type="monotone" dataKey="price" stroke="#2563eb" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {history.length > 0 && (
          <div className="fhm-table-wrap">
            <table className="fhm-table">
              <thead>
                <tr><th>Polled at</th><th>Price</th><th>Change</th></tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h, i, arr) => {
                  const prev  = arr[i + 1]
                  const delta = prev != null ? h.price - prev.price : null
                  return (
                    <tr key={h.fetched_at}>
                      <td>{fmtTs(h.fetched_at)}</td>
                      <td><strong>{fmt(h.price)}</strong></td>
                      <td>
                        {delta !== null && (
                          <span className={delta < 0 ? 'fhm-down' : delta > 0 ? 'fhm-up' : ''}>
                            {delta < 0 ? '↓' : delta > 0 ? '↑' : '—'}
                            {delta !== 0 ? ' ' + fmt(Math.abs(delta)) : ''}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
