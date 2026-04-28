import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isSecurity } from '@/lib/roles'
import { contactHasSignedCurrent } from '@/lib/waiver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/checkin/<code>
// Called by the staffed /security scanner. Marks order_items.checked_in_at,
// gating on:
//   - the QR exists and is kind='checkin'
//   - the order is paid
//   - the rider's contact has signed the current waiver
// Returns a flat shape the scanner can render as a status card. Never throws
// to the client — failures come back as { ok: false, reason }.
export async function POST(req, ctx) {
  const { code } = await ctx.params

  const cookieStore = await cookies()
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
  const { data: { user } } = await sb.auth.getUser()
  if (!user) {
    return Response.json({ ok: false, reason: 'unauthenticated' }, { status: 401 })
  }
  if (!isSecurity(user.email)) {
    return Response.json({ ok: false, reason: 'forbidden' }, { status: 403 })
  }

  if (!code) {
    return Response.json({ ok: false, reason: 'missing_code' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  const { data: qr } = await admin
    .from('qr_codes')
    .select('id, kind, order_item_id')
    .eq('code', code)
    .maybeSingle()

  if (!qr || qr.kind !== 'checkin' || !qr.order_item_id) {
    return Response.json({ ok: false, reason: 'unknown_code' }, { status: 404 })
  }

  const { data: item } = await admin
    .from('order_items')
    .select(`
      id,
      rider_first_name,
      rider_last_name,
      contact_id,
      checked_in_at,
      checked_in_via,
      voided_at,
      order:orders ( id, status, event:events ( id, name, event_date ) )
    `)
    .eq('id', qr.order_item_id)
    .maybeSingle()

  if (!item) {
    return Response.json({ ok: false, reason: 'unknown_ticket' }, { status: 404 })
  }

  const riderName = [item.rider_first_name, item.rider_last_name]
    .filter(Boolean).join(' ') || 'Rider'
  const eventName = item.order?.event?.name || ''
  const eventDate = item.order?.event?.event_date || null

  if (item.voided_at) {
    return Response.json({
      ok: false,
      reason: 'voided',
      rider_name: riderName,
      event_name: eventName,
      event_date: eventDate,
    })
  }

  if (item.order?.status !== 'paid') {
    return Response.json({
      ok: false,
      reason: 'not_paid',
      rider_name: riderName,
      event_name: eventName,
      event_date: eventDate,
    })
  }

  if (item.checked_in_at) {
    return Response.json({
      ok: false,
      reason: 'already_checked_in',
      rider_name: riderName,
      event_name: eventName,
      event_date: eventDate,
      checked_in_at: item.checked_in_at,
      checked_in_via: item.checked_in_via,
    })
  }

  let waiverSigned = false
  if (item.contact_id) {
    waiverSigned = await contactHasSignedCurrent(admin, item.contact_id)
  }
  if (!waiverSigned) {
    return Response.json({
      ok: false,
      reason: 'waiver_unsigned',
      rider_name: riderName,
      event_name: eventName,
      event_date: eventDate,
      contact_id: item.contact_id,
    })
  }

  const checkedAt = new Date().toISOString()
  const { error: updateErr } = await admin
    .from('order_items')
    .update({
      checked_in_at: checkedAt,
      checked_in_via: 'security_scan',
    })
    .eq('id', item.id)
    .is('checked_in_at', null)

  if (updateErr) {
    return Response.json({
      ok: false,
      reason: 'db_error',
      detail: updateErr.message,
    }, { status: 500 })
  }

  return Response.json({
    ok: true,
    rider_name: riderName,
    event_name: eventName,
    event_date: eventDate,
    checked_in_at: checkedAt,
  })
}
