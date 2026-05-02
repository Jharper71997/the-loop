import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { finalizeBooking } from '@/lib/booking'
import { normalizePhone } from '@/lib/phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const RESEND_COOLDOWN_MS = 5 * 60 * 1000

// POST /api/my-tickets/resend
//   body: { order_id, phone }
// Re-verifies that the phone matches the order (buyer_phone or any active
// rider_phone), then re-runs finalizeBooking with force=true so SMS + email
// fan back out even if the dedup window says they were just sent.
//
// Rate-limit: 1 resend per order per 5 minutes (orders.last_resend_at).
export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 })
  }

  const orderId = body?.order_id
  const normPhone = normalizePhone(body?.phone)
  if (!orderId || !normPhone) {
    return Response.json({ error: 'order_id + phone required' }, { status: 400 })
  }

  const sb = supabaseAdmin()

  const { data: order } = await sb
    .from('orders')
    .select('id, status, buyer_phone, last_resend_at, paid_at')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) return Response.json({ error: 'order_not_found' }, { status: 404 })
  if (order.status !== 'paid') {
    return Response.json({ error: 'order_not_paid' }, { status: 409 })
  }

  // Phone match: buyer or any active rider on this order.
  let matched = order.buyer_phone === normPhone
  if (!matched) {
    const { data: riderMatch } = await sb
      .from('order_items')
      .select('id')
      .eq('order_id', orderId)
      .eq('rider_phone', normPhone)
      .is('voided_at', null)
      .limit(1)
    matched = !!(riderMatch && riderMatch.length)
  }
  if (!matched) {
    return Response.json({ error: 'phone_mismatch' }, { status: 403 })
  }

  // Rate-limit per order.
  if (order.last_resend_at) {
    const elapsed = Date.now() - new Date(order.last_resend_at).getTime()
    if (elapsed < RESEND_COOLDOWN_MS) {
      return Response.json({
        error: 'rate_limited',
        retry_after_seconds: Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000),
      }, { status: 429 })
    }
  }

  // Stamp first so a rapid double-tap doesn't double-fire.
  await sb.from('orders').update({ last_resend_at: new Date().toISOString() }).eq('id', orderId)

  let result
  try {
    // Self-serve resend — user explicitly tapped "resend my ticket" so the
    // global skipSms default (true, set 2026-05-02 to silence auto-texts)
    // doesn't apply here. Force=true bypasses the dedup cooldown window.
    result = await finalizeBooking(sb, orderId, { force: true, skipSms: false })
  } catch (err) {
    return Response.json({ error: err?.message || 'resend_failed' }, { status: 500 })
  }

  return Response.json({ ok: true, ...result })
}
