import { formatCents } from '@/lib/leadershipScoreboard'
import { MONO } from './tableStyles'

// Shared outstanding-this-month banner for the sponsors + bars roster pages.
// `entityLabel` pluralizes the copy ("Sponsors" / "Bars").
export default function OutstandingBanner({ entityLabel, period, expected, paid, owed, countOwed }) {
  if (!expected) return null
  const pct = expected > 0 ? Math.round((paid / expected) * 100) : 0
  const color = owed === 0 ? '#0f7a4e' : '#8a5f0a'
  return (
    <div style={{
      background: 'linear-gradient(180deg, #ffffff, #fdfaf3)',
      border: `1px solid ${owed === 0 ? 'rgba(63,178,127,0.4)' : 'rgba(212,163,51,0.4)'}`,
      borderRadius: 8,
      padding: '14px 18px',
      marginBottom: 18,
      display: 'flex',
      flexWrap: 'wrap',
      gap: 24,
      alignItems: 'baseline',
    }}>
      <Cell label={`${period} · ${entityLabel} Outstanding`}>
        <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, color }}>{formatCents(owed)}</span>
      </Cell>
      <Cell label="Paid / Expected">
        <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700 }}>
          {formatCents(paid)} / {formatCents(expected)} <span style={{ color: '#6e6154', fontWeight: 400 }}>({pct}%)</span>
        </span>
      </Cell>
      {countOwed > 0 && (
        <Cell label={`${entityLabel} Behind`}>
          <span style={{ fontFamily: MONO, fontSize: 16, fontWeight: 700, color: '#8a5f0a' }}>{countOwed}</span>
        </Cell>
      )}
    </div>
  )
}

function Cell({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#6e6154', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 2 }}>
        {label}
      </div>
      {children}
    </div>
  )
}
