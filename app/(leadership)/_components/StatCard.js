import { MONO } from './tableStyles'

const FONT_BODY = '-apple-system, "Segoe UI", Roboto, sans-serif'

const VALUE_COLORS = {
  ink:  '#e8e8ea',
  ok:   '#3fb27f',
  err:  '#c44a3a',
  dim:  '#9c9ca3',
  gold: '#d4a333',
}

// Server component. Lighter sibling of MetricCard (no status dot / target /
// drill link) for the simple "label + big number + hint" tiles that were
// re-handwritten across income, expenses, attribution, automations.
export default function StatCard({ label, value, hint, tone = 'ink', mono = true, children }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, #121216, #0d0d10)',
      border: '1px solid #2a2a31',
      borderRadius: 8,
      padding: '14px 16px',
    }}>
      <div style={{
        color: '#9c9ca3',
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{
        color: VALUE_COLORS[tone] || VALUE_COLORS.ink,
        fontFamily: mono ? MONO : FONT_BODY,
        fontSize: 24,
        fontWeight: 800,
        letterSpacing: mono ? '0.04em' : '-0.01em',
        lineHeight: 1.15,
      }}>
        {value}
      </div>
      {hint && (
        <div style={{ color: '#9c9ca3', fontSize: 11, marginTop: 6, fontFamily: FONT_BODY }}>
          {hint}
        </div>
      )}
      {children}
    </div>
  )
}
