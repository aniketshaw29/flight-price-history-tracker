import { useState } from 'react'
import './RouteFormModal.css'

export default function RouteFormModal({ initial, onClose, onSaved }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    origin:      initial?.origin      ?? '',
    destination: initial?.destination ?? '',
    trip_type:   initial?.trip_type   ?? 'one-way',
    depart_date: initial?.depart_date ?? '',
    return_date: initial?.return_date ?? '',
    threshold:   initial?.threshold   ?? 4000,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  const set     = key => e => setForm(f => ({ ...f, [key]: e.target.value }))
  const toUpper = key => e => setForm(f => ({ ...f, [key]: e.target.value.toUpperCase().slice(0, 3) }))

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const body = {
        origin:      form.origin,
        destination: form.destination,
        trip_type:   form.trip_type,
        depart_date: form.depart_date,
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
      const saved = await res.json()
      onSaved(saved)
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
            <label className="modal-label">
              Departure date
              <input type="date" value={form.depart_date} onChange={set('depart_date')} required />
            </label>
            {form.trip_type === 'round-trip' && (
              <label className="modal-label">
                Return date
                <input type="date" value={form.return_date} onChange={set('return_date')} />
              </label>
            )}
          </div>

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
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add route'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
