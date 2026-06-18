import { isLoopAdmin } from '@/lib/loopAdmin'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/loop-security/checkin/<code>
// The Loop (Marines) door scanner. Resolves a checkin QR code -> order_item,
// validates the rider, marks them checked in, and logs a loop_boardings 'board'
// row. Gated by the shared Loop admin code (loop_admin cookie), NOT Supabase
// auth — completely separate from Brew Loop's /admin/security.
//
// Hard product guard: the resolved event must be kind='marines'. A Brew Loop
// ticket scanned here is rejected ('wrong_product') so the two products never
// cross-check-in. There is NO waiver step — Marines has no waivers.
//
// Returns a flat shape the scanner renders as a status card. Never throws to
// the client — failures come back as { ok: false, reason }.
export async function POST(req, ctx) {
  if (!(await isLoopAdmin())) {
    return Response.json({ ok: false, reason: 'forbidden' }, { status: 403 })
  }

  const { code } = await ctx.params
  if (!code) {
    return Response.json({ ok: false, reason: 'missing_code' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // The Loop only issues native QRs (no Ticket Tailor), so we resolve strictly
  // via qr_codes(kind='checkin') -> order_item_id.
  const { data: qr } = await admin
    .from('qr_codes')
    .select('id, kind, order_item_id')
    .eq('code', code)
    .maybeSingle()

  if (qr?.kind !== 'checkin' || !qr.order_item_id) {
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
      ticket_type:ticket_types ( name ),
      order:orders ( id, status, event:events ( id, name, kind, event_date, group_id ) )
    `)
    .eq('id', qr.order_item_id)
    .maybeSingle()

  if (!item) {
    return Response.json({ ok: false, reason: 'unknown_ticket' }, { status: 404 })
  }

  const riderName = [item.rider_first_name, item.rider_last_name]
    .filter(Boolean).join(' ') || 'Rider'
  const passType = item.ticket_type?.name || 'Ride'
  const eventName = item.order?.event?.name || 'The Loop'
  const eventKind = item.order?.event?.kind || null
  const groupId = item.order?.event?.group_id || null

  // Product guard — a Brew Loop code must not check in at a Marines door.
  if (eventKind !== 'marines') {
    return Response.json({
      ok: false,
      reason: 'wrong_product',
      rider_name: riderName,
      pass_type: passType,
      event_name: eventName,
    })
  }

  if (item.voided_at) {
    return Response.json({
      ok: false,
      reason: 'voided',
      rider_name: riderName,
      pass_type: passType,
      event_name: eventName,
    })
  }

  if (item.order?.status !== 'paid') {
    return Response.json({
      ok: false,
      reason: 'not_paid',
      rider_name: riderName,
      pass_type: passType,
      event_name: eventName,
    })
  }

  if (item.checked_in_at) {
    return Response.json({
      ok: false,
      reason: 'already_checked_in',
      rider_name: riderName,
      pass_type: passType,
      event_name: eventName,
      checked_in_at: item.checked_in_at,
    })
  }

  // No waiver check — Marines has none.

  const checkedAt = new Date().toISOString()
  const { error: updateErr } = await admin
    .from('order_items')
    .update({ checked_in_at: checkedAt, checked_in_via: 'loop_door' })
    .eq('id', item.id)
    .is('checked_in_at', null)

  if (updateErr) {
    return Response.json({
      ok: false,
      reason: 'db_error',
      detail: updateErr.message,
    }, { status: 500 })
  }

  // Log the board event for the driver manifest ("on board now"). Best-effort —
  // the check-in already succeeded, so a boarding-log failure shouldn't reject
  // the rider at the door.
  if (groupId) {
    await admin
      .from('loop_boardings')
      .insert({
        group_id: groupId,
        order_item_id: item.id,
        contact_id: item.contact_id || null,
        action: 'board',
        boarded_by_email: 'loop_door',
        stop_index: null,
      })
      .then(() => {}, () => {})
  }

  return Response.json({
    ok: true,
    rider_name: riderName,
    pass_type: passType,
    event_name: eventName,
    checked_in_at: checkedAt,
  })
}
