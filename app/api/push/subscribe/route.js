import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sessionEmail } from '@/lib/routeAuth'
import { isDriver, isSecurity } from '@/lib/roles'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Resolve a boarding-pass code → contact_id. Same shape as /api/chat's
// resolveCode: the unguessable code is the rider's credential, so the contact
// is derived from it server-side and never taken from the request body.
async function contactIdForCode(sb, code) {
  if (!code) return null
  const { data: qr } = await sb
    .from('qr_codes').select('order_item_id, kind').eq('code', code).maybeSingle()
  if (!qr || qr.kind !== 'checkin' || !qr.order_item_id) return null
  const { data: item } = await sb
    .from('order_items').select('contact_id, voided_at').eq('id', qr.order_item_id).maybeSingle()
  if (!item || item.voided_at) return null
  return item.contact_id || null
}

// POST /api/push/subscribe
// Body: { subscription, user_agent?, code?, role? }
//   subscription = { endpoint, keys: { p256dh, auth } } (browser PushSubscription JSON)
//   code  = boarding-pass code, for a rider subscribing from their ticket
//   role  = 'security' | 'driver', for a staff device — honored ONLY if the
//           caller has a verified session carrying that role.
// Upserts so re-subscribing from the same device doesn't duplicate rows.
//
// This route is public because riders are not logged in. That makes every
// field in the body attacker-controlled, so neither `role` nor the contact is
// ever trusted from it: `role` is checked against the session, and the contact
// is resolved from the boarding-pass code. Taking `role` straight off the body
// let anyone enroll as a door device and receive rider names, pickup bars and
// security-chat messages in real time.
export async function POST(req) {
  let body
  try { body = await req.json() } catch { return bad('invalid json') }

  const sub = body?.subscription
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return bad('invalid subscription')

  // A staff role has to be proven, not claimed.
  let role = null
  const wanted = body?.role
  if (wanted === 'security' || wanted === 'driver') {
    const email = await sessionEmail()
    if (!email) return Response.json({ error: 'unauthorized' }, { status: 401 })
    const allowed = wanted === 'security' ? isSecurity(email) : isDriver(email)
    if (!allowed) return Response.json({ error: 'forbidden' }, { status: 403 })
    role = wanted
  }

  const supabase = supabaseAdmin()
  const contactId = role ? null : await contactIdForCode(supabase, body?.code)

  const row = {
    contact_id: contactId,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: body?.user_agent || null,
    role,
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' })
  if (error) {
    console.error('[push/subscribe]', error.message)
    return Response.json({ error: 'could not save subscription' }, { status: 500 })
  }

  return Response.json({ ok: true })
}

function bad(msg) { return Response.json({ error: msg }, { status: 400 }) }
