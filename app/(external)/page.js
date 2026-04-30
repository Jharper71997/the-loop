import { getUpcomingLoops } from '@/lib/upcomingLoops'
import Image from 'next/image'

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
  const more = loops.slice(1, 4)

  return (
    <main style={{ padding: '14px 14px 24px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'grid', gap: 12 }}>
        <NextLoopCard loop={next} />

        <QuickChips />

        {more.length > 0 && (
          <section style={{ marginTop: 4 }}>
            <div style={sectionLabel}>Upcoming</div>
            <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
              {more.map(loop => <LoopRow key={`${loop.kind}-${loop.id}`} loop={loop} />)}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function NextLoopCard({ loop }) {
  if (!loop) {
    return (
      <section style={{ ...cardBase, padding: '28px 22px', display: 'grid', justifyItems: 'center', textAlign: 'center', gap: 12 }}>
        <Image
          src="/brand/badge-gold.png"
          alt=""
          width={80}
          height={80}
          style={{ opacity: 0.55 }}
        />
        <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
          No loops scheduled
        </div>
        <div style={{ color: INK_DIM, fontSize: 14, maxWidth: 320 }}>
          New dates drop on Instagram first. Check back soon.
        </div>
        <a href="/events" style={ghostCta}>See full calendar</a>
      </section>
    )
  }

  const href = `/book/${loop.id}`
  const bg = loop.coverImageUrl
    ? `linear-gradient(180deg, rgba(10,10,11,0.45), rgba(10,10,11,0.92)), url(${loop.coverImageUrl}) center/cover`
    : 'radial-gradient(120% 80% at 50% 0%, rgba(212,163,51,0.22), transparent 60%), #15151a'

  return (
    <section
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 18,
        background: SURFACE,
        border: `1px solid ${LINE}`,
        minHeight: 240,
        boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
      }}
    >
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: bg }} />

      <div
        aria-hidden
        style={{
          position: 'absolute',
          right: -28,
          bottom: -28,
          width: 220,
          height: 220,
          opacity: loop.coverImageUrl ? 0.08 : 0.14,
          pointerEvents: 'none',
        }}
      >
        <Image src="/brand/badge-gold.png" alt="" fill style={{ objectFit: 'contain' }} />
      </div>

      <div style={{ position: 'relative', padding: '18px 18px 20px', display: 'grid', gap: 14 }}>
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
          <h2 style={{ color: INK, fontSize: 26, fontWeight: 800, margin: '4px 0 4px', letterSpacing: '-0.01em' }}>
            {formatDate(loop.eventDate)}
            {loop.pickupTime ? ` · ${formatTime(loop.pickupTime)}` : ''}
          </h2>
          <div style={{ color: INK_DIM, fontSize: 13 }}>
            {loop.name || 'Jville Brew Loop'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <a href={href} style={primaryCta}>Book a seat</a>
          {loop.fromPriceCents != null && (
            <span style={{ color: GOLD_HI, fontSize: 13, fontWeight: 700 }}>
              from ${(loop.fromPriceCents / 100).toFixed(0)}
            </span>
          )}
          <a href="/my-tickets" style={ghostCtaInline}>I have a ticket</a>
        </div>
      </div>
    </section>
  )
}

function QuickChips() {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, WebkitOverflowScrolling: 'touch' }}>
      <Chip href="/my-tickets" label="My tickets" accent />
      <Chip href="/bars" label="Partner bars" />
      <Chip href="/about" label="How it works" />
      <Chip href="/leaderboard" label="Leaderboard" />
    </div>
  )
}

function Chip({ href, label, accent }) {
  return (
    <a
      href={href}
      style={{
        flex: '0 0 auto',
        padding: '10px 14px',
        borderRadius: 999,
        background: accent ? 'rgba(212,163,51,0.10)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${accent ? 'rgba(212,163,51,0.4)' : LINE}`,
        color: accent ? GOLD_HI : INK,
        fontSize: 13,
        fontWeight: 600,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </a>
  )
}

function LoopRow({ loop }) {
  const href = `/book/${loop.id}`
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
      <div style={{ minWidth: 0 }}>
        <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>
          {formatDate(loop.eventDate)}{loop.pickupTime ? ` · ${formatTime(loop.pickupTime)}` : ''}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {loop.name || 'Brew Loop'}
        </div>
      </div>
      <span style={{ color: INK_DIM, fontSize: 18, flex: '0 0 auto' }}>&rsaquo;</span>
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
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr); const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

const cardBase = {
  borderRadius: 18,
  background: SURFACE,
  border: `1px solid ${LINE}`,
}

const sectionLabel = {
  fontSize: 11,
  color: INK_DIM,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  fontWeight: 700,
}

const primaryCta = {
  display: 'inline-block',
  padding: '13px 22px',
  borderRadius: 12,
  background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
  color: '#0a0a0b',
  fontWeight: 800,
  textDecoration: 'none',
  fontSize: 15,
  letterSpacing: '0.01em',
  boxShadow: '0 10px 28px rgba(212,163,51,0.3)',
}

const ghostCta = {
  display: 'inline-block',
  padding: '11px 18px',
  borderRadius: 999,
  background: 'transparent',
  color: INK,
  border: `1px solid ${LINE}`,
  fontWeight: 600,
  textDecoration: 'none',
  fontSize: 14,
}

const ghostCtaInline = {
  ...ghostCta,
  padding: '11px 14px',
  fontSize: 13,
  color: INK_DIM,
}

const pulseDotStyle = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: GOLD,
  boxShadow: `0 0 10px ${GOLD}`,
  display: 'inline-block',
}
