import { NextResponse } from 'next/server'
import { denyIfNotLeadership } from '@/lib/routeAuth'
import { syncStripePayments } from '@/lib/syncStripePayments'

// The Sync Stripe button. The logic it used to carry inline now lives in
// lib/syncStripePayments.js, because the same job also needs to run on a
// schedule — this route being the only way to run it is exactly why three
// months of bar and sponsor payments never reached the database.
//
// See app/api/cron/sync-payments/route.js for the daily run.

export async function POST(req) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  let dryRun = false
  let days = 120
  try {
    const body = await req.json()
    dryRun = body?.dryRun === true
    if (Number.isFinite(body?.days) && body.days > 0) days = Math.min(body.days, 400)
  } catch {
    // No body is the normal case for the button.
  }

  try {
    const summary = await syncStripePayments({ days, dryRun })
    return NextResponse.json({ ok: true, ...summary })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
