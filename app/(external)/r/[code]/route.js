import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /r/<code>
// Public endpoint. Logs the scan and 302s to the QR's target URL with UTM
// params appended.
//
// For `kind='checkin'` codes we deliberately do NOT stamp checked_in_at here
// anymore — that path used to redeem on any scan, which is unsafe now that
// riders carry the QR on their phone (a casual camera-app scan would
// erroneously mark them as boarded). Real check-in goes through
// POST /api/checkin/<code> from the staffed /security scanner. /r/<code>
// for checkin codes just redirects the rider back to their own ticket page.
export async function GET(req, ctx) {
  const { code } = await ctx.params
  const supabase = supabaseAdmin()

  const { data: qr } = await supabase
    .from('qr_codes')
    .select('id, kind, target_url, utm_source, utm_medium, utm_campaign, order_item_id')
    .eq('code', code)
    .maybeSingle()

  if (!qr) {
    return NextResponse.redirect(new URL('/', req.url), 302)
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const ua = req.headers.get('user-agent') || null

  // Fire-and-forget log — don't block the redirect if the insert is slow.
  const logPromise = supabase.from('qr_scans').insert({
    qr_id: qr.id,
    ip_address: ip,
    user_agent: ua,
  })

  if (qr.kind === 'checkin') {
    // If the linked seat has been voided, send the rider home — the ticket
    // page would just render a "this ticket is voided" card, but blocking at
    // /r/ keeps the QR fully dead so a stray scan from a printed-out seat
    // never lands on the boarding pass.
    if (qr.order_item_id) {
      const { data: oi } = await supabase
        .from('order_items')
        .select('voided_at')
        .eq('id', qr.order_item_id)
        .maybeSingle()
      if (oi?.voided_at) {
        await logPromise
        return NextResponse.redirect(new URL('/', req.url), 302)
      }
    }
    await logPromise
    return NextResponse.redirect(new URL(`/tickets/${code}`, req.url), 302)
  }

  const target = new URL(qr.target_url, req.url)
  if (qr.utm_source) target.searchParams.set('utm_source', qr.utm_source)
  if (qr.utm_medium) target.searchParams.set('utm_medium', qr.utm_medium)
  if (qr.utm_campaign) target.searchParams.set('utm_campaign', qr.utm_campaign)
  target.searchParams.set('qr', code)

  await logPromise
  return NextResponse.redirect(target, 302)
}
