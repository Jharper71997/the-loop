// Server component. Renders one card on the leadership scoreboard.
//
// Status colors: green = on/above target, yellow = 70-100%, red = below 70%,
// unknown = grey + "no data" copy in note.

const STATUS_COLORS = {
  green:   { dot: '#3fb27f', glow: 'rgba(63,178,127,0.35)',  border: 'rgba(63,178,127,0.25)' },
  yellow:  { dot: '#d4a333', glow: 'rgba(212,163,51,0.35)',  border: 'rgba(212,163,51,0.3)'  },
  red:     { dot: '#c44a3a', glow: 'rgba(196,74,58,0.35)',   border: 'rgba(196,74,58,0.3)'   },
  unknown: { dot: '#6f6f76', glow: 'rgba(111,111,118,0.25)', border: '#2a2a31' },
}

export default function MetricCard({ label, value, target, status = 'unknown', drillTo, note }) {
  const colors = STATUS_COLORS[status] || STATUS_COLORS.unknown
  const wrapper = (
    <div style={{
      background: '#121216',
      border: `1px solid ${colors.border}`,
      borderRadius: 8,
      padding: '14px 16px',
      minHeight: 130,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      cursor: drillTo ? 'pointer' : 'default',
      transition: 'border-color 0.12s, transform 0.12s',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <span style={{
          color: '#9c9ca3',
          fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          {label}
        </span>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: colors.dot,
          boxShadow: `0 0 6px ${colors.glow}`,
        }} />
      </div>

      <div style={{
        color: status === 'unknown' ? '#6f6f76' : '#e8e8ea',
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
        fontSize: 26,
        fontWeight: 600,
        letterSpacing: '-0.02em',
        lineHeight: 1.1,
        marginTop: 'auto',
      }}>
        {value}
      </div>

      {target && (
        <div style={{
          color: '#9c9ca3',
          fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: 11,
          fontWeight: 500,
        }}>
          Target: {target}
        </div>
      )}

      {note && (
        <div style={{
          color: '#9c9ca3',
          fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: 11,
          marginTop: 2,
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
            border-color: rgba(212,163,51,0.55) !important;
            transform: translateY(-1px);
          }
        `}</style>
      </a>
    )
  }
  return wrapper
}
