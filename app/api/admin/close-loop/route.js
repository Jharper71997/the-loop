import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotAdmin } from '@/lib/routeAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/close-loop
// Body: { group_id, reopen? }
// Closes out a loop (hides it from the admin "open loops" surfaces) by stamping
// groups.closed_out_at. Pass { reopen: true } to bring it back. Staff-gated.
export async function POST(req) {
  const denied = await denyIfNotAdmin()
  if (denied) return denied

  let body
  try { body = await req.json() } catch { return bad('invalid json') }

  const groupId = String(body?.group_id || '').trim()
  if (!groupId) return bad('group_id required')
  const reopen = body?.reopen === true

  const supabase = supabaseAdmin()
  const { error } = await supabase
    .from('groups')
    .update({ closed_out_at: reopen ? null : new Date().toISOString() })
    .eq('id', groupId)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, closed: !reopen })
}

function bad(msg) {
  return Response.json({ error: msg }, { status: 400 })
}
