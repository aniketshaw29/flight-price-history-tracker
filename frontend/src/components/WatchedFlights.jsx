import { useState, useEffect } from 'react'
import FlightHistoryModal from './FlightHistoryModal'
import './WatchedFlights.css'

const fmt = n => n != null ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'

export default function WatchedFlights({ routeId, threshold, refreshKey, onWatchChange }) {
  const [watched, setWatched]   = useState([])
  const [selected, setSelected] = useState(null)

  function fetchWatched() {
    fetch(`/api/routes/${routeId}/watched`)
      .then(r => r.json())
      .then(setWatched)
      .catch(() => {})
  }

  useEffect(fetchWatched, [routeId, refreshKey])

  function handleWatchChange() {
    fetchWatched()
    onWatchChange?.()
  }

  if (watched.length === 0) return null

  return (
    <div className="watched-wrap">
      <h3 className="watched-title">★ Targeted Flights</h3>
      <div className="watched-list">
        {watched.map(w => (
          <div key={w.id} className="watched-card">
            <div className="wc-info">
              <span className="wc-airline">{w.airline}</span>
              <span className="wc-route">{w.departure} → {w.arrival}</span>
              {w.duration && <span className="wc-meta">{w.duration}</span>}
            </div>
            <div className="wc-actions">
              <button
                className="wc-btn-history"
                onClick={() => setSelected({ flight: w, watchedId: w.id })}
              >
                View history
              </button>
              <button
                className="wc-btn-remove"
                onClick={async () => {
                  await fetch(`/api/watched/${w.id}`, { method: 'DELETE' })
                  handleWatchChange()
                }}
                title="Remove from targets"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

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
