import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/push/subscribe
// Body: { contact_id, subscription, user_agent? }
//   subscription = { endpoint, keys: { p256dh, auth } } (browser PushSubscription JSON)
// Upserts the subscription so re-subscribing from the same device doesn't
// duplicate rows.
export async function POST(req) {
  let body
  try { body = await req.json() } catch { return bad('invalid json') }

  const contactId = body?.contact_id || null
  const sub = body?.subscription
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return bad('invalid subscription')

  const row = {
    contact_id: contactId,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: body?.user_agent || null,
  }

  const supabase = supabaseAdmin()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}

function bad(msg) { return Response.json({ error: msg }, { status: 400 }) }
