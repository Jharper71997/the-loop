import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /r/<code>
// Public endpoint. Logs the scan and 302s to the QR's target URL with UTM
// params appended. For `kind='checkin'` with an order_item_id, stamps
// checked_in_at on that order item and redirects to /track?checkin=ok.
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

  if (qr.kind === 'checkin' && qr.order_item_id) {
    await supabase
      .from('order_items')
      .update({
        checked_in_at: new Date().toISOString(),
        checked_in_via: 'qr',
      })
      .eq('id', qr.order_item_id)
      .is('checked_in_at', null)
    await logPromise
    return NextResponse.redirect(new URL('/track?checkin=ok', req.url), 302)
  }

  const target = new URL(qr.target_url, req.url)
  if (qr.utm_source) target.searchParams.set('utm_source', qr.utm_source)
  if (qr.utm_medium) target.searchParams.set('utm_medium', qr.utm_medium)
  if (qr.utm_campaign) target.searchParams.set('utm_campaign', qr.utm_campaign)
  target.searchParams.set('qr', code)

  await logPromise
  return NextResponse.redirect(target, 302)
}
