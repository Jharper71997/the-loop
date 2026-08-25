import Link from 'next/link'
import { prefixLink, brandFor } from '@/lib/businessConfig'
import { getBar } from '@/lib/bars'
import { PageHero, Band, Head } from './marketing/PageShell'
import { litCard, litCardInner } from '@/lib/atmosphere'
import { INK_MUTE, ghostCta as mktGhostCta } from '@/lib/marketingTheme'

// Shared upcoming-loops body for Brew ('/events') and Surf City
// ('/surfcity/events'). Takes loops + business so book links are prefixed.
// Server-renderable (no hooks).
//
// Brew renders BrewEvents below — the same hero/band/card shapes as the rest of
// the website, because this is where "Book a seat" lands and it was the last
// page that still looked like the old app. Surf and Marines keep the original
// narrow centered layout, untouched.

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'

const SUBTITLE = {
  brew: '$20 a seat covers your whole night. Shuttle runs about 7:30 PM to 1:30 AM, back to your pickup.',
  surf: 'Hop the Surf City Loop. Book your seat below.',
  // The Loop runs Saturday and Sunday DAYTIME from the base gate. Never frame
  // it as a night out or around bars — its riders are largely under 21.
  marines: 'Board at the gate and ride the loop around town. $10 a ride, or $20 all day.',
}

const HEADING = {
  brew: 'Pick a night.',
  surf: 'Pick a night.',
  marines: 'Pick a day.',
}

// Label over the stop chips on each loop card.
const STOPS_LABEL = {
  brew: 'Tonight’s bars',
  surf: 'Tonight’s bars',
  marines: 'Stops on this loop',
}

