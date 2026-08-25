import { NextResponse } from 'next/server'
import { denyIfNotCron } from '@/lib/cronAuth'
import { syncStripePayments } from '@/lib/syncStripePayments'

// Daily: pull Stripe subscription invoices into sponsor_payments +
// bar_payments, so the Money / Bars / Sponsors pages stop depending on someone
// remembering to press a button. Nobody had since June, and three months of bar
// and sponsor money went missing from every page that reads those tables.
//
// Idempotent by invoice id, so a daily run over a 120-day window re-checks the
// same invoices harmlessly and self-heals any gap shorter than the window.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req) {
  const denied = denyIfNotCron(req)
  if (denied) return denied

  // ?dry=1 reports what it would write without writing it.
  const dryRun = new URL(req.url).searchParams.get('dry') === '1'
  const daysParam = Number(new URL(req.url).searchParams.get('days'))
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 400) : 120

  try {
    const summary = await syncStripePayments({ days, dryRun })
    return NextResponse.json({ ok: true, ...summary })
  } catch (e) {
    // Never 500 into a Vercel retry loop over a Stripe blip.
    return NextResponse.json({ ok: false, error: e.message }, { status: 200 })
  }
}
