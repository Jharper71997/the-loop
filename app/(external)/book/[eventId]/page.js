import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getCurrentWaiverVersion } from '@/lib/waiver'
import { brandFor, prefixLink } from '@/lib/businessConfig'
import { MARINES_VERIFIED_COOKIE } from '@/lib/marines'
import { capacityForTicketType } from '@/lib/capacity'
import { getBarByName } from '@/lib/bars'
import { GOLD, GOLD_HI, INK, INK_DIM, INK_MUTE, MAX_W, eyebrow } from '@/lib/marketingTheme'
import { TONES, grainOverlay, lightPool, photoScrim, litCard, litCardInner } from '@/lib/atmosphere'
import BookingForm from './BookingForm'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  // generateMetadata throwing crashes the entire route to a 500 before the
  // page render has a chance to recover, so swallow everything here. The
  // page-level handler will deal with any real lookup failure.
  try {
    const { eventId } = await params
    const supabase = supabaseAdmin()
    const { data: event } = await supabase
      .from('events')
      .select('name, event_date')
      .eq('id', eventId)
      .maybeSingle()
    return {
      title: event ? `Book ${event.name}` : 'Book',
    }
  } catch (err) {
    console.error('[book/eventId] generateMetadata threw', err)
    return { title: 'Book' }
  }
}

