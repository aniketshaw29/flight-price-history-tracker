import './SearchBar.css'

const TRIP_TYPES = ['one-way', 'round-trip']

export default function SearchBar({
  origin, setOrigin,
  dest, setDest,
  tripType, setTripType,
  departDate, setDepartDate,
  historyFrom, setHistoryFrom,
  historyTo, setHistoryTo,
}) {
  const toUpper = (setter) => (e) => setter(e.target.value.toUpperCase().slice(0, 3))

  return (
    <div className="searchbar">
      <div className="searchbar-row">
        <Field label="🛫 From">
          <input
            type="text"
            value={origin}
            onChange={toUpper(setOrigin)}
            placeholder="CCU"
            maxLength={3}
            className="airport-input"
          />
        </Field>

        <div className="arrow">→</div>

        <Field label="🛬 To">
          <input
            type="text"
            value={dest}
            onChange={toUpper(setDest)}
            placeholder="BLR"
            maxLength={3}
            className="airport-input"
          />
        </Field>

        <Field label="🔄 Trip type">
          <select value={tripType} onChange={e => setTripType(e.target.value)}>
            {TRIP_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>

        <Field label="📅 Departure date">
          <input
            type="date"
            value={departDate}
            onChange={e => setDepartDate(e.target.value)}
          />
        </Field>
      </div>

      <div className="searchbar-row searchbar-dates">
        <Field label="History from">
          <input
            type="date"
            value={historyFrom}
            onChange={e => setHistoryFrom(e.target.value)}
          />
        </Field>

        <Field label="History to">
          <input
            type="date"
            value={historyTo}
            onChange={e => setHistoryTo(e.target.value)}
          />
        </Field>

        {(historyFrom || historyTo) && (
          <button
            className="clear-btn"
            onClick={() => { setHistoryFrom(''); setHistoryTo('') }}
          >
            Clear dates
          </button>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  )
}
