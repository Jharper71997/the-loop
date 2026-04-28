import { getUpcomingLoops } from '@/lib/upcomingLoops'
import PlaceholderArt from './_components/PlaceholderArt'

export const metadata = {
  title: { absolute: 'Brew Loop' },
  description: 'Hop between partner bars every Friday and Saturday night in Jacksonville. Book a seat, track the shuttle live, and ride safe.',
  alternates: { canonical: '/' },
}
export const dynamic = 'force-dynamic'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const SURFACE = '#15151a'
const LINE = 'rgba(255,255,255,0.08)'

export default async function LandingPage() {
  const loops = await getUpcomingLoops({ limit: 4 })
  const next = loops[0] || null

  return (
    <main style={{ padding: '20px 16px 32px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'grid', gap: 14 }}>
        <header style={{ paddingTop: 8 }}>
          <div
            style={{
              color: GOLD,
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Jville Brew Loop
          </div>
          <h1 style={{
            color: INK,
            fontSize: 'clamp(26px, 7vw, 32px)',
            fontWeight: 800,
            margin: '6px 0 0',
            letterSpacing: '-0.01em',
          }}>
            Hop bars. Don&apos;t drive.
          </h1>
        </header>

        <NextLoopHero loop={next} />

        <ShortcutGrid />

        {loops.length > 1 && (
          <section style={{ marginTop: 8 }}>
            <h2 style={sectionHeader}>More loops</h2>
            <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
              {loops.slice(1).map(loop => <LoopRow key={`${loop.kind}-${loop.id}`} loop={loop} />)}
            </div>
          </section>
        )}

        <p style={{ color: INK_DIM, fontSize: 12, textAlign: 'center', margin: '10px 0 0' }}>
          $20 a seat · One ticket, all night · Fri &amp; Sat in Jacksonville.
        </p>
      </div>
    </main>
  )
}

function NextLoopHero({ loop }) {
  if (!loop) {
    return (
      <section style={emptyHero}>
        <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>
          No loops scheduled
        </div>
        <h2 style={{ color: INK, fontSize: 22, fontWeight: 700, margin: '6px 0 12px' }}>
          Check back soon.
        </h2>
        <a href="/events" style={ghostCta}>See full calendar →</a>
      </section>
    )
  }

  const isBookable = loop.kind === 'event'
  const href = isBookable ? `/book/${loop.id}` : '/events'

  return (
    <section
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 18,
        background: SURFACE,
        border: `1px solid ${LINE}`,
        minHeight: 220,
        boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: loop.coverImageUrl
            ? `linear-gradient(180deg, rgba(10,10,11,0.5), rgba(10,10,11,0.92)), url(${loop.coverImageUrl}) center/cover`
            : 'radial-gradient(120% 80% at 50% 0%, rgba(212,163,51,0.18), transparent 60%)',
        }}
      />
      {!loop.coverImageUrl && (
        <div style={{ position: 'absolute', inset: 0, opacity: 0.22 }}>
          <PlaceholderArt label="Brew Loop" />
        </div>
      )}

      <div style={{ position: 'relative', padding: '20px 20px 22px', display: 'grid', gap: 14 }}>
        <div>
          <div style={{
            color: GOLD,
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <span style={pulseDotStyle} />
            Next loop
          </div>
          <h2 style={{ color: INK, fontSize: 26, fontWeight: 800, margin: '6px 0 4px' }}>
            {formatDate(loop.eventDate)}
            {loop.pickupTime ? ` · ${formatTime(loop.pickupTime)}` : ''}
          </h2>
          <div style={{ color: INK_DIM, fontSize: 14 }}>
            {loop.name || 'Jville Brew Loop'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a href={href} style={primaryCta}>
            {isBookable ? 'Book a seat' : 'See details'}
          </a>
          {isBookable && loop.fromPriceCents != null && (
            <span style={{ color: GOLD_HI, fontSize: 13, fontWeight: 700 }}>
              from ${(loop.fromPriceCents / 100).toFixed(0)}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

function ShortcutGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <Shortcut href="/my-tickets" label="My tickets" sub="Find yours" />
      <Shortcut href="/track" label="Track shuttle" sub="Live map" accent />
      <Shortcut href="/bars" label="Partner bars" sub="The route" />
      <Shortcut href="/about" label="About" sub="The story" />
    </div>
  )
}

function Shortcut({ href, label, sub, accent }) {
  return (
    <a
      href={href}
      style={{
        padding: '14px 14px 16px',
        borderRadius: 14,
        background: accent ? 'rgba(212,163,51,0.08)' : SURFACE,
        border: `1px solid ${accent ? 'rgba(212,163,51,0.35)' : LINE}`,
        textDecoration: 'none',
        color: INK,
        display: 'block',
      }}
    >
      <div style={{ color: accent ? GOLD_HI : INK, fontWeight: 700, fontSize: 15 }}>{label}</div>
      <div style={{ color: INK_DIM, fontSize: 12, marginTop: 2 }}>{sub}</div>
    </a>
  )
}

function LoopRow({ loop }) {
  const isBookable = loop.kind === 'event'
  const href = isBookable ? `/book/${loop.id}` : '/events'
  return (
    <a
      href={href}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        padding: '12px 14px',
        borderRadius: 12,
        background: SURFACE,
        border: `1px solid ${LINE}`,
        textDecoration: 'none',
        color: INK,
      }}
    >
      <div>
        <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>
          {formatDate(loop.eventDate)}{loop.pickupTime ? ` · ${formatTime(loop.pickupTime)}` : ''}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{loop.name || 'Brew Loop'}</div>
      </div>
      <span style={{ color: INK_DIM, fontSize: 13 }}>
        {isBookable ? '→' : 'Soon'}
      </span>
    </a>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
    })
  } catch { return iso }
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr); const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

const sectionHeader = {
  fontSize: 11,
  color: INK_DIM,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  fontWeight: 700,
  margin: 0,
}

const primaryCta = {
  display: 'inline-block',
  padding: '14px 22px',
  borderRadius: 12,
  background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
  color: '#0a0a0b',
  fontWeight: 800,
  textDecoration: 'none',
  fontSize: 15,
  boxShadow: '0 10px 28px rgba(212,163,51,0.3)',
}

const ghostCta = {
  display: 'inline-block',
  padding: '12px 20px',
  borderRadius: 999,
  background: 'transparent',
  color: INK,
  border: `1px solid ${LINE}`,
  fontWeight: 600,
  textDecoration: 'none',
  fontSize: 14,
}

const emptyHero = {
  padding: '24px 20px',
  borderRadius: 18,
  background: SURFACE,
  border: `1px solid ${LINE}`,
}

const pulseDotStyle = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: GOLD,
  boxShadow: `0 0 10px ${GOLD}`,
  display: 'inline-block',
}
