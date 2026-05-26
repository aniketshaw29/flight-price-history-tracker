import { useState, useEffect } from 'react'
import './FlightsTable.css'

const fmt = n => n != null ? `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'

export default function FlightsTable({ routeId }) {
  const [flights, setFlights]     = useState([])
  const [nonstop, setNonstop]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)

  useEffect(() => {
    if (!routeId) return
    setLoading(true)
    setError(null)
    fetch(`/api/routes/${routeId}/options?nonstop=${nonstop}`)
      .then(r => r.json())
      .then(data => {
        setFlights(data)
        if (data.length > 0) setFetchedAt(data[0].fetched_at)
        setLoading(false)
      })
      .catch(() => { setError('Failed to load flights.'); setLoading(false) })
  }, [routeId, nonstop])

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
          {fetchedAt && (
            <span className="ft-timestamp">as of {fmtTime(fetchedAt)}</span>
          )}
          <label className="ft-toggle">
            <input
              type="checkbox"
              checked={nonstop}
              onChange={e => setNonstop(e.target.checked)}
            />
            Nonstop only
          </label>
        </div>
      </div>

      {error && <div className="ft-error">{error}</div>}

      {loading ? (
        <div className="ft-empty">Loading flights…</div>
      ) : flights.length === 0 ? (
        <div className="ft-empty">
          {nonstop ? 'No nonstop flights found for the latest poll.' : 'No flight data for the latest poll yet.'}
        </div>
      ) : (
        <div className="ft-scroll">
          <table className="ft-table">
            <thead>
              <tr>
                <th>Airline</th>
                <th>Departure</th>
                <th>Arrival</th>
                <th>Duration</th>
                <th>Stops</th>
                <th className="ft-price-col">Price</th>
              </tr>
            </thead>
            <tbody>
              {flights.map((f, i) => (
                <tr key={i} className={i === 0 ? 'ft-cheapest' : ''}>
                  <td className="ft-airline">{f.airline || '—'}</td>
                  <td>{f.departure || '—'}</td>
                  <td>{f.arrival || '—'}</td>
                  <td className="ft-duration">{f.duration || '—'}</td>
                  <td className="ft-stops">
                    {f.stops === 0
                      ? <span className="ft-nonstop">Nonstop</span>
                      : `${f.stops} stop${f.stops > 1 ? 's' : ''}`}
                  </td>
                  <td className="ft-price-col">
                    <span className="ft-price">{fmt(f.price)}</span>
                    {i === 0 && <span className="ft-badge">Cheapest</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
