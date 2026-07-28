export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// RETIRED. This endpoint created ungated, waiver-less bare-Stripe fares for The
// Loop (Marines). Checkout is now the shared /api/checkout (via
// /marines/book/[eventId]) — DoD-ID gated and waiver-enforcing. Refuse here so
// the old path can't be used to bypass verification/waiver. File kept only
// because deletion was blocked; safe to `git rm`.
export async function POST() {
  return Response.json(
    { error: 'gone', message: 'The Loop books through /marines/events now.' },
    { status: 410 }
  )
}
