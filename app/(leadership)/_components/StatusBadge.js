// Server component. One badge style, reused everywhere status/type pills are
// drawn (sponsors, bars, drivers, income types, attribution kinds, automations).
//
// Use a named tone, or pass explicit bg/fg for a page's custom color map:
//   <StatusBadge label="paid" tone="green" />
//   <StatusBadge label={s.status} bg={sc.bg} fg={sc.fg} />

export const TONES = {
  green:  { bg: 'rgba(63,178,127,0.15)',  fg: '#0f7a4e' },
  gold:   { bg: 'rgba(212,163,51,0.15)',  fg: '#8a5f0a' },
  red:    { bg: 'rgba(196,74,58,0.12)',   fg: '#b3311f' },
  grey:   { bg: 'rgba(111,111,118,0.15)', fg: '#3b322a' },
  blue:   { bg: 'rgba(90,141,232,0.15)',  fg: '#2457b8' },
  purple: { bg: 'rgba(99,91,255,0.15)',   fg: '#4b3fd1' },
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
