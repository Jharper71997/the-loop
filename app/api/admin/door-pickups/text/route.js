import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotAdmin, currentUserEmail } from '@/lib/routeAuth'
import { sendSms } from '@/lib/sms'
import { isOptedOut } from '@/lib/smsStore'
import { joinUrl } from '@/lib/doorPickup'
import { payLinkText, onMyWayText } from '@/lib/doorPickupTexts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/door-pickups/text  { order_id, kind: 'on_my_way' | 'pay_link', token? }
//
// The Loops door pickup card's buttons. Sends through SimpleTexting so the
// text comes from the Brew Loop number (not a crew member's phone) and shows
// in /admin/messages. The message is built here from the order, so the
// client can only choose WHICH canned text goes to WHICH person on the order.
export async function POST(req) {
  const denied = await denyIfNotAdmin()
  if (denied) return denied

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }) }
  const { order_id, kind, token } = body || {}

  const sb = supabaseAdmin()
  const { data: order } = await sb
    .from('orders')
    .select('id, event_id, status, buyer_name, buyer_phone, metadata')
    .eq('id', order_id || '')
    .maybeSingle()
  const door = order?.metadata?.door_pickup
  if (!order || !door) return Response.json({ error: 'not_found' }, { status: 404 })

  let to, text
  if (kind === 'on_my_way') {
    to = order.buyer_phone
    text = onMyWayText(order.buyer_name)
  } else if (kind === 'pay_link') {
    const friend = (door.roster || []).find(f => f.token === token)
    if (!friend) return Response.json({ error: 'not_found' }, { status: 404 })
    to = friend.phone
    text = payLinkText({ friend, organizer: order.buyer_name, slot: door.slot, link: `${joinUrl(order.event_id, door.join_code)}&seat=${friend.token}` })
  } else {
    return Response.json({ error: 'bad_kind' }, { status: 400 })
  }
  if (!to) return Response.json({ error: 'no_phone' }, { status: 400 })
  if (await isOptedOut(sb, to)) return Response.json({ error: 'opted_out', detail: 'This number texted STOP.' }, { status: 409 })

  try {
    const r = await sendSms(to, text, { sentBy: await currentUserEmail() })
    if (r?.skipped) return Response.json({ error: 'unreachable', detail: r.reason || r.skipped }, { status: 409 })
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[door-pickups/text] failed', err?.message || err)
    return Response.json({ error: 'send_failed', detail: 'SimpleTexting rejected the send. Try again.' }, { status: 502 })
  }
}
