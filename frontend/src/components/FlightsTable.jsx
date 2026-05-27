import { useState, useEffect } from 'react'
import FlightHistoryModal from './FlightHistoryModal'
import './FlightsTable.css'

const fmt = n => n != null ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'

export default function FlightsTable({ routeId, threshold, refreshKey, onWatchChange }) {
  const [flights, setFlights]     = useState([])
  const [watched, setWatched]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)
  const [selected, setSelected]   = useState(null)

  useEffect(() => {
    if (!routeId) return
    setLoading(true)
    setError(null)
    fetch(`/api/routes/${routeId}/options`)
      .then(r => r.json())
      .then(data => {
        setFlights(data)
        if (data.length > 0) setFetchedAt(data[0].fetched_at)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load flights.'); setLoading(false) })
  }, [routeId])

  useEffect(() => {
    if (!routeId) return
    fetch(`/api/routes/${routeId}/watched`)
      .then(r => r.json())
      .then(setWatched)
      .catch(() => {})
  }, [routeId, refreshKey])

  function watchedIdFor(flight) {
    const w = watched.find(w =>
      w.airline    === flight.airline &&
      w.departure  === flight.departure &&
      w.arrival    === flight.arrival
    )
    return w?.id ?? null
  }

  function handleWatchChange() {
    fetch(`/api/routes/${routeId}/watched`).then(r => r.json()).then(setWatched)
    onWatchChange?.()
  }

  const fmtTime = iso => {
    if (!iso) return '—'
    const d = new Date(iso)
    return isNaN(d) ? iso : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  }

  return (
    <div className="flights-table-wrap">
      <div className="ft-header">
        <h3 className="ft-title">Available Flights</h3>
        <div className="ft-controls">
          {fetchedAt && <span className="ft-timestamp">as of {fmtTime(fetchedAt)}</span>}
        </div>
      </div>

      {error && <div className="ft-error">{error}</div>}

      {loading ? (
        <div className="ft-empty">Loading flights…</div>
      ) : flights.length === 0 ? (
        <div className="ft-empty">No flight data for the latest poll yet.</div>
      ) : (
        <div className="ft-scroll">
          <table className="ft-table">
            <thead>
              <tr>
                <th></th>
                <th>Airline</th>
                <th>Departure</th>
                <th>Arrival</th>
                <th>Duration</th>
                <th className="ft-price-col">Price</th>
              </tr>
            </thead>
            <tbody>
              {flights.map((f, i) => {
                const wid = watchedIdFor(f)
                return (
                  <tr
                    key={i}
                    className={`ft-row ${i === 0 ? 'ft-cheapest' : ''} ${wid ? 'ft-watched' : ''}`}
                    onClick={() => setSelected({ flight: f, watchedId: wid })}
                    title="Click to view price history"
                  >
                    <td className="ft-watch-col">
                      {wid && <span className="ft-saved-dot" title="Saved">★</span>}
                    </td>
                    <td className="ft-airline">{f.airline || '—'}</td>
                    <td>{f.departure || '—'}</td>
                    <td>{f.arrival || '—'}</td>
                    <td className="ft-duration">{f.duration || '—'}</td>
                    <td className="ft-price-col">
                      <span className="ft-price">{fmt(f.price)}</span>
                      {i === 0 && <span className="ft-badge">Cheapest</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <FlightHistoryModal
          flight={selected.flight}
          routeId={routeId}
          threshold={threshold}
          watchedId={selected.watchedId}
          onClose={() => setSelected(null)}
          onWatchChange={handleWatchChange}
        />
      )}
    </div>
  )
}
