import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isLoopDriver } from '@/lib/loopDriver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/loop-driver/board  — code-gated (loop_driver cookie).
// Body: { group_id, order_item_id?, contact_id?, stop_index?, action: 'board'|'alight' }
// Appends a loop_boardings row. The manifest derives "on board now" from the
// latest row per rider, so every board/alight is its own append-only event.
export async function POST(req) {
  if (!(await isLoopDriver())) {
    return Response.json({ ok: false, reason: 'forbidden' }, { status: 403 })
  }

  let body
  try { body = await req.json() } catch {
    return Response.json({ ok: false, reason: 'invalid_json' }, { status: 400 })
  }

  const groupId = body?.group_id
  if (!groupId) return Response.json({ ok: false, reason: 'group_required' }, { status: 400 })

  const action = body?.action === 'alight' ? 'alight' : 'board'
  const admin = supabaseAdmin()

  // Confine the Loop driver to a real Marines group — never let a stray group_id
  // write boardings against a Brew Loop loop.
  const { data: g } = await admin.from('groups').select('kind').eq('id', groupId).maybeSingle()
  if (g?.kind !== 'marines') {
    return Response.json({ ok: false, reason: 'not_marines_group' }, { status: 400 })
  }

  const row = {
    group_id: groupId,
    order_item_id: body.order_item_id || null,
    contact_id: body.contact_id || null,
    stop_index: Number.isInteger(body.stop_index) ? body.stop_index : null,
    action,
  }

  const { error } = await admin.from('loop_boardings').insert(row)
  if (error) {
    return Response.json({ ok: false, reason: 'db_error', detail: error.message }, { status: 500 })
  }
  return Response.json({ ok: true })
}
