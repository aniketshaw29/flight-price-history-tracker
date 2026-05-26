import './SearchBar.css'

export default function SearchBar({
  origins, origin, setOrigin,
  dests, dest, setDest,
  tripTypes, tripType, setTripType,
  departDate, setDepartDate,
  historyFrom, setHistoryFrom,
  historyTo, setHistoryTo,
}) {
  return (
    <div className="searchbar">
      <div className="searchbar-row">
        <Field label="🛫 From">
          <select value={origin} onChange={e => setOrigin(e.target.value)}>
            {origins.map(o => <option key={o}>{o}</option>)}
          </select>
        </Field>

        <Field label="🛬 To">
          <select value={dest} onChange={e => setDest(e.target.value)}>
            {dests.map(d => <option key={d}>{d}</option>)}
          </select>
        </Field>

        <Field label="🔄 Trip type">
          <select value={tripType} onChange={e => setTripType(e.target.value)}>
            {tripTypes.map(t => <option key={t}>{t}</option>)}
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
