import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { brandFor } from '@/lib/businessConfig'
import { getOrCreateReferralCode } from '@/lib/riderReferral'
import { appUrl } from '@/lib/stripe'
import FeedbackForm from './FeedbackForm'

export const metadata = {
  title: 'How was your ride?',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

// Post-ride survey. The token is minted per ticket by /api/cron/ride-feedback
// and is the only credential — no login, because a rider who has to sign in to
// leave feedback leaves no feedback.
//
// Deliberately OUTSIDE the (external) route group: that group's layout paints
// the black rider shell and wraps children in the marketing header + footer,
// and this page is a light, chrome-free form the rider lands on once from a
// text. It paints its own opaque white ground so the global dark body never
// shows through.
//
// The bar list comes from the Loop's own schedule, so "favorite stop" is
// answered by tapping a name they recognise instead of typing one.

const INK = '#17181b'
const INK_SOFT = '#5c6066'
const GOLD_TEXT = '#8a6510'

export default async function FeedbackPage({ params }) {
  const { token } = await params
  const sb = supabaseAdmin()

  const { data: item } = await sb
    .from('order_items')
    .select('id, order_id, contact_id, rider_first_name, rider_email, rider_phone')
    .eq('feedback_token', String(token || '').toUpperCase())
    .maybeSingle()

  if (!item) return <Shell><Expired /></Shell>

  const { data: order } = await sb
    .from('orders')
    .select('id, event_id, buyer_name, buyer_email, buyer_phone')
    .eq('id', item.order_id)
    .maybeSingle()

  const { data: event } = order?.event_id
    ? await sb.from('events').select('id, name, event_date, kind, group_id').eq('id', order.event_id).maybeSingle()
    : { data: null }

  const { data: group } = event?.group_id
    ? await sb.from('groups').select('id, name, schedule').eq('id', event.group_id).maybeSingle()
    : { data: null }

  const { data: existing } = await sb
    .from('ride_feedback')
    .select('rating, driver_rating, bars_rating, timing_rating, favorite_bar, ride_again, comment, group_type, heard_about, interests, email, marketing_opt_in')
    .eq('order_item_id', item.id)
    .maybeSingle()

  const bars = Array.isArray(group?.schedule)
    ? [...new Set(group.schedule.map(s => s?.name).filter(Boolean))]
    : []

  const firstName = item.rider_first_name || order?.buyer_name?.split(' ')?.[0] || ''
  const knownEmail = item.rider_email || order?.buyer_email || ''
  const cfg = brandFor(event?.kind)

  // Referral link for the thank-you screen. Leaderboard standing only — never a
  // discount (see lib/riderReferral).
  let referralUrl = null
  if (item.contact_id) {
    const code = await getOrCreateReferralCode(sb, item.contact_id)
    if (code) referralUrl = `${appUrl()}/invite/${code}`
  }

  return (
    <Shell>
      <header style={{ marginBottom: 34 }}>
        <div style={{
          color: GOLD_TEXT, fontSize: 12, letterSpacing: '0.16em',
          textTransform: 'uppercase', fontWeight: 700, marginBottom: 14,
        }}>
          {cfg.brand}
        </div>
        <h1 style={{
          color: INK, fontSize: 30, lineHeight: 1.12, margin: 0,
          fontWeight: 700, letterSpacing: '-0.025em',
        }}>
          {firstName ? `${firstName}, how was the Loop?` : 'How was the Loop?'}
        </h1>
        <p style={{ color: INK_SOFT, marginTop: 12, fontSize: 16, lineHeight: 1.55 }}>
          Three taps, about 30 seconds. It decides which bars stay on the route.
        </p>
      </header>

      <FeedbackForm
        token={String(token).toUpperCase()}
        bars={bars}
        firstName={firstName}
        knownEmail={knownEmail}
        existing={existing || null}
        referralUrl={referralUrl}
        googleReviewUrl={process.env.GOOGLE_REVIEW_URL || ''}
        brand={cfg.shortBrand}
      />
    </Shell>
  )
}

// Opaque white ground. globals.css paints body with the dark rider gradient,
// so this has to cover the viewport rather than sit transparently on top.
function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: '#fff',
      colorScheme: 'light',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, sans-serif',
    }}>
      <main style={{
        maxWidth: 480,
        margin: '0 auto',
        padding: '44px 22px calc(64px + env(safe-area-inset-bottom))',
      }}>
        {children}
      </main>
    </div>
  )
}

function Expired() {
  return (
    <div style={{ paddingTop: 40 }}>
      <h1 style={{ color: INK, fontSize: 26, margin: '0 0 10px', fontWeight: 700, letterSpacing: '-0.02em' }}>
        This link has expired
      </h1>
      <p style={{ color: INK_SOFT, fontSize: 16, lineHeight: 1.55, margin: 0 }}>
        Feedback links are tied to one ride. If you think this is a mistake, text us at (636) 266-1801.
      </p>
    </div>
  )
}