export default function EventsBody({ loops = [], renderError = null, business = 'brew' }) {
  const isBrew = business === 'brew'
  if (isBrew) return <BrewEvents loops={loops} renderError={renderError} />
  const shellWidth = 1100

  return (
    <main>
      {renderError && (
        <div style={{
          background: '#3a1a1a',
          border: '1px solid #f87171',
          color: '#f87171',
          padding: '12px 16px',
          fontSize: 13,
          fontFamily: 'ui-monospace, monospace',
          margin: '12px 16px 0',
          borderRadius: 8,
          whiteSpace: 'pre-wrap',
        }}>
          {renderError}
        </div>
      )}
        <section
          style={{
            padding: '20px 16px 16px',
            textAlign: 'center',
            background: 'radial-gradient(700px 240px at 50% 0%, rgba(212,163,51,0.10), transparent 70%)',
          }}
        >
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div
              style={{
                color: GOLD,
                fontSize: 11,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              Upcoming loops
            </div>
            <h1 style={{ color: INK, fontSize: 'clamp(22px, 6vw, 28px)', margin: '6px 0 4px' }}>
              {HEADING[business] || HEADING.brew}
            </h1>
            <p style={{ marginTop: 4, fontSize: 14, color: INK_DIM }}>
              {SUBTITLE[business] || SUBTITLE.brew}
            </p>
          </div>
        </section>

        <section style={{ maxWidth: shellWidth, margin: '0 auto', padding: '16px 16px 32px' }}>
          {!loops.length ? (
            <EmptyState business={business} />
          ) : (
            <div
              style={{
                display: 'grid',
                gap: 18,
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              }}
            >
              {loops.map(loop => <LoopCard key={`${loop.kind}-${loop.id}`} loop={loop} business={business} />)}
            </div>
          )}
        </section>
    </main>
  )
}

/* ============================ Brew: the website ========================== */
/* This page is step two of "Book a seat", so it uses the marketing shapes.
   The old version buried the date under a repeated title ("Jville Brew Loop -
   Friday Night — Fri, Aug 7", on a card that already showed the date), labelled
   every card "Tonight's bars" including ones two days out, and stacked the
   stops as numbered pills — which is where the blocky look came from. */

function BrewEvents({ loops = [], renderError = null }) {
  const bookable = loops.filter(l => l.kind === 'event')
  return (
    <main className="site-main">
      {renderError && (
        <div style={{
          background: '#3a1a1a', border: '1px solid #f87171', color: '#f87171',
          padding: '12px 16px', fontSize: 13, fontFamily: 'ui-monospace, monospace',
          margin: '12px 16px 0', borderRadius: 8, whiteSpace: 'pre-wrap',
        }}>
          {renderError}
        </div>
      )}

      <PageHero
        kicker="Upcoming loops"
        title={<>Pick a night.<br /><span style={{ color: GOLD_HI }}>We&rsquo;ll handle the rest.</span></>}
        sub="One seat covers the whole night. The shuttle runs about 7:30 PM to 1:30 AM and brings you back to the same spot you started."
        facts={['$20 a seat', 'Friday + Saturday', 'Strictly 21+']}
      />

      <Band tone="raised" light="top-right" strength={0.13} grain>
        {!loops.length ? (
          <BrewEmpty />
        ) : (
          <>
            <Head
              kicker={bookable.length ? 'On sale now' : 'Coming up'}
              title={bookable.length === 1 ? 'One night on sale.' : 'Nights on sale.'}
              aside={<Link href="/bars" style={{ ...mktGhostCta, padding: '13px 22px' }}>See the bars</Link>}
            />
            <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(330px, 1fr))', marginTop: 36 }}>
              {loops.map(loop => <BrewLoopCard key={`${loop.kind}-${loop.id}`} loop={loop} />)}
            </div>
            <p style={{ color: INK_MUTE, fontSize: 14, lineHeight: 1.6, margin: '26px 0 0', maxWidth: 640 }}>
              Routes rotate weekend to weekend, and Friday can differ from Saturday. The stops listed on each
              night are that night&rsquo;s actual lineup.
            </p>
          </>
        )}
      </Band>
    </main>
  )
}

function BrewLoopCard({ loop }) {
  const isBookable = loop.kind === 'event'
  const name = cleanLoopName(loop.name, 'brew')
  const stops = Array.isArray(loop.stops) ? loop.stops : []

  const inner = (
    <div style={{ ...litCardInner({ radius: 19, pad: 26 }), display: 'flex', flexDirection: 'column' }}>
      {/* The date IS the headline — it's what people scan for. */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ color: INK, fontSize: 'clamp(24px, 3.4vw, 30px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            {formatDate(loop.eventDate)}
          </div>
          {name && <div style={{ color: INK_DIM, fontSize: 14.5, marginTop: 6 }}>{name}</div>}
        </div>
        {!isBookable && (
          <span style={{
            flex: '0 0 auto', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: GOLD_HI, fontWeight: 700, background: 'rgba(212,163,51,0.14)',
            border: '1px solid rgba(212,163,51,0.35)', padding: '5px 10px', borderRadius: 999,
          }}>
            Coming soon
          </span>
        )}
      </div>

      {/* The route, as a route — not five numbered boxes. */}
      <div style={{ marginTop: 20 }}>
        <div style={{ color: GOLD, fontSize: 10.5, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }}>
          {stops.length ? 'The route' : 'Route'}
        </div>
        {stops.length ? (
          <p style={{ margin: '10px 0 0', color: INK, fontSize: 15, lineHeight: 1.75 }}>
            {stops.map((s, i) => (
              <span key={`${i}-${s.slug || s.name}`}>
                {i > 0 && <span aria-hidden style={{ color: GOLD, margin: '0 8px' }}>&rarr;</span>}
                {stopDisplayName(s)}
              </span>
            ))}
          </p>
        ) : (
          <p style={{ margin: '10px 0 0', color: INK_DIM, fontSize: 14.5, lineHeight: 1.6 }}>
            Drops Friday afternoon. Hand-picked weekly.
          </p>
        )}
      </div>

      {loop.pickupTime && (
        <div style={{ marginTop: 18, color: INK_DIM, fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD, boxShadow: `0 0 8px ${GOLD}` }} />
          First pickup {formatTime(loop.pickupTime)}
        </div>
      )}

      <div style={{
        marginTop: 'auto', paddingTop: 20, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 12,
      }}>
        <span style={{ color: GOLD_HI, fontWeight: 800, fontSize: 17 }}>
          {isBookable
            ? (loop.fromPriceCents != null ? `$${(loop.fromPriceCents / 100).toFixed(0)} a seat` : 'Book now')
            : 'Tickets soon'}
        </span>
        <span style={{ color: isBookable ? INK : INK_DIM, fontSize: 14, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {isBookable ? <>Book a seat <span style={{ color: GOLD }}>&rarr;</span></> : 'Not on sale'}
        </span>
      </div>
    </div>
  )

  if (!isBookable) return <div style={litCard({ radius: 20 })}>{inner}</div>
  return (
    <Link href={prefixLink(`/book/${loop.id}`, 'brew')} style={{ ...litCard({ radius: 20 }), textDecoration: 'none', display: 'block' }}>
      {inner}
    </Link>
  )
}

function BrewEmpty() {
  return (
    <div style={{ ...litCard({ radius: 20 }), maxWidth: 560, margin: '0 auto' }}>
      <div style={{ ...litCardInner({ radius: 19, pad: 'clamp(30px, 5vw, 44px)' }), textAlign: 'center' }}>
        <div style={{ color: INK, fontWeight: 800, fontSize: 20, letterSpacing: '-0.01em' }}>No loops scheduled yet</div>
        <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.6, margin: '12px 0 22px' }}>
          New dates drop each week. Follow along and we&rsquo;ll post the next one as soon as it&rsquo;s set.
        </p>
        <Link href="/contact" style={{ ...mktGhostCta, padding: '14px 22px' }}>Ask about a date</Link>
      </div>
    </div>
  )
}

// Stop names come from ticket-type names, which drift from the partner-bar
// directory ("Archies Pub" vs "Archie's", "Hideaway Lounge" vs "Hideaway") —
// so the same bar was reading as two different places depending on which page
// you were on. When the stop resolved to a known bar, show that bar's name.
function stopDisplayName(s) {
  if (!s) return ''
  return (s.slug && getBar(s.slug)?.name) || s.name
}

// Event names arrive as "Jville Brew Loop - Friday Night — Fri, Aug 7": the
// brand (redundant on the brand's own site) plus a date the card already shows
// as its headline. Strip both so the card says one thing once.
function cleanLoopName(name, business) {
  if (!name) return ''
  let s = String(name).trim()
  const brand = brandFor(business)?.brand
  if (brand) {
    const esc = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    s = s.replace(new RegExp(`^${esc}\\s*[-–—:]\\s*`, 'i'), '')
  }
  s = s.replace(
    /\s*[-–—]\s*(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)[a-z]*\.?,?\s+[a-z]{3,9}\.?\s*\d{1,2}(,\s*\d{4})?\s*$/i,
    '',
  )
  return s.trim()
}

function EmptyState({ business }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '48px 24px',
        border: '1px dashed rgba(255,255,255,0.12)',
        borderRadius: 14,
        background: 'rgba(255,255,255,0.015)',
        maxWidth: 560,
        margin: '0 auto',
      }}
    >
      <div style={{ color: INK, fontWeight: 600, fontSize: 18, marginBottom: 8 }}>
        No loops scheduled yet
      </div>
      <p style={{ color: INK_DIM, margin: '0 0 20px' }}>
        New dates drop each week. Follow us or check back soon.
      </p>
      <a href={prefixLink('/', business)} style={ghostCta}>Back home</a>
    </div>
  )
}

