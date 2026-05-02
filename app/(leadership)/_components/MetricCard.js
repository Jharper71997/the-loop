// Server component. Renders one card on the leadership scoreboard.
//
// Status colors:
//   green  → on/above target
//   yellow → 70-100% of target
//   red    → below 70% of target
//   unknown → grey, no data yet (with explanation in `note`)

const STATUS_COLORS = {
  green:   { dot: '#3fb27f', glow: 'rgba(63,178,127,0.5)',  border: 'rgba(63,178,127,0.35)' },
  yellow:  { dot: '#d4a333', glow: 'rgba(212,163,51,0.55)', border: 'rgba(212,163,51,0.4)' },
  red:     { dot: '#c44a3a', glow: 'rgba(196,74,58,0.55)',  border: 'rgba(196,74,58,0.4)' },
  unknown: { dot: '#6f6f76', glow: 'rgba(111,111,118,0.4)', border: '#2a2a31' },
}

export default function MetricCard({ label, value, target, status = 'unknown', drillTo, note }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.unknown
  const wrapper = (
    <div style={{
      background: 'linear-gradient(180deg, #121216, #0d0d10)',
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: '14px 16px',
      minHeight: 130,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      cursor: drillTo ? 'pointer' : 'default',
      transition: 'border-color 0.15s, box-shadow 0.15s',
      position: 'relative',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <span style={{
          color: '#9c9ca3',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: colors.dot,
          boxShadow: `0 0 8px ${colors.glow}`,
        }} />
      </div>

      <div style={{
        color: status === 'unknown' ? '#6f6f76' : '#e8e8ea',
        fontFamily: "'Orbitron', system-ui, sans-serif",
        fontSize: 28,
        fontWeight: 800,
        letterSpacing: '0.04em',
        lineHeight: 1.1,
        marginTop: 'auto',
      }}>
        {value}
      </div>

      {target && (
        <div style={{
          color: '#6f6f76',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}>
          Target: {target}
        </div>
      )}

      {note && (
        <div style={{
          color: '#9c9ca3',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 9,
          fontStyle: 'italic',
          letterSpacing: '0.04em',
          marginTop: 4,
          lineHeight: 1.4,
        }}>
          {note}
        </div>
      )}
    </div>
  )

  if (drillTo) {
    return (
      <a
        href={drillTo}
        style={{
          textDecoration: 'none',
          display: 'block',
        }}
        className="metric-card-link"
      >
        {wrapper}
        <style>{`
          .metric-card-link:hover > div {
            border-color: rgba(212,163,51,0.6) !important;
            box-shadow: 0 0 24px rgba(212,163,51,0.15);
          }
        `}</style>
      </a>
    )
  }
  return wrapper
}