export default async function EventBookingPage({ params }) {
  const { eventId } = await params

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (err) {
    console.error('[book/eventId] supabaseAdmin init failed', err)
    notFound()
  }

  let event = null
  let eventErr = null
  try {
    const r = await supabase
      .from('events')
      .select('id, name, event_date, pickup_time, description, status, cover_image_url, group_id, kind')
      .eq('id', eventId)
      .maybeSingle()
    event = r.data
    eventErr = r.error
  } catch (err) {
    console.error('[book/eventId] event lookup threw', err)
  }
  if (eventErr) console.error('[book/eventId] event lookup error', eventErr)
  if (!event || event.status !== 'on_sale') notFound()

  // The Loop (Marines): the buy form is Marines-only. Bounce anyone who hasn't
  // cleared DoD-ID verification to /marines/verify (the API enforces this too;
  // this is the friendly redirect so they never see a form they can't submit).
  if (event.kind === 'marines') {
    let verifiedContactId = null
    try { verifiedContactId = (await cookies()).get(MARINES_VERIFIED_COOKIE)?.value || null } catch {}
    let cleared = false
    if (verifiedContactId) {
      const { data: vc } = await supabase
        .from('contacts').select('military_verified').eq('id', verifiedContactId).maybeSingle()
      cleared = !!vc?.military_verified
    }
    if (!cleared) redirect(prefixLink('/verify', 'marines'))
  }

  // Branding is data-driven from the loaded event, so this page renders correctly
  // whether it's hit at /book/<id> or /surfcity/book/<id>. Back-link: Brew goes to
  // its /book index; prefixed businesses (Surf) have no /book index, so send them
  // to their events list instead.
  const cfg = brandFor(event.kind)
  const backHref = cfg.basePath ? prefixLink('/events', event.kind) : '/book'

  // Pull the linked group's schedule so each ticket type can display the
  // bar's actual pickup time at checkout (e.g. "Shirley V's — 7:45 PM — $20").
  // stop_index on the ticket type indexes into schedule[i].start_time.
  let schedule = []
  if (event.group_id) {
    try {
      const r = await supabase
        .from('groups')
        .select('schedule')
        .eq('id', event.group_id)
        .maybeSingle()
      schedule = Array.isArray(r.data?.schedule) ? r.data.schedule : []
    } catch (err) {
      console.error('[book/eventId] schedule lookup threw', err)
    }
  }

  // The night's bars, for the walk-on pickup picker. Index is the position in
  // the schedule (same space ticket_type.stop_index points into), preserved
  // across the name filter so a chosen index still maps to the right bar.
  const stops = schedule
    .map((s, i) => ({ index: i, name: s?.name || null, start_time: s?.start_time || null }))
    .filter(s => s.name)

  let ticketTypes = []
  try {
    const r = await supabase
      .from('ticket_types')
      .select('id, name, price_cents, capacity, stop_index, sort_order')
      .eq('event_id', eventId)
      .eq('active', true)
      .order('sort_order', { ascending: true })
    if (r.error) console.error('[book/eventId] ticket_types error', r.error)
    ticketTypes = (r.data || []).map(t => {
      const stop = Number.isFinite(t.stop_index) ? schedule[t.stop_index] : null
      return { ...t, pickup_time: stop?.start_time || null }
    })
  } catch (err) {
    console.error('[book/eventId] ticket_types threw', err)
  }

  // Compute remaining seats per ticket type, counting BOTH native Loop sales
  // and Ticket Tailor-mirrored sales at the same (event_id, stop_index). Mirrors
  // the server-side capacity check in api/checkout/route.js so what the rider
  // sees on the page matches what the API would let them buy.
  const pendingCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  ticketTypes = await Promise.all(
    ticketTypes.map(async t => {
      const cap = capacityForTicketType(t)
      if (cap == null) return { ...t, remaining: null }
      try {
        const baseSelect = 'id, orders!inner(id, event_id, status, created_at)'
        let paidQuery = supabase
          .from('order_items')
          .select(baseSelect, { count: 'exact', head: true })
          .eq('orders.event_id', eventId)
          .is('voided_at', null)
          .eq('orders.status', 'paid')
        let pendingQuery = supabase
          .from('order_items')
          .select(baseSelect, { count: 'exact', head: true })
          .eq('orders.event_id', eventId)
          .is('voided_at', null)
          .eq('orders.status', 'pending')
          .gte('orders.created_at', pendingCutoff)
        if (t.stop_index != null) {
          paidQuery = paidQuery.eq('stop_index', t.stop_index)
          pendingQuery = pendingQuery.eq('stop_index', t.stop_index)
        } else {
          paidQuery = paidQuery.eq('ticket_type_id', t.id)
          pendingQuery = pendingQuery.eq('ticket_type_id', t.id)
        }
        const [{ count: paidCount }, { count: pendingCount }] = await Promise.all([paidQuery, pendingQuery])
        const taken = (paidCount || 0) + (pendingCount || 0)
        return { ...t, remaining: Math.max(0, cap - taken) }
      } catch (err) {
        console.error('[book/eventId] remaining count failed', t.id, err)
        return { ...t, remaining: null }
      }
    }),
  )

  // Active add-ons offered at checkout (global ones + any scoped to this event).
  let addons = []
  try {
    const r = await supabase
      .from('addons')
      .select('id, name, description, price_cents, kind, sort_order')
      .eq('active', true)
      .or(`event_id.is.null,event_id.eq.${eventId}`)
      .order('sort_order', { ascending: true })
    if (r.error) console.error('[book/eventId] addons error', r.error)
    addons = r.data || []
  } catch (err) {
    console.error('[book/eventId] addons threw', err)
  }

  let waiver = null
  try {
    waiver = await getCurrentWaiverVersion(supabase)
  } catch (err) {
    console.error('[book/eventId] waiver lookup threw', err)
  }

  // Display names for the night's bars. The schedule's own strings are the
  // Ticket Tailor sync key and must never be renamed (see lib/bars.js); this
  // resolves them to the canonical bar name for DISPLAY only, exactly as the
  // boarding pass does. Brew only - Surf and Marines have their own venues.
  const isBrew = !event.kind || event.kind === 'brew'
  const routeStops = stops.map(st => {
    const bar = isBrew ? getBarByName(st.name) : null
    return { ...st, display: bar?.name || st.name }
  })

  return (
    <main className="site-main" style={{ background: TONES.base }}>
      {/* This page used to render its own <main> on flat #0a0a0b, with its own
          font stack and its own gold-underlined header bar - directly beneath
          the real SiteHeader that RiderChrome already puts on every Brew page.
          So a rider who had just been sold by the marketing site landed on two
          headers and a 640px form column marooned in black. This is the same
          shell every other page uses. THE FORM ITSELF IS UNTOUCHED. */}
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

        <div style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto', padding: 'clamp(26px, 4vw, 44px) 24px clamp(26px, 4vw, 40px)' }}>
          <Link href={backHref} style={{ color: INK_MUTE, fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
            &larr; All loops
          </Link>
          <div style={{ ...eyebrow, marginTop: 18 }}>
            {formatDate(event.event_date)}{event.pickup_time ? ` \u00b7 ${formatTime(event.pickup_time)}` : ''}
          </div>
          <h1 style={{
            color: INK, fontSize: 'clamp(28px, 4.2vw, 44px)', fontWeight: 800,
            letterSpacing: '-0.025em', lineHeight: 1.06, margin: '10px 0 0', maxWidth: 760,
          }}>
            {event.name}
          </h1>
          {event.description && (
            <p style={{ color: INK_DIM, fontSize: 'clamp(15px, 1.7vw, 17px)', lineHeight: 1.55, margin: '14px 0 0', maxWidth: 620 }}>
              {event.description}
            </p>
          )}
        </div>
      </section>

      <section style={{ position: 'relative', background: TONES.base }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: lightPool('top-right', 0.1) }} />
        <div className="bk-grid" style={{ position: 'relative', maxWidth: MAX_W, margin: '0 auto', padding: 'clamp(26px, 4vw, 44px) 24px clamp(56px, 8vw, 96px)' }}>
          <div className="bk-form">
            <BookingForm
              eventId={event.id}
              eventName={event.name}
              ticketTypes={ticketTypes || []}
              addons={addons}
              stops={stops}
              waiver={waiver}
            />
          </div>

          {/* What they are actually buying. The old page asked for a name, a
              phone, a waiver signature and $20 without ever saying where the
              bus goes - every one of those facts was on the marketing page
              they just left. Carries NO price on purpose: the form owns the
              money, and a second total here is a number that can drift. */}
          <aside className="bk-aside">
            <div style={litCard({ radius: 18 })}>
              <div style={litCardInner({ radius: 17, pad: 22 })}>
                <div style={eyebrow}>Your night</div>

                {routeStops.length > 0 && (
                  <ol className="bk-route">
                    {routeStops.map((st, i) => (
                      <li key={`${st.index}-${st.name}`}>
                        <span className="bk-dot" aria-hidden />
                        <span className="bk-stop">
                          <span className="bk-stop-name">{st.display}</span>
                          {st.start_time && <span className="bk-stop-time">{formatTime(st.start_time)}</span>}
                        </span>
                        {/* "First stop", NOT "Pickup". This is a server-rendered
                            summary of the route and it cannot know which bar the
                            rider picked in the form - tagging index 0 as their
                            pickup was a claim that goes wrong the moment they
                            choose any other bar. First stop is true either way. */}
                        {i === 0 && <span className="bk-tag">First stop</span>}
                      </li>
                    ))}
                  </ol>
                )}

                <ul className="bk-facts">
                  <li>One seat covers the whole night</li>
                  <li>Ends back at the stop you started from</li>
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
        /* The summary drops BELOW the form on narrow screens: on a phone the
           job is to finish paying, and pushing the form down behind a summary
           card is the wrong order. */
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
        .bk-stop-time { color: ${INK_MUTE}; font-size: 12.5px; font-weight: 600; }
        .bk-tag {
          flex: 0 0 auto; color: ${GOLD_HI}; font-size: 10px; font-weight: 800;
          letter-spacing: 0.14em; text-transform: uppercase;
          border: 1px solid rgba(212,163,51,0.4); border-radius: 999px; padding: 3px 8px;
        }

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

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
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
