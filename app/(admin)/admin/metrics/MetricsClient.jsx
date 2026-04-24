'use client'

import { useEffect, useState } from 'react'

export default function MetricsClient() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/metrics')
      .then(r => r.json())
      .then(j => { if (!cancelled) setData(j) })
      .catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [])

  if (error) return <main><h1>Metrics</h1><p className="muted">{error}</p></main>
  if (!data) return <main><h1>Metrics</h1><div className="scan-bar card">Loading telemetry…</div></main>

  const { summary, weekly, funnel, bars, compliance } = data

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h1>Metrics</h1>
        <span className="tag-status">Live telemetry</span>
      </div>

      {/* Top-row stat tiles */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 10,
        marginTop: 14,
      }}>
        <StatTile
          label="Riders this week"
          value={summary.riders_this_week}
          delta={summary.riders_wow_pct}
          foot={`last wk ${summary.riders_last_week}`}
        />
        <StatTile
          label="Net revenue this week"
          value={formatMoney(summary.net_this_week_cents)}
          delta={summary.revenue_wow_pct}
          foot={`gross ${formatMoney(summary.revenue_this_week_cents)}`}
        />
        <StatTile
          label="Forecast (next 7d)"
          value={summary.forecast_riders_next_7d}
          foot="paid party_size"
        />
        <StatTile
          label="Unsigned waivers"
          value={summary.unsigned_riders}
          foot="across all upcoming Loops"
          warn={summary.unsigned_riders > 0}
        />
      </div>

      {/* Ridership + revenue 8-week trend */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="hud-heading">Ridership & revenue · 8 weeks</div>
        <Sparkline
          points={weekly.map(w => ({ label: w.label, value: w.riders }))}
          color="#d4a333"
          height={90}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, marginTop: 10 }}>
          {weekly.map(w => (
            <div key={w.key} style={{ textAlign: 'center' }}>
              <div className="mono" style={{ fontSize: 14, color: '#d4a333', fontWeight: 600 }}>{w.riders}</div>
              <div className="tiny">{w.label}</div>
              <div className="tiny mono" style={{ color: '#6f6f76' }}>
                {w.revenue_cents ? `$${Math.round(w.revenue_cents / 100)}` : '—'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Conversion funnel */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="hud-heading">Conversion funnel · QR attribution</div>
        {funnel.by_source.length === 0 ? (
          <div className="muted">No QR scans in the last 30 days. Generate codes on the <a href="/admin/qr" style={{ color: '#d4a333' }}>QR tab</a>.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            <HeaderRow cells={['Source', 'Scans', 'Paid', 'Conv.']} />
            {funnel.by_source.map(r => (
              <FunnelRow
                key={r.source}
                source={r.source}
                scans={r.scans}
                conv={r.conversions}
                max={Math.max(...funnel.by_source.map(x => x.scans)) || 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bar performance */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="hud-heading">Bar performance · cumulative riders</div>
        {bars.length === 0 ? (
          <div className="muted">No bar-level data yet (needs rider-to-stop mapping on Loops).</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            <HeaderRow cells={['Bar', 'Riders (all time)', 'Last 2 weekends']} />
            {bars.map(b => (
              <div key={b.name} className="row" style={rowStyle}>
                <span>{b.name}</span>
                <span className="mono" style={{ color: '#d4a333' }}>{b.riders}</span>
                <span className="mono">{b.last_weekend_riders}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compliance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10, marginTop: 14 }}>
        <ComplianceTile
          title="Waiver compliance"
          pct={compliance.waiver_pct}
          top={`${compliance.waiver_signed} / ${compliance.waiver_total}`}
          foot="signed / upcoming riders"
        />
        <ComplianceTile
          title="Check-in rate"
          pct={compliance.checkin_pct}
          top={`${compliance.checkin_done} / ${compliance.checkin_total}`}
          foot="boarded / paid tickets"
        />
      </div>

      <div className="tiny" style={{ marginTop: 16, textAlign: 'center', color: '#55555c' }}>
        Telemetry refreshed at {new Date().toLocaleTimeString()}
      </div>
    </main>
  )
}

function StatTile({ label, value, delta, foot, warn }) {
  return (
    <div className="card card-compact">
      <div className="stat" style={warn ? { color: '#f0c24a' } : null}>{value ?? '—'}</div>
      <div className="stat-label">{label}</div>
      {delta != null && (
        <div className="tiny mono" style={{ color: delta >= 0 ? '#d4a333' : '#9c9ca3', marginTop: 4 }}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% wk/wk
        </div>
      )}
      {foot && <div className="tiny" style={{ marginTop: 4 }}>{foot}</div>}
    </div>
  )
}

function ComplianceTile({ title, pct, top, foot }) {
  const v = pct == null ? 0 : pct
  return (
    <div className="card">
      <div className="hud-heading">{title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div className="stat">{pct == null ? '—' : `${pct}%`}</div>
        <div className="mono" style={{ color: '#9c9ca3', fontSize: 13 }}>{top}</div>
      </div>
      <div style={{
        position: 'relative',
        height: 6,
        background: '#0e0e12',
        borderRadius: 3,
        border: '1px solid #1e1e23',
        marginTop: 8,
      }}>
        <div style={{
          position: 'absolute',
          left: 0, top: 0, bottom: 0,
          width: `${v}%`,
          background: 'linear-gradient(90deg, #8a6a22, #d4a333)',
          boxShadow: '0 0 12px rgba(212,163,51,0.45)',
          borderRadius: 3,
        }} />
      </div>
      <div className="tiny" style={{ marginTop: 6 }}>{foot}</div>
    </div>
  )
}

function Sparkline({ points, color, height = 80 }) {
  if (!points?.length) return null
  const w = 100
  const h = 100
  const max = Math.max(...points.map(p => p.value), 1)
  const step = w / Math.max(points.length - 1, 1)
  const coords = points.map((p, i) => [i * step, h - (p.value / max) * (h - 10) - 5])
  const d = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const areaD = `${d} L${w},${h} L0,${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={height} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#sparkFill)" />
      <path d={d} fill="none" stroke={color} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.4" fill={color} />
      ))}
    </svg>
  )
}

function HeaderRow({ cells }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `1.5fr repeat(${cells.length - 1}, 1fr)`,
      gap: 8,
      padding: '6px 10px',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 10,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      color: '#6f6f76',
    }}>
      {cells.map((c, i) => <span key={i} style={{ textAlign: i === 0 ? 'left' : 'right' }}>{c}</span>)}
    </div>
  )
}

function FunnelRow({ source, scans, conv, max }) {
  const pct = max ? (scans / max) * 100 : 0
  return (
    <div style={{ position: 'relative', ...rowStyle }}>
      <span style={{ zIndex: 1, position: 'relative' }}>{source}</span>
      <span className="mono" style={{ zIndex: 1, position: 'relative', color: '#d4a333' }}>{scans}</span>
      <span className="mono" style={{ zIndex: 1, position: 'relative' }}>{conv}</span>
      <span className="mono" style={{ zIndex: 1, position: 'relative' }}>
        {scans ? `${Math.round((conv / scans) * 100)}%` : '—'}
      </span>
      <div style={{
        position: 'absolute',
        inset: 0,
        width: `${pct}%`,
        background: 'linear-gradient(90deg, rgba(212,163,51,0.16), rgba(212,163,51,0.02))',
        borderRadius: 6,
        pointerEvents: 'none',
      }} />
    </div>
  )
}

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: '1.5fr 1fr 1fr 1fr',
  gap: 8,
  padding: '8px 10px',
  background: '#0e0e12',
  border: '1px solid #1e1e23',
  borderRadius: 6,
  fontSize: 13,
  alignItems: 'center',
}

function formatMoney(cents) {
  if (cents == null) return '—'
  const dollars = cents / 100
  if (Math.abs(dollars) >= 1000) return `$${(dollars / 1000).toFixed(1)}k`
  return `$${dollars.toFixed(0)}`
}
