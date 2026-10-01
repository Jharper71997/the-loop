import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { brandFor, prefixLink } from '@/lib/businessConfig'
import { joinUrl, slotPickupTime, BASE_ZONE } from '@/lib/doorPickup'
import CopyJoinLink from './CopyJoinLink'

export const dynamic = 'force-dynamic'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'

// Resolve the order (+ its business `kind`) from either a Stripe session or a
// free-order id. Used by both the page and generateMetadata so a Marines/Surf
// rider never lands on a Brew-branded confirmation.
async function loadOrder(sessionId, orderId) {
  if (!sessionId && !orderId) return null
  const sb = supabaseAdmin()
  // orders has two FKs to contacts (buyer + referrer), so the embed must name
  // the buyer one. Unqualified, PostgREST errors (PGRST201), the order comes
  // back null, and every rider got the generic page plus the pass upsell.
  const sel = 'id, contact_id, event_id, party_size, metadata, contacts!orders_contact_id_fkey ( id, first_name ), event:events ( kind, event_date )'
  const { data: order } = await (sessionId
    ? sb.from('orders').select(sel).eq('stripe_checkout_session_id', sessionId)
    : sb.from('orders').select(sel).eq('id', orderId)
  ).maybeSingle()
  return order || null
}

export async function generateMetadata({ searchParams }) {
  const params = await searchParams
  const order = await loadOrder(params?.session_id, params?.order_id)
  const kind = order?.event?.kind || 'brew'
  return { title: `Booked — ${brandFor(kind).brand}` }
}

