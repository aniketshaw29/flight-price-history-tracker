import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import SearchBar      from '../components/SearchBar'
import MetricsRow     from '../components/MetricsRow'
import PriceChart     from '../components/PriceChart'
import PriceTable     from '../components/PriceTable'
import FlightsTable   from '../components/FlightsTable'
import WatchedFlights from '../components/WatchedFlights'
import RouteFormModal from '../components/RouteFormModal'
import './RoutePage.css'

export default function RoutePage() {
  const { id }   = useParams()
  const navigate = useNavigate()

  const [routes, setRoutes]         = useState([])
  const [origin, setOrigin]         = useState('')
  const [dest, setDest]             = useState('')
  const [tripType, setTripType]     = useState('one-way')
  const [departDate, setDepartDate] = useState('')
  const [history, setHistory]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [showEdit, setShowEdit] = useState(false)
  const [watchKey, setWatchKey] = useState(0)

  useEffect(() => {
    fetch('/api/routes')
      .then(r => r.json())
      .then(data => {
        setRoutes(data)
        const r = data.find(x => String(x.id) === String(id))
        if (r) {
          setOrigin(r.origin)
          setDest(r.destination)
          setTripType(r.trip_type)
          setDepartDate(r.depart_date)
        }
      })
      .catch(() => setError('Cannot reach API — is the tracker running?'))
  }, [id])

  const selectedRoute = useMemo(() =>
    routes.find(r =>
      r.origin      === origin &&
      r.destination === dest &&
      r.trip_type   === tripType &&
      r.depart_date === departDate
    ),
    [routes, origin, dest, tripType, departDate])

  useEffect(() => {
    if (!selectedRoute) { setHistory([]); return }
    setLoading(true)
    setError(null)
    fetch(`/api/routes/${selectedRoute.id}/history`)
      .then(r => r.json())
      .then(data => { setHistory(data); setLoading(false) })
      .catch(() => { setError('Failed to load history.'); setLoading(false) })
  }, [selectedRoute])

  function handleSaveThreshold(newThreshold) {
    if (!selectedRoute) return
    fetch(`/api/routes/${selectedRoute.id}/threshold`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threshold: newThreshold }),
    }).then(() =>
      setRoutes(prev => prev.map(r =>
        r.id === selectedRoute.id ? { ...r, threshold: newThreshold } : r
      ))
    )
  }

  function handleEditSaved(updated) {
    setRoutes(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r))
    setOrigin(updated.origin)
    setDest(updated.destination)
    setTripType(updated.trip_type)
    setDepartDate(updated.depart_date)
    setShowEdit(false)
  }

  const isReady = origin.length === 3 && dest.length === 3 && departDate

  return (
    <div className="route-page">
      <button className="back-btn" onClick={() => navigate('/')}>← All routes</button>

      <SearchBar
        origin={origin}         setOrigin={setOrigin}
        dest={dest}             setDest={setDest}
        tripType={tripType}     setTripType={setTripType}
        departDate={departDate} setDepartDate={setDepartDate}
      />

      {error && <div className="error-banner">{error}</div>}

      {isReady && !selectedRoute && !error && (
        <div className="not-tracked">
          <strong>{origin} → {dest} ({tripType}) on {departDate}</strong> is not being tracked yet.
          <br />Add this route from the dashboard.
        </div>
      )}

      {selectedRoute && !error && (
        <>
          <div className="route-title">
            <strong>{origin} → {dest}</strong>
            {selectedRoute.return_date && <span> → {selectedRoute.return_date}</span>}
            <span className="route-meta">{tripType} · departs {departDate}</span>
            <button className="edit-route-btn" onClick={() => setShowEdit(true)}>Edit route</button>
          </div>

          {loading
            ? <div className="loading">Loading…</div>
            : history.length === 0
              ? <div className="empty">No price data yet for this route.</div>
              : <>
                  <MetricsRow
                    history={history}
                    threshold={selectedRoute.threshold}
                    onSaveThreshold={handleSaveThreshold}
                  />
                  <PriceChart history={history} threshold={selectedRoute.threshold} />
                  <PriceTable history={history} />
                  <WatchedFlights
                    routeId={selectedRoute.id}
                    threshold={selectedRoute.threshold}
                    refreshKey={watchKey}
                    onWatchChange={() => setWatchKey(k => k + 1)}
                  />
                  <FlightsTable
                    routeId={selectedRoute.id}
                    threshold={selectedRoute.threshold}
                    refreshKey={watchKey}
                    onWatchChange={() => setWatchKey(k => k + 1)}
                  />
                </>
          }

          {showEdit && (
            <RouteFormModal
              initial={selectedRoute}
              onClose={() => setShowEdit(false)}
              onSaved={handleEditSaved}
            />
          )}
        </>
      )}
    </div>
  )
}
