import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { contactHasSignedCurrent } from '@/lib/waiver'

export const metadata = { title: 'Booked — Jville Brew Loop' }
export const dynamic = 'force-dynamic'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const INK_MUTED = '#8a8a90'

export default async function BookingSuccess({ searchParams }) {
  const params = await searchParams
  const sessionId = params?.session_id

  // Look up the order to find the contact + waiver status.
  // If nothing returns (webhook hasn't landed yet, or direct hit on this page),
  // fall back to the generic "check your SMS for the waiver link" copy.
  let contactId = null
  let waiverSigned = false
  let firstName = null

  if (sessionId) {
    const sb = supabaseAdmin()
    const { data: order } = await sb
      .from('orders')
      .select('contact_id, contacts ( id, first_name )')
      .eq('stripe_checkout_session_id', sessionId)
      .maybeSingle()
    if (order?.contact_id) {
      contactId = order.contact_id
      firstName = order.contacts?.first_name || null
      waiverSigned = await contactHasSignedCurrent(sb, contactId)
    }
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
              A confirmation text is on its way with your pickup time and the live tracker link.
            </p>
          </div>

          {!waiverSigned && (
            <div
              style={{
                marginTop: 32,
                padding: '24px 24px 26px',
                borderRadius: 16,
                border: `1px solid ${GOLD}`,
                background: 'linear-gradient(180deg, rgba(212,163,51,0.12), rgba(212,163,51,0.04))',
                boxShadow: '0 20px 50px rgba(212,163,51,0.12)',
              }}
            >
              <div
                style={{
                  color: GOLD,
                  fontSize: 11,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  marginBottom: 10,
                }}
              >
                One more thing &mdash; 30 seconds
              </div>
              <h2 style={{ color: INK, fontSize: 22, margin: '0 0 8px' }}>Sign your liability waiver.</h2>
              <p style={{ color: INK_DIM, margin: '0 0 18px', fontSize: 15 }}>
                Every Loop rider signs one before pickup. Get it out of the way now so the driver can wave you on.
              </p>
              <a
                href={contactId ? `/waiver/${contactId}` : '/waiver'}
                style={{
                  display: 'block',
                  padding: '16px 24px',
                  borderRadius: 12,
                  background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
                  color: '#0a0a0b',
                  fontWeight: 700,
                  fontSize: 16,
                  textDecoration: 'none',
                  textAlign: 'center',
                  boxShadow: '0 10px 30px rgba(212,163,51,0.3)',
                }}
              >
                Sign the waiver &rarr;
              </a>
              {!contactId && (
                <p style={{ color: INK_MUTED, fontSize: 12, marginTop: 12, margin: '12px 0 0', textAlign: 'center' }}>
                  Can&apos;t find your waiver link? Check your confirmation text &mdash; we send it there too.
                </p>
              )}
            </div>
          )}

          {waiverSigned && (
            <div
              style={{
                marginTop: 32,
                padding: '20px 24px',
                borderRadius: 14,
                border: '1px solid rgba(111,191,127,0.3)',
                background: 'rgba(111,191,127,0.06)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <span style={{ fontSize: 22, color: '#6fbf7f' }}>&#10003;</span>
              <div>
                <div style={{ color: INK, fontWeight: 600 }}>Waiver already signed.</div>
                <div style={{ color: INK_DIM, fontSize: 14 }}>You&apos;re fully set. See you at pickup.</div>
              </div>
            </div>
          )}

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
