import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { brandFor } from '@/lib/businessConfig'
import OpenFeedback from './_components/OpenFeedback'

export const metadata = {
  title: 'How was your ride?',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

// The OPEN feedback link — jvillebrewloop.com/feedback.
//
// /feedback/<token> is the same survey addressed to one rider, minted by the
// morning-after cron. This one is the version a human sends: pasted into a
// group text, printed on a card by the door, hung as a QR on the shuttle. It
// answers to anybody, which is exactly the point — the riders worth hearing
// from include the ones who never scanned a ticket.
//
// What it gives up by being open is attribution: no event, no group, no
// contact. Favourite-stop votes and the Google review ask do not need any of
// that, and /leadership/feedback counts these rows separately so they can never
// inflate the response rate on the addressed survey.
//
// Same light chrome-free shell as the token page, and deliberately outside the
// (external) route group for the same reason: no marketing header, no black
// rider gradient bleeding through a form read one-handed in daylight.

const INK = '#17181b'
const INK_SOFT = '#5c6066'
const GOLD_TEXT = '#8a6510'

export default async function OpenFeedbackPage() {
  const sb = supabaseAdmin()
  const cfg = brandFor('brew')

  // Every bar currently on the route, not one weekend's schedule — this link
  // gets sent days after the ride and reused for weeks, and the route rotates.
  const { data: bars } = await sb
    .from('bars')
    .select('name, status, business')
    .eq('business', 'brew')
    .eq('status', 'active')
    .order('name')

  const barNames = [...new Set((bars || []).map(b => b?.name).filter(Boolean))]

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
          How was the Loop?
        </h1>
        <p style={{ color: INK_SOFT, marginTop: 12, fontSize: 16, lineHeight: 1.55 }}>
          Three taps, about 30 seconds. It decides which bars stay on the route.
        </p>
      </header>

      <OpenFeedback
        bars={barNames}
        firstName=""
        knownEmail=""
        existing={null}
        referralUrl={null}
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
