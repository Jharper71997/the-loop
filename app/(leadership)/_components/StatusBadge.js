// Server component. One badge style, reused everywhere status/type pills are
// drawn (sponsors, bars, drivers, income types, attribution kinds, automations).
//
// Use a named tone, or pass explicit bg/fg for a page's custom color map:
//   <StatusBadge label="paid" tone="green" />
//   <StatusBadge label={s.status} bg={sc.bg} fg={sc.fg} />

export const TONES = {
  green:  { bg: 'rgba(63,178,127,0.15)',  fg: '#3fb27f' },
  gold:   { bg: 'rgba(212,163,51,0.15)',  fg: '#d4a333' },
  red:    { bg: 'rgba(196,74,58,0.12)',   fg: '#c44a3a' },
  grey:   { bg: 'rgba(111,111,118,0.15)', fg: '#c8c8cc' },
  blue:   { bg: 'rgba(90,141,232,0.15)',  fg: '#5a8de8' },
  purple: { bg: 'rgba(99,91,255,0.15)',   fg: '#8b85ff' },
}

export default function StatusBadge({ label, tone = 'grey', bg, fg, title, bordered = false }) {
  const t = TONES[tone] || TONES.grey
  const background = bg || t.bg
  const color = fg || t.fg
  return (
    <span
      title={title}
      style={{
        display: 'inline-block',
        background,
        color,
        border: bordered ? `1px solid ${color}59` : undefined,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}
