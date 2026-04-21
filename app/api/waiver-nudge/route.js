import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { textUnsignedForGroup, textUnsignedContact } from '@/lib/waiver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/waiver-nudge
//   { group_id }    -> texts every unsigned rider on that Loop
//   { contact_id }  -> texts one rider
//
// Admin-only via middleware.js (any path outside PUBLIC_PATHS requires a
// Supabase session). Dedup is enforced inside lib/waiver.js (24h window)
// unless { force: true } is passed.
export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const admin = supabaseAdmin()
  const force = !!body.force

  if (body.group_id) {
    const results = await textUnsignedForGroup(admin, body.group_id, { force })
    const sent = results.filter(r => r.sent).length
    return Response.json({ ok: true, sent, total: results.length, results })
  }

  if (body.contact_id) {
    const { data: contact } = await admin
      .from('contacts')
      .select('id, first_name, phone, has_signed_waiver, waiver_sms_sent_at, waiver_sms_count')
      .eq('id', body.contact_id)
      .maybeSingle()
    if (!contact) return Response.json({ error: 'contact not found' }, { status: 404 })
    const r = await textUnsignedContact(admin, contact, { force })
    return Response.json({ ok: true, ...r })
  }

  return Response.json({ error: 'group_id or contact_id required' }, { status: 400 })
}
