import { denyIfNotLeadership } from '@/lib/routeAuth'
import { sendPushToContact } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/push-broadcast
// Body: { contact_id, title, body, url? }
// Sends a push to a single contact's subscribed devices. Called per-recipient
// from BroadcastModal so the loop can interleave SMS + push and surface
// per-recipient errors. Middleware gates this behind /admin auth.
// Authorize in-route rather than trusting the middleware path prefix.
// Sends a push to riders' devices.
// Middleware is a single regex away from not covering this path, and the
// handler below uses the service role, so it must not be the only gate.
export async function POST(req) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  let payload
  try { payload = await req.json() } catch { return Response.json({ error: 'invalid json' }, { status: 400 }) }

  const contactId = payload?.contact_id
  if (!contactId) return Response.json({ error: 'contact_id required' }, { status: 400 })

  const result = await sendPushToContact(contactId, {
    title: payload?.title || 'Brew Loop',
    body: payload?.body || '',
    url: payload?.url || '/my-tickets',
    tag: payload?.tag,
  })
  return Response.json(result)
}
