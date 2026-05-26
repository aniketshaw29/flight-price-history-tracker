import { useState, useEffect, useMemo } from 'react'
import SearchBar from './components/SearchBar'
import MetricsRow from './components/MetricsRow'
import PriceChart from './components/PriceChart'
import PriceTable from './components/PriceTable'
import './App.css'

export default function App() {
  const [routes, setRoutes] = useState([])
  const [origin, setOrigin] = useState('')
  const [dest, setDest] = useState('')
  const [tripType, setTripType] = useState('')
  const [departDate, setDepartDate] = useState('')
  const [historyFrom, setHistoryFrom] = useState('')
  const [historyTo, setHistoryTo] = useState('')
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // load routes on mount
  useEffect(() => {
    fetch('/api/routes')
      .then(r => r.json())
      .then(data => {
        setRoutes(data)
        if (data.length > 0) {
          setOrigin(data[0].origin)
          setDest(data[0].destination)
          setTripType(data[0].trip_type)
          setDepartDate(data[0].depart_date)
        }
      })
      .catch(() => setError('Cannot reach API — is the tracker running?'))
  }, [])

  // derived filter options
  const origins = useMemo(() => [...new Set(routes.map(r => r.origin))].sort(), [routes])

  const dests = useMemo(() =>
    [...new Set(routes.filter(r => r.origin === origin).map(r => r.destination))].sort(),
    [routes, origin])

  const tripTypes = useMemo(() =>
    [...new Set(routes.filter(r => r.origin === origin && r.destination === dest).map(r => r.trip_type))].sort(),
    [routes, origin, dest])

  // reset downstream when parent changes
  useEffect(() => {
    if (dests.length) setDest(prev => dests.includes(prev) ? prev : dests[0])
  }, [dests])

  useEffect(() => {
    if (tripTypes.length) setTripType(prev => tripTypes.includes(prev) ? prev : tripTypes[0])
  }, [tripTypes])

  // fetch history when route selection is complete
  const selectedRoute = useMemo(() =>
    routes.find(r =>
      r.origin === origin &&
      r.destination === dest &&
      r.trip_type === tripType &&
      r.depart_date === departDate
    ),
    [routes, origin, dest, tripType, departDate])

  useEffect(() => {
    if (!selectedRoute) return
    setLoading(true)
    setError(null)
    const params = new URLSearchParams()
    if (historyFrom) params.set('from_date', historyFrom)
    if (historyTo)   params.set('to_date', historyTo)
    fetch(`/api/routes/${selectedRoute.id}/history?${params}`)
      .then(r => r.json())
      .then(data => { setHistory(data); setLoading(false) })
      .catch(() => { setError('Failed to load history.'); setLoading(false) })
  }, [selectedRoute, historyFrom, historyTo])

  return (
    <div>
      <header className="app-header">
        <h1>✈️ Flight Price Tracker</h1>
        <span className="app-sub">CCU ↔ BLR · local · price history</span>
      </header>

      <SearchBar
        origins={origins}       origin={origin}       setOrigin={setOrigin}
        dests={dests}           dest={dest}           setDest={setDest}
        tripTypes={tripTypes}   tripType={tripType}   setTripType={setTripType}
        departDate={departDate} setDepartDate={setDepartDate}
        historyFrom={historyFrom} setHistoryFrom={setHistoryFrom}
        historyTo={historyTo}     setHistoryTo={setHistoryTo}
      />

      {error && <div className="error-banner">{error}</div>}

      {!error && departDate && !selectedRoute && (
        <div className="not-tracked">
          <strong>{origin} → {dest} ({tripType}) on {departDate}</strong> is not being tracked yet.
          <br />
          Add this to <code>config.toml</code> and restart the tracker:
          <pre>{`[[routes]]
origin      = "${origin}"
destination = "${dest}"
depart_date = "${departDate}"
trip_type   = "${tripType}"
threshold   = 4000`}</pre>
        </div>
      )}

      {selectedRoute && !error && (
        <>
          <div className="route-title">
            <strong>{origin} → {dest}</strong>
            {selectedRoute.return_date && <span> → {selectedRoute.return_date}</span>}
            <span className="route-meta">
              {tripType} · departs {departDate} · threshold ₹{selectedRoute.threshold.toLocaleString('en-IN')}
            </span>
          </div>

          {loading
            ? <div className="loading">Loading price history…</div>
            : history.length === 0
              ? <div className="empty">No price data for this route yet.</div>
              : <>
                  <MetricsRow history={history} threshold={selectedRoute.threshold} />
                  <PriceChart history={history} threshold={selectedRoute.threshold} />
                  <PriceTable history={history} />
                </>
          }
        </>
      )}
    </div>
  )
}
