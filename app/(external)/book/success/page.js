import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const metadata = { title: 'Booked — Jville Brew Loop' }
export const dynamic = 'force-dynamic'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'

// No waiver prompt here, on purpose. `app/api/checkout/route.js` rejects the
// whole order with `unsigned_rider` unless every rider has either signed
// themselves or been signed for by the buyer, so anyone who reaches this page
// has already signed. The one exception is a claim-link friend, and they sign
// at /c/<token> when they claim their seat, not here.
//
// The prompt this replaces was also wrong in practice: for card payments the
// signature is written by the Stripe webhook, which normally lands AFTER the
// browser redirect, so this page read "not signed yet" and told riders to go
// sign a waiver they had signed thirty seconds earlier.
export default async function BookingSuccess({ searchParams }) {
  const params = await searchParams
  const sessionId = params?.session_id

  let firstName = null
  if (sessionId) {
    const sb = supabaseAdmin()
    const { data: order } = await sb
      .from('orders')
      .select('contact_id, contacts ( id, first_name )')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle()
    firstName = order?.contacts?.first_name || null
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
              You&apos;re on the Loop{firstName ? `, ${firstName}` : ''}.
            </h1>
            <p style={{ marginTop: 14, fontSize: 17 }}>
              Your ticket is on its way to your inbox. Check your email for the QR code, or open My Tickets anytime.
            </p>
          </div>

          <div style={{ marginTop: 40, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/my-tickets" style={ghostCta}>My tickets</a>
            <a href="/events" style={ghostCta}>Browse more loops</a>
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
