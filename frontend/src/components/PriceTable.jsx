import { useState } from 'react'
import './PriceTable.css'

const fmt = n => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

export default function PriceTable({ history }) {
  const [open, setOpen] = useState(false)

  const rows = [...history].reverse()

  return (
    <div className="table-card">
      <button className="table-toggle" onClick={() => setOpen(o => !o)}>
        {open ? '▲' : '▼'} Raw price history ({rows.length} records)
      </button>

      {open && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Time</th>
                <th>Price (INR)</th>
                <th>Change</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const prev  = rows[i + 1]
                const delta = prev ? row.price - prev.price : null
                const d     = new Date(row.fetched_at)
                return (
                  <tr key={row.fetched_at}>
                    <td className="muted">{rows.length - i}</td>
                    <td>{d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td>{d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="price-cell">{fmt(row.price)}</td>
                    <td className={delta === null ? '' : delta < 0 ? 'green' : delta > 0 ? 'red' : 'muted'}>
                      {delta === null ? '—' : (delta >= 0 ? '+' : '') + fmt(delta)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
