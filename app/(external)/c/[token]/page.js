import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getCurrentWaiverVersion } from '@/lib/waiver'
import ClaimForm from './ClaimForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Claim your Brew Loop ticket',
  robots: { index: false, follow: false },
}

const GOLD = '#d4a333'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'

export default async function ClaimPage({ params }) {
  const { token } = await params
  const sb = supabaseAdmin()

  const { data: item } = await sb
    .from('order_items')
    .select(`
      id, claim_token, claimed_at, voided_at, contact_id, rider_first_name,
      order:orders ( id, status, buyer_name, event_id ),
      ticket_type:ticket_types ( name )
    `)
    .eq('claim_token', token)
    .maybeSingle()

  if (!item || item.voided_at) {
    return <ClaimMissing message="This claim link isn't valid. Ask the buyer for a fresh link." />
  }

  if (item.claimed_at) {
    return <ClaimMissing message="This claim link has already been used." />
  }

  // Pull the event for the form's date/time display.
  let event = null
  if (item.order?.event_id) {
    const { data } = await sb
      .from('events')
      .select('id, name, event_date, pickup_time')
      .eq('id', item.order.event_id)
      .maybeSingle()
    event = data
  }

  const waiver = await getCurrentWaiverVersion(sb)

  return (
    <main style={{ padding: '24px 16px 48px' }}>
      <div style={{ maxWidth: 540, margin: '0 auto', display: 'grid', gap: 16 }}>
        <header>
          <div style={{
            color: GOLD, fontSize: 11, letterSpacing: '0.22em',
            textTransform: 'uppercase', fontWeight: 700,
          }}>
            Claim your seat
          </div>
          <h1 style={{ color: INK, fontSize: 26, fontWeight: 800, margin: '6px 0 0' }}>
            {item.order?.buyer_name ? `${item.order.buyer_name} bought you a ride.` : 'You’ve got a seat on the Loop.'}
          </h1>
          <p style={{ color: INK_DIM, fontSize: 14, margin: '6px 0 0' }}>
            Fill in your info and sign the waiver — takes 30 seconds. Then you’ll get your own ticket and pickup details.
          </p>
        </header>

        <ClaimForm token={token} event={event} waiver={waiver} />
      </div>
    </main>
  )
}

function ClaimMissing({ message }) {
  return (
    <main style={{ padding: '40px 16px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ color: INK, fontSize: 22, margin: 0 }}>Hmm.</h1>
        <p style={{ color: INK_DIM, fontSize: 15, marginTop: 8 }}>{message}</p>
        <a href="/events" style={{ color: GOLD, fontWeight: 600, textDecoration: 'none' }}>
          Book a seat instead →
        </a>
      </div>
    </main>
  )
}
