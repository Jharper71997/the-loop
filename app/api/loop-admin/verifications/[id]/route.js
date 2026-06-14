import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isLoopAdmin } from '@/lib/loopAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/loop-admin/verifications/[id]
//   body may include any of:
//     action: 'approve' | 'reject'   — approve flips contacts.military_verified
//     admin_note: string             — internal staff note
//     flagged: boolean               — internal flag (VIP / watch / banned)
// Gated by the Loop access code.
export async function POST(req, ctx) {
  if (!(await isLoopAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401 })

  const { id } = await ctx.params
  if (!id) return Response.json({ error: 'missing_id' }, { status: 400 })

  let body = {}
  try { body = await req.json() } catch {}
  const { action } = body
  const hasNote = Object.prototype.hasOwnProperty.call(body, 'admin_note')
  const hasFlag = Object.prototype.hasOwnProperty.call(body, 'flagged')
  if (!action && !hasNote && !hasFlag) {
    return Response.json({ error: 'nothing to update' }, { status: 400 })
  }
  if (action && !['approve', 'reject'].includes(action)) {
    return Response.json({ error: 'action must be approve or reject' }, { status: 400 })
  }

  const supabase = supabaseAdmin()
  const { data: v, error: readErr } = await supabase
    .from('military_verifications')
    .select('id, contact_id, branch')
    .eq('id', id)
    .maybeSingle()
  if (readErr) return Response.json({ error: readErr.message }, { status: 500 })
  if (!v) return Response.json({ error: 'not found' }, { status: 404 })

  const now = new Date().toISOString()
  const patch = {}
  if (action) { patch.status = action === 'approve' ? 'approved' : 'rejected'; patch.reviewed_at = now }
  if (hasNote) patch.admin_note = body.admin_note || null
  if (hasFlag) patch.flagged = !!body.flagged

  const { error: upErr } = await supabase.from('military_verifications').update(patch).eq('id', id)
  if (upErr) return Response.json({ error: upErr.message }, { status: 500 })

  if (action && v.contact_id) {
    const cPatch = action === 'approve'
      ? { military_verified: true, military_verified_at: now, military_branch: v.branch || null }
      : { military_verified: false }
    const { error: cErr } = await supabase.from('contacts').update(cPatch).eq('id', v.contact_id)
    if (cErr) return Response.json({ error: cErr.message }, { status: 500 })
  }

  return Response.json({ ok: true, status: patch.status, flagged: patch.flagged })
}
