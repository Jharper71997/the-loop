import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// RETIRED. The Loop (Marines) now sells through the standard native-ticketing
// flow: /marines/events -> /marines/book/[eventId] -> /api/checkout, which is
// DoD-ID gated AND waiver-enforcing. This old bare-Stripe fare page (no waiver)
// just forwards to it. File kept only because deletion was blocked here; it's
// safe to `git rm` this whole /marines/ride tree + /api/marines/ride-checkout.
export default function MarinesRideRedirect() {
  redirect('/marines/events')
}
