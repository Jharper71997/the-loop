import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotLeadership } from '@/lib/routeAuth'
import { toE164 } from '@/lib/smsStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/sms/read  { phone }
// Marks every unread inbound message in one thread as read. Called by the
// thread view when it opens.
export async function POST(req) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  let payload
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const phone = toE164(payload?.phone)
  if (!phone) return Response.json({ error: 'bad_phone' }, { status: 400 })

  const { data, error } = await supabaseAdmin()
    .from('sms_messages')
    .update({ read_at: new Date().toISOString() })
    .eq('contact_phone', phone)
    .eq('direction', 'in')
    .is('read_at', null)
    .select('id')
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, marked: data?.length || 0 })
}