export default async function BookingSuccess({ searchParams }) {
  const params = await searchParams
  const sessionId = params?.session_id
  // Loop Pass / fully-covered bookings settle without Stripe, so they land here
  // with ?order_id= instead of ?session_id=.
  const orderId = params?.order_id

  // Look up the order to find the contact + which business this booking belongs
  // to. If nothing returns (webhook hasn't landed yet, or a direct hit on this
  // page), fall back to Brew.
  let firstName = null
  let kind = 'brew'

  const order = await loadOrder(sessionId, orderId)
  // Door pickup organizer: hand them the link their group pays through.
  const door = order?.metadata?.door_pickup
  const groupLink = door?.join_code && !door.party_of ? joinUrl(order.event_id, door.join_code) : null
  if (order) {
    kind = order.event?.kind || 'brew'
    firstName = order.contacts?.first_name || null
  }

  // Business-aware brand + links so the confirmation matches the loop the rider
  // actually booked (The Loop / Surf City / Brew), not always Brew.
  const cfg = brandFor(kind)
  const ride = kind === 'brew' ? 'the Loop' : cfg.rideName
  const myTicketsHref = prefixLink('/my-tickets', kind)
  const eventsHref = prefixLink('/events', kind)

  if (door) {
    return (
      <DoorPickupConfirmation
        order={order}
        door={door}
        firstName={firstName}
        groupLink={groupLink}
        myTicketsHref={myTicketsHref}
      />
    )
  }

  return (
    <main>
        <section style={{ padding: '32px 20px 40px', maxWidth: 640, margin: '0 auto' }}>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'rgba(212,163,51,0.12)',
                border: `1px solid ${GOLD}`,
                marginBottom: 20,
                fontSize: 28,
                color: GOLD_HI,
              }}
            >
              &#10003;
            </div>
            <h1 style={{ color: INK }}>
              You&apos;re on {ride}{firstName ? `, ${firstName}` : ''}.
            </h1>
            <p style={{ marginTop: 14, fontSize: 17 }}>
              Your ticket is on its way to your inbox. Check your email for the QR code, or open My Tickets anytime.
            </p>
          </div>

          <div style={{ marginTop: 40, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={myTicketsHref} style={ghostCta}>My tickets</a>
            <a href={eventsHref} style={ghostCta}>Browse more loops</a>
          </div>

          {/* Someone who just paid for a seat is the best person to pitch the
              pass to. Brew card checkouts only: not a pass seat, not a door
              pickup (the pass does not cover those). */}
          {kind === 'brew' && sessionId && !door && !order?.metadata?.loop_pass && (
            <div style={passCard}>
              <div style={{ color: GOLD_HI, fontSize: 12, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Loop Pass
              </div>
              <p style={{ margin: '8px 0 16px', fontSize: 16, color: INK, lineHeight: 1.5 }}>
                Coming back next weekend? $25 a month covers your seat on every weekend loop. Cancel anytime.
              </p>
              <a href="/pass" style={{ ...ghostCta, borderColor: GOLD, color: GOLD_HI }}>See the pass</a>
            </div>
          )}
        </section>
    </main>
  )
}

// Oktoberfest door pickup: when we come, from where, how many, where we drop
// them, and their tickets. No pass pitch, no "browse more loops".
async function DoorPickupConfirmation({ order, door, firstName, groupLink, myTicketsHref }) {
  const sb = supabaseAdmin()
  const { data: items } = await sb
    .from('order_items')
    .select('id, rider_first_name, rider_last_name, voided_at')
    .eq('order_id', order.id)
    .order('id')
  const live = (items || []).filter(i => !i.voided_at)
  // QR codes are minted when the Stripe webhook settles the order, which can
  // land a few seconds after the rider does. Until then, My tickets covers it.
  const { data: qrs } = live.length
    ? await sb.from('qr_codes').select('code, order_item_id').in('order_item_id', live.map(i => i.id))
    : { data: [] }
  const codeByItem = new Map((qrs || []).map(q => [q.order_item_id, q.code]))
  const tickets = live
    .map(i => ({
      name: [i.rider_first_name, i.rider_last_name].filter(Boolean).join(' ') || 'Rider',
      code: codeByItem.get(i.id),
    }))
    .filter(t => t.code)

  const riders = live.length || order.party_size || 0
  const unpaidFriends = (door.roster || []).length
  const joiner = !!door.party_of
  const day = formatDay(order.event?.event_date)
  const window = pickupWindow(slotPickupTime(door.slot))
  const address = [door.street, door.city, door.zip].filter(Boolean).join(', ')

  return (
    <main>
      <section style={{ padding: '32px 20px 40px', maxWidth: 560, margin: '0 auto' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={checkBadge}>&#10003;</div>
          <div style={{ color: GOLD, fontSize: 12, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            Oktoberfest pickup
          </div>
          <h1 style={{ color: INK, marginTop: 8 }}>
            You&apos;re booked{firstName ? `, ${firstName}` : ''}.
          </h1>
        </div>

        <div style={doorCard}>
          <Row label="Pickup">
            <strong style={{ color: INK }}>{day || 'Your pickup day'}</strong>
            {window ? `, ${window}` : null}
            <div style={subText}>
              We get to you sometime in that hour, not right on the hour. Your driver texts you when they are on the way.
            </div>
          </Row>
          {address && (
            <Row label="From">
              <span style={{ color: INK }}>{address}</span>
              {joiner && door.party_name ? <div style={subText}>You ride with {door.party_name}&apos;s group.</div> : null}
            </Row>
          )}
          {riders > 0 && (
            <Row label="Riders">
              <span style={{ color: INK }}>{riders} {riders === 1 ? 'rider' : 'riders'} paid</span>
              {unpaidFriends > 0 && !joiner ? (
                <div style={subText}>
                  Plus {unpaidFriends} paying their own. Anyone who has not paid does not board.
                </div>
              ) : null}
            </Row>
          )}
          <Row label="Drop off" last>
            <span style={{ color: INK }}>Downtown train depot, 402 Court St</span>
            <div style={subText}>Pickup only. The ride home is not included, so plan your way back.</div>
          </Row>
        </div>

        {door.zone === BASE_ZONE && (
          <p style={{ ...subText, textAlign: 'center', marginTop: 16 }}>
            Every adult needs a valid military or dependent ID to get on base. Your driver checks.
          </p>
        )}
        <p style={{ marginTop: 16, fontSize: 15, color: GOLD_HI, fontWeight: 700, textAlign: 'center' }}>
          Your $10 also gets you a seat on the Brew Loop that night (21+). Show your ticket when you board.
        </p>

        {groupLink && (
          <CopyJoinLink
            url={groupLink}
            slot={door.slot}
            friends={(door.roster || []).map(f => ({
              name: [f.first_name, f.last_name].filter(Boolean).join(' '),
              phone: f.phone,
              url: `${groupLink}&seat=${f.token}`,
            }))}
          />
        )}

        <div style={{ marginTop: 32 }}>
          <div style={{ color: GOLD, fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            {tickets.length > 1 ? 'Your group’s tickets' : 'Your ticket'}
          </div>
          {tickets.map(t => (
            <div key={t.code} style={ticketRow}>
              <span style={{ color: INK, fontSize: 15 }}>{t.name}</span>
              <a href={`/tickets/${t.code}`} style={goldPill}>Ticket</a>
            </div>
          ))}
          <p style={{ ...subText, marginTop: tickets.length ? 12 : 0 }}>
            {tickets.length
              ? 'We emailed these too. Forward each person their own if you like.'
              : 'Your tickets are on the way to your email. You can also find them on My tickets.'}
          </p>
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <a href={myTicketsHref} style={ghostCta}>My tickets</a>
          </div>
        </div>
      </section>
    </main>
  )
}

function Row({ label, children, last }) {
  return (
    <div style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: last ? 0 : '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ width: 72, flexShrink: 0, color: GOLD, fontSize: 12, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', paddingTop: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, lineHeight: 1.5, color: '#d6d6dc', minWidth: 0 }}>{children}</div>
    </div>
  )
}

// "Friday, October 2"
function formatDay(iso) {
  if (!iso) return ''
  try {
    return new Date(`${iso}T12:00:00-05:00`).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York',
    })
  } catch { return iso }
}

// "between 7:00 PM and 8:00 PM" from "19:00"
function pickupWindow(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  const fmt = hr => `${((hr + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${hr >= 12 ? 'PM' : 'AM'}`
  return `between ${fmt(h)} and ${fmt((h + 1) % 24)}`
}

const checkBadge = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 64, height: 64, borderRadius: '50%', background: 'rgba(212,163,51,0.12)',
  border: `1px solid ${GOLD}`, marginBottom: 16, fontSize: 28, color: GOLD_HI,
}

const doorCard = {
  marginTop: 24, padding: '4px 18px', borderRadius: 16,
  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
}

const subText = { marginTop: 4, fontSize: 14, lineHeight: 1.5, color: '#a9a9b2' }

const ticketRow = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
  padding: '10px 0', borderTop: '1px solid rgba(255,255,255,0.08)',
}

const goldPill = {
  display: 'inline-block', padding: '7px 16px', borderRadius: 999, background: GOLD,
  color: '#0a0a0b', fontWeight: 800, fontSize: 13, textDecoration: 'none',
}

const passCard = {
  marginTop: 36,
  padding: '20px 22px',
  borderRadius: 16,
  textAlign: 'center',
  border: '1px solid rgba(212,163,51,0.35)',
  background: 'rgba(212,163,51,0.08)',
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
