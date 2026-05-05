import { getUpcomingLoops } from '@/lib/upcomingLoops'
import { appUrl } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

const ACCENT = '#d4a333'
const ACCENT_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const SURFACE = '#15151a'
const BORDER = 'rgba(255,255,255,0.08)'

// Compact, embeddable ticket widget. Designed for an iframe on Squarespace.
// Lists upcoming Loops, each with a Book button that opens the booking page
// in a new tab so the host site doesn't navigate away.
export default async function WidgetTicketsPage() {
  let loops = []
  try {
    loops = await getUpcomingLoops({ limit: 6 })
  } catch (err) {
    console.error('[/widget/tickets] render threw', err)
  }

  const base = appUrl()

  return (
    <main
      style={{
        background: '#0a0a0b',
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${BORDER}`,
        maxWidth: 560,
        margin: '0 auto',
      }}
    >
      <header style={{ padding: '4px 4px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: ACCENT, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 800 }}>
          Jville Brew Loop
        </span>
        <span style={{ color: INK_DIM, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          Upcoming
        </span>
      </header>

      {loops.length === 0 ? (
        <div style={{ padding: 16, color: INK_DIM, fontSize: 13, textAlign: 'center' }}>
          No Loops on sale right now. Check back soon.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {loops.map(l => <LoopRow key={l.id} loop={l} base={base} />)}
        </div>
      )}

      <div style={{ padding: '10px 4px 2px', textAlign: 'center', color: INK_DIM, fontSize: 10, letterSpacing: '0.08em' }}>
        Secure checkout · Stripe
      </div>
    </main>
  )
}

function LoopRow({ loop, base }) {
  const date = formatDate(loop.eventDate)
  const time = formatTime(loop.pickupTime)
  const price = loop.fromPriceCents != null ? `$${(loop.fromPriceCents / 100).toFixed(0)}` : ''
  const href = `${base}/book/${loop.id}?utm_source=embed`

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
        textDecoration: 'none',
        color: INK,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ color: ACCENT, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>
          {date}{time ? ` · ${time} pickup` : ''}
        </div>
        <div style={{ color: INK, fontSize: 15, fontWeight: 700, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loop.name || 'Brew Loop'}
        </div>
        {price && (
          <div style={{ color: INK_DIM, fontSize: 12, marginTop: 2 }}>
            From <span style={{ color: ACCENT_HI, fontWeight: 700 }}>{price}</span>
          </div>
        )}
      </div>
      <span
        style={{
          background: ACCENT,
          color: '#0a0a0b',
          padding: '8px 14px',
          borderRadius: 8,
          fontWeight: 800,
          fontSize: 13,
          letterSpacing: '0.02em',
          flex: '0 0 auto',
        }}
      >
        Book
      </span>
    </a>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch { return iso }
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = String(hhmm).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}
