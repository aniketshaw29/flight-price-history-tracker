import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import RouteFormModal from '../components/RouteFormModal'
import './Dashboard.css'

const fmt = n => n != null ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'

export default function Dashboard() {
  const [routes, setRoutes]       = useState([])
  const [error, setError]         = useState(null)
  const [showAdd, setShowAdd]     = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const navigate = useNavigate()

  const fetchRoutes = useCallback(() => {
    fetch('/api/routes')
      .then(r => r.json())
      .then(setRoutes)
      .catch(() => setError('Cannot reach API — is the tracker running?'))
  }, [])

  useEffect(fetchRoutes, [fetchRoutes])

  function handleRefresh() {
    setRefreshing(true)
    fetch('/api/poll', { method: 'POST' })
      .catch(() => {})
    // scraping takes ~10–30s per route; re-fetch after 20s
    setTimeout(() => {
      fetchRoutes()
      setRefreshing(false)
    }, 20000)
  }

  function handleDelete(e, id) {
    e.stopPropagation()
    if (!window.confirm('Remove this route from tracking?')) return
    fetch(`/api/routes/${id}`, { method: 'DELETE' })
      .then(() => setRoutes(prev => prev.filter(r => r.id !== id)))
      .catch(() => setError('Failed to remove route.'))
  }

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

      <div className="route-grid">
        {routes.map(r => (
          <RouteCard
            key={r.id}
            route={r}
            onClick={() => navigate(`/route/${r.id}`)}
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

function RouteCard({ route, onClick, onDelete }) {
  const hasPrice = route.latest_price != null
  const below    = hasPrice && route.latest_price < route.threshold

  return (
    <div className="route-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <button className="rc-delete" onClick={onDelete} title="Remove route" type="button">✕</button>

      <div className="rc-route">
        <span className="rc-airport">{route.origin}</span>
        <span className="rc-arrow">→</span>
        <span className="rc-airport">{route.destination}</span>
      </div>

      <div className="rc-meta">
        {route.trip_type} · departs {route.depart_date}
      </div>

      <div className="rc-price">
        {hasPrice ? fmt(route.latest_price) : 'No data yet'}
      </div>

      {hasPrice && (
        <div className={`rc-status ${below ? 'rc-below' : 'rc-above'}`}>
          {below ? 'Below threshold ✓' : 'Above threshold'}
        </div>
      )}

      <div className="rc-threshold">
        Alert at {fmt(route.threshold)}
      </div>

      <div className="rc-cta">View history →</div>
    </div>
  )
}
