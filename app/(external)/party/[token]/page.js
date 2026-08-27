import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getCurrentWaiverVersion } from '@/lib/waiver'
import { getPartyByToken, partyPriceCents, hasRoute, fmtMoney, fmtTime, fmtEventDate } from '@/lib/parties'
import { GOLD, INK, INK_DIM, INK_MUTE, MAX_W, eyebrow } from '@/lib/marketingTheme'
import { TONES, grainOverlay, lightPool, photoScrim, litCard, litCardInner } from '@/lib/atmosphere'
import BookingForm from '../../book/[eventId]/BookingForm'

export const dynamic = 'force-dynamic'

// The whole point of this page is that it is not findable. Nothing links to it,
// it is absent from the sitemap, /robots.js disallows /party/, and this tag is
// the belt-and-braces for a crawler that reaches the URL some other way — a
// link pasted into a public group chat, a browser extension phoning home.
export const metadata = {
  title: 'Your private outing',
  robots: { index: false, follow: false, nocache: true },
}

export default async function PartyPage({ params }) {
  const { token } = await params

  let sb
  try {
    sb = supabaseAdmin()
  } catch (err) {
    console.error('[party] supabaseAdmin init failed', err)
    notFound()
  }

  const party = await getPartyByToken(sb, token)
  // One 404 for every failure mode — bad token, cancelled party, someone
  // guessing. Distinguishing them would tell a guesser when they got close.
  if (!party) notFound()

  const { event, schedule, fares } = party
  const priceCents = partyPriceCents(fares)
  const routeBuilt = hasRoute(schedule)

  // Pickup time comes off the first stop once the route exists, because that is
  // the number the organizer plans their night around. Falls back to the
  // event's own pickup_time before we have built anything.
  const firstStop = routeBuilt ? schedule.find(s => s && s.name) : null
  const pickupTime = (firstStop && firstStop.start_time) || event.pickup_time

  const routeStops = schedule
    .map((s, i) => ({ index: i, name: (s && s.name) || null, start_time: (s && s.start_time) || null }))
    .filter(s => s.name)

  // Party fares carry stop_index null, so this lookup normally yields nothing
  // — it is here only for a party built by hand against a real stop. The
  // itinerary in the aside is what actually tells the group when to be where.
  const ticketTypes = fares.map(f => ({
    ...f,
    pickup_time: Number.isFinite(f.stop_index) ? (schedule[f.stop_index] || {}).start_time || null : null,
    remaining: null,
  }))

  let waiver = null
  try {
    waiver = await getCurrentWaiverVersion(sb)
  } catch (err) {
    console.error('[party] waiver lookup threw', err)
  }

  return (
    <main className="site-main" style={{ background: TONES.base }}>
      <section style={{ position: 'relative', overflow: 'hidden', background: TONES.void }}>
        {event.cover_image_url ? (
          <>
            <div aria-hidden style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${event.cover_image_url})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
            }} />
            <div aria-hidden style={{ position: 'absolute', inset: 0, background: photoScrim }} />
          </>
        ) : (
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: lightPool('top-left', 0.18) }} />
        )}
        <div aria-hidden style={grainOverlay} />

        <div style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto', padding: 'clamp(30px, 4.5vw, 52px) 24px clamp(26px, 4vw, 40px)' }}>
          <div style={eyebrow}>Private outing &middot; by invitation</div>
          <h1 style={{
            color: INK, fontSize: 'clamp(28px, 4.2vw, 44px)', fontWeight: 800,
            letterSpacing: '-0.025em', lineHeight: 1.06, margin: '10px 0 0', maxWidth: 760,
          }}>
            {event.name}
          </h1>
          <p style={{ color: INK_DIM, fontSize: 'clamp(15px, 1.7vw, 17px)', lineHeight: 1.55, margin: '14px 0 0', maxWidth: 620 }}>
            {fmtEventDate(event.event_date)}
            {pickupTime ? ` · pickup ${fmtTime(pickupTime)}` : ''}
            {event.capacity ? ` · up to ${event.capacity} riders` : ''}
          </p>
          {event.description && (
            <p style={{ color: INK_MUTE, fontSize: 15, lineHeight: 1.55, margin: '10px 0 0', maxWidth: 620 }}>
              {event.description}
            </p>
          )}

          {/* The quoted number, stated once, up top. The organizer was given
              this figure over text before they ever opened the link, and
              seeing a different one here is the fastest way to lose them. */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '22px 0 0', flexWrap: 'wrap' }}>
            <span style={{ color: GOLD, fontSize: 'clamp(30px, 4vw, 40px)', fontWeight: 800, letterSpacing: '-0.02em' }}>
              {fmtMoney(priceCents)}
            </span>
            <span style={{ color: INK_MUTE, fontSize: 14, fontWeight: 600 }}>
              the whole shuttle, not per person
            </span>
          </div>
        </div>
      </section>

      <section style={{ position: 'relative', background: TONES.base }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: lightPool('top-right', 0.1) }} />
        <div className="bk-grid" style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto', padding: 'clamp(26px, 4vw, 44px) 24px clamp(56px, 8vw, 96px)' }}>
          <div className="bk-form">
            <BookingForm
              eventId={event.id}
              eventName={event.name}
              ticketTypes={ticketTypes}
              addons={[]}
              /* Deliberately empty. Party fares carry stop_index null (the only
                 thing that keeps a party uncapped past the shuttle's 13-seat
                 per-stop limit), which BookingForm reads as "walk-on" and
                 answers with a pickup-bar picker. A private group boards
                 together at the first stop of their own route, so there is no
                 bar to choose — /api/checkout defaults these riders to stop 0
                 for exactly this reason. */
              stops={[]}
              waiver={waiver}
            />
          </div>

          <aside className="bk-aside">
            <div style={litCard({ radius: 18 })}>
              <div style={litCardInner({ radius: 17, pad: 22 })}>
                <div style={eyebrow}>Your route</div>

                {routeBuilt ? (
                  /* A private route is a promise in a way a public loop's is
                     not. The Friday shuttle circles all night, so a time beside
                     a bar would read as a pickup guarantee it cannot keep —
                     which is exactly why /book/[eventId] prints order only. A
                     charter visits these stops, in this order, once. Here the
                     times ARE the plan, so they belong on the page. */
                  <ol className="bk-route">
                    {routeStops.map((st, i) => (
                      <li key={`${st.index}-${st.name}`}>
                        <span className="bk-dot" aria-hidden />
                        <span className="bk-stop">
                          <span className="bk-stop-num" aria-hidden>{i + 1}</span>
                          <span className="bk-stop-name">{st.name}</span>
                          {st.start_time && <span className="bk-stop-time">{fmtTime(st.start_time)}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p style={{ color: INK_DIM, fontSize: 14, lineHeight: 1.55, margin: '14px 0 0' }}>
                    We build the route around you, and we collect you from wherever
                    you want to start — your place, wherever everyone is getting
                    ready, or a bar. Lock the shuttle in below, tell us where to be
                    and which bars you want, and the finished itinerary shows up
                    right here on this page.
                  </p>
                )}

                {/* The pickup alone is not an itinerary. A party built with only
                    its pickup stop would otherwise render a one-line "route" and
                    silently drop the promise that we are still planning it. */}
                {routeBuilt && routeStops.length < 2 && (
                  <p style={{ color: INK_MUTE, fontSize: 13.5, lineHeight: 1.55, margin: '12px 0 0' }}>
                    That&rsquo;s where we&rsquo;re collecting you. We&rsquo;re still
                    building the rest of the night — the bars land here as soon as
                    they&rsquo;re set.
                  </p>
                )}

                <ul className="bk-facts">
                  <li>The shuttle is yours for the night, nobody else is on it</li>
                  <li>We pick you up wherever you want to start</li>
                  <li>One person pays, everyone else gets a link to sign their own waiver</li>
                  <li>Name the bars, or let us build the route</li>
                  <li>Track the shuttle live all night</li>
                  <li>Strictly 21+, every rider</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <style>{`
        .bk-grid { display: grid; gap: 28px; align-items: start; }
        .bk-form { order: 1; min-width: 0; }
        .bk-aside { order: 2; }
        @media (min-width: 960px) {
          .bk-grid { grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.65fr); gap: 40px; }
          .bk-aside { position: sticky; top: 88px; }
        }

        .bk-route { list-style: none; margin: 16px 0 0; padding: 0; }
        .bk-route li {
          display: flex; align-items: center; gap: 11px;
          padding: 9px 0; border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .bk-route li:last-child { border-bottom: 0; }
        .bk-dot {
          width: 7px; height: 7px; border-radius: 50%; flex: 0 0 auto;
          background: ${GOLD}; box-shadow: 0 0 9px rgba(212,163,51,0.7);
        }
        .bk-stop { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; flex: 1; min-width: 0; }
        .bk-stop-name { color: ${INK}; font-size: 14.5px; font-weight: 700; }
        .bk-stop-num { color: ${INK_MUTE}; font-size: 12px; font-weight: 800; min-width: 14px; }
        .bk-stop-time { color: ${GOLD}; font-size: 12.5px; font-weight: 700; margin-left: auto; white-space: nowrap; }

        .bk-facts {
          list-style: none; margin: 18px 0 0; padding: 16px 0 0;
          display: grid; gap: 9px; border-top: 1px solid rgba(255,255,255,0.07);
        }
        .bk-facts li { color: ${INK_DIM}; font-size: 13.5px; line-height: 1.45; padding-left: 18px; position: relative; }
        .bk-facts li::before {
          content: ''; position: absolute; left: 0; top: 7px;
          width: 6px; height: 6px; border-radius: 50%; background: rgba(212,163,51,0.55);
        }
      `}</style>
    </main>
  )
}
