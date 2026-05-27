import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import RouteFormModal from '../components/RouteFormModal'
import './Dashboard.css'

const fmt = n => n != null ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'

export default function Dashboard() {
  const [routes, setRoutes]         = useState([])
  const [error, setError]           = useState(null)
  const [showAdd, setShowAdd]       = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pinned, setPinned]         = useState(() => {
    try { return JSON.parse(localStorage.getItem('pinnedRoutes') || '[]') } catch { return [] }
  })
  const navigate = useNavigate()

  const fetchRoutes = useCallback(() => {
    fetch('/api/routes')
      .then(r => r.json())
      .then(setRoutes)
      .catch(() => setError('Cannot reach API — is the tracker running?'))
  }, [])

  useEffect(fetchRoutes, [fetchRoutes])

  function togglePin(id) {
    setPinned(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      localStorage.setItem('pinnedRoutes', JSON.stringify(next))
      return next
    })
  }

  function handleRefresh() {
    setRefreshing(true)
    fetch('/api/poll', { method: 'POST' }).catch(() => {})
    setTimeout(() => { fetchRoutes(); setRefreshing(false) }, 20000)
  }

  function handleDelete(e, id) {
    e.stopPropagation()
    if (!window.confirm('Remove this route from tracking?')) return
    fetch(`/api/routes/${id}`, { method: 'DELETE' })
      .then(() => {
        setRoutes(prev => prev.filter(r => r.id !== id))
        setPinned(prev => {
          const next = prev.filter(x => x !== id)
          localStorage.setItem('pinnedRoutes', JSON.stringify(next))
          return next
        })
      })
      .catch(() => setError('Failed to remove route.'))
  }

  const sorted = [...routes].sort((a, b) => {
    const ap = pinned.includes(a.id) ? 0 : 1
    const bp = pinned.includes(b.id) ? 0 : 1
    return ap - bp
  })

  return (
    <div className="dashboard">
      <header className="dash-header">
        <h1>✈️ Flight Price Tracker</h1>
        <span className="dash-sub">All tracked routes</span>
        <button className="btn-add-route" onClick={() => setShowAdd(true)}>＋ Add Route</button>
        <button className="btn-refresh" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? '⏳ Scraping…' : '↻ Refresh prices'}
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {!error && routes.length === 0 && (
        <div className="dash-empty">
          No routes tracked yet. Click <strong>＋ Add Route</strong> to get started.
        </div>
      )}

      <div className="route-list">
        {sorted.map(r => (
          <RouteRow
            key={r.id}
            route={r}
            pinned={pinned.includes(r.id)}
            onClick={() => navigate(`/route/${r.id}`)}
            onPin={() => togglePin(r.id)}
            onDelete={e => handleDelete(e, r.id)}
          />
        ))}
      </div>

      {showAdd && (
        <RouteFormModal
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); fetchRoutes() }}
        />
      )}
    </div>
  )
}

function RouteRow({ route, pinned, onClick, onPin, onDelete }) {
  const hasPrice = route.latest_price != null
  const below    = hasPrice && route.latest_price < route.threshold

  return (
    <div className={`route-row ${pinned ? 'route-row-pinned' : ''}`}
      onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>

      <button className="rr-pin" onClick={e => { e.stopPropagation(); onPin() }}
        title={pinned ? 'Unpin' : 'Pin'} type="button">
        {pinned ? '📌' : '📍'}
      </button>

      <div className="rr-route">
        <span className="rr-airport">{route.origin}</span>
        <span className="rr-arrow">→</span>
        <span className="rr-airport">{route.destination}</span>
      </div>

      <div className="rr-meta">
        {route.trip_type} · departs {route.depart_date}
      </div>

      <div className="rr-price-group">
        <span className="rr-price">{hasPrice ? fmt(route.latest_price) : '—'}</span>
        {hasPrice && (
          <span className={`rr-status ${below ? 'rr-below' : 'rr-above'}`}>
            {below ? '↓ below threshold' : '↑ above threshold'}
          </span>
        )}
        <span className="rr-threshold">alert at {fmt(route.threshold)}</span>
      </div>

      <div className="rr-cta">View →</div>

      <button className="rr-delete" onClick={onDelete} title="Remove route" type="button">✕</button>
    </div>
  )
}
