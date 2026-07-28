import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { brandFor, prefixLink } from '@/lib/businessConfig'

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
  const sel = 'contact_id, contacts ( id, first_name ), event:events ( kind )'
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
        </section>
    </main>
  )
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