function LoopCard({ loop, business }) {
  const isBookable = loop.kind === 'event'
  // Non-bookable loops render as a <div> rather than a hash-linked <a> so
  // we don't have to attach a preventDefault onClick — server components
  // can't pass functions to client components, which crashes /events with
  // a React error 2295622842.
  const Wrapper = isBookable ? 'a' : 'div'
  const wrapperProps = isBookable ? { href: prefixLink(`/book/${loop.id}`, business) } : {}

  return (
    <Wrapper
      {...wrapperProps}
      style={{
        display: 'flex',
        flexDirection: 'column',
        textDecoration: 'none',
        color: 'inherit',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16,
        overflow: 'hidden',
        transition: 'border-color 0.2s, transform 0.15s',
        cursor: isBookable ? 'pointer' : 'default',
      }}
    >
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          padding: '18px 18px 14px',
          minHeight: 180,
          background: loop.coverImageUrl
            ? `linear-gradient(180deg, rgba(10,10,11,0.45) 0%, rgba(10,10,11,0.85) 100%), url(${loop.coverImageUrl}) center/cover`
            : 'radial-gradient(140% 90% at 50% 0%, rgba(212,163,51,0.22), transparent 65%), linear-gradient(180deg, #15140f 0%, #0a0a0b 100%)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: GOLD,
              fontWeight: 700,
              background: 'rgba(10,10,11,0.75)',
              padding: '6px 12px',
              borderRadius: 999,
              border: '1px solid rgba(212,163,51,0.35)',
            }}
          >
            {formatDate(loop.eventDate)}
          </span>
          {!isBookable && (
            <span
              style={{
                fontSize: 10,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: GOLD_HI,
                fontWeight: 700,
                background: 'rgba(212,163,51,0.14)',
                border: '1px solid rgba(212,163,51,0.35)',
                padding: '4px 10px',
                borderRadius: 999,
              }}
            >
              Coming soon
            </span>
          )}
        </div>

        <div style={{ marginTop: 16 }}>
          <BarChips stops={loop.stops} business={business} />
        </div>

        {loop.pickupTime && (
          <div
            style={{
              marginTop: 14,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: INK,
              background: 'rgba(10,10,11,0.6)',
              padding: '6px 12px',
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD }} />
            First pickup {formatTime(loop.pickupTime)}
          </div>
        )}
      </div>

      <div style={{ padding: '18px 22px 22px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <h3 style={{ color: INK, fontSize: 19, fontWeight: 600, marginBottom: 12 }}>{loop.name}</h3>

        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 14,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <span style={{ color: GOLD_HI, fontWeight: 700, fontSize: 16 }}>
            {isBookable
              ? (loop.fromPriceCents != null ? `From $${(loop.fromPriceCents / 100).toFixed(0)}` : 'Book now')
              : 'Tickets soon'}
          </span>
          <span
            style={{
              color: INK,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.04em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {isBookable ? (
              // "Book a seat" everywhere — same words as the nav button that
              // sent them here, so it reads as finishing one action, not
              // starting a second one.
              <>Book a seat <span style={{ color: GOLD }}>&rarr;</span></>
            ) : (
              <span style={{ color: INK_DIM }}>Not on sale</span>
            )}
          </span>
        </div>
      </div>
    </Wrapper>
  )
}

function BarChips({ stops, business = 'brew' }) {
  const hasStops = Array.isArray(stops) && stops.length > 0
  if (!hasStops) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 0 4px',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: `1.5px solid ${GOLD}`,
            color: GOLD,
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          ◐
        </span>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: INK, fontSize: 14, fontWeight: 600 }}>
            {business === 'marines' ? 'Stops posted before the weekend' : 'Route drops Friday afternoon'}
          </span>
          <span style={{ color: INK_DIM, fontSize: 12 }}>
            {business === 'marines' ? 'Same loop, all day' : 'Hand-picked weekly'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          color: GOLD,
          fontSize: 10,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          fontWeight: 700,
        }}
      >
        {STOPS_LABEL[business] || STOPS_LABEL.brew}
      </span>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        {stops.map((s, i) => (
          <span
            key={`chip-${i}-${s.slug || s.name}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: INK,
              background: 'rgba(10,10,11,0.6)',
              border: '1px solid rgba(212,163,51,0.35)',
              padding: '5px 10px',
              borderRadius: 999,
              whiteSpace: 'nowrap',
            }}
          >
            <span
              aria-hidden
              style={{
                color: GOLD,
                fontSize: 10,
                fontWeight: 700,
                fontFamily: 'ui-monospace, monospace',
              }}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            {s.name}
          </span>
        ))}
      </div>
    </div>
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

const ghostCta = {
  display: 'inline-block',
  padding: '12px 22px',
  borderRadius: 999,
  background: 'transparent',
  color: INK,
  border: '1px solid rgba(255,255,255,0.15)',
  fontWeight: 600,
  textDecoration: 'none',
  fontSize: 14,
}
