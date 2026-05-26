import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer, Label,
} from 'recharts'
import './PriceChart.css'

const fmt = n => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { fetched_at, price } = payload[0].payload
  const d = new Date(fetched_at)
  return (
    <div className="chart-tooltip">
      <div className="tooltip-date">
        {d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        {' '}
        {d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
      </div>
      <div className="tooltip-price">{fmt(price)}</div>
    </div>
  )
}

export default function PriceChart({ history, threshold }) {
  const data = history.map(h => ({
    ...h,
    ts: new Date(h.fetched_at).getTime(),
  }))

  const tickFormatter = ts =>
    new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })

  return (
    <div className="chart-card">
      <ResponsiveContainer width="100%" height={380}>
        <LineChart data={data} margin={{ top: 16, right: 32, bottom: 8, left: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={tickFormatter}
            tick={{ fontSize: 12, fill: '#64748b' }}
          />
          <YAxis
            tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`}
            tick={{ fontSize: 12, fill: '#64748b' }}
            width={56}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={threshold}
            stroke="#dc2626"
            strokeDasharray="8 4"
            strokeWidth={1.5}
          >
            <Label
              value={`Threshold ${fmt(threshold)}`}
              position="insideTopRight"
              fill="#dc2626"
              fontSize={11}
            />
          </ReferenceLine>
          <Line
            type="monotone"
            dataKey="price"
            stroke="#2563eb"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#2563eb', strokeWidth: 0 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
