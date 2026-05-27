import { useState } from 'react'
import './RouteFormModal.css'

function dateRange(from, to) {
  const dates = []
  const cur = new Date(from)
  const end = new Date(to)
  while (cur <= end) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export default function RouteFormModal({ initial, onClose, onSaved }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    origin:      initial?.origin      ?? '',
    destination: initial?.destination ?? '',
    trip_type:   initial?.trip_type   ?? 'one-way',
    depart_date: initial?.depart_date ?? '',
    depart_to:   '',
    return_date: initial?.return_date ?? '',
    threshold:   initial?.threshold   ?? 4000,
  })
  const [rangeMode, setRangeMode] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)

  const set     = key => e => setForm(f => ({ ...f, [key]: e.target.value }))
  const toUpper = key => e => setForm(f => ({ ...f, [key]: e.target.value.toUpperCase().slice(0, 3) }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const dates = rangeMode && form.depart_to
      ? dateRange(form.depart_date, form.depart_to)
      : [form.depart_date]

    if (dates.length === 0) {
      setError('Invalid date range.')
      setSaving(false)
      return
    }

    try {
      let last = null
      for (const date of dates) {
        const body = {
          origin:      form.origin,
          destination: form.destination,
          trip_type:   form.trip_type,
          depart_date: date,
          return_date: form.trip_type === 'round-trip' ? (form.return_date || null) : null,
          threshold:   Number(form.threshold),
        }
        const url    = isEdit ? `/api/routes/${initial.id}` : '/api/routes'
        const method = isEdit ? 'PATCH' : 'POST'
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error(`Server error ${res.status}`)
        last = await res.json()
      }
      onSaved(last, dates.length)
    } catch (err) {
      setError(err.message || 'Failed to save.')
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edit Route' : 'Add Route'}</h2>
          <button className="modal-close" onClick={onClose} type="button">✕</button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-row">
            <label className="modal-label">
              From
              <input
                type="text" value={form.origin} onChange={toUpper('origin')}
                placeholder="CCU" maxLength={3} required
                className="airport-input"
              />
            </label>
            <span className="modal-arrow">→</span>
            <label className="modal-label">
              To
              <input
                type="text" value={form.destination} onChange={toUpper('destination')}
                placeholder="BLR" maxLength={3} required
                className="airport-input"
              />
            </label>
          </div>

          <div className="modal-row">
            <label className="modal-label">
              Trip type
              <select value={form.trip_type} onChange={set('trip_type')}>
                <option value="one-way">One-way</option>
                <option value="round-trip">Round-trip</option>
              </select>
            </label>

            {!isEdit && (
              <label className="modal-label modal-range-toggle">
                <input
                  type="checkbox"
                  checked={rangeMode}
                  onChange={e => setRangeMode(e.target.checked)}
                />
                Date range
              </label>
            )}
          </div>

          <div className="modal-row">
            <label className="modal-label">
              {rangeMode ? 'From date' : 'Departure date'}
              <input type="date" value={form.depart_date} onChange={set('depart_date')} required />
            </label>
            {rangeMode && (
              <label className="modal-label">
                To date
                <input type="date" value={form.depart_to} onChange={set('depart_to')}
                  min={form.depart_date} required />
              </label>
            )}
            {form.trip_type === 'round-trip' && (
              <label className="modal-label">
                Return date
                <input type="date" value={form.return_date} onChange={set('return_date')} />
              </label>
            )}
          </div>

          {rangeMode && form.depart_date && form.depart_to && form.depart_to >= form.depart_date && (
            <div className="modal-range-info">
              {dateRange(form.depart_date, form.depart_to).length} routes will be created
            </div>
          )}

          <div className="modal-row">
            <label className="modal-label modal-threshold">
              Alert threshold (₹)
              <input
                type="number" value={form.threshold} onChange={set('threshold')}
                min={0} step={100} required
              />
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-save" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : rangeMode ? 'Add routes' : 'Add route'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
