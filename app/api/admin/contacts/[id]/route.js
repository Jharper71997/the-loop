import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotLeadership } from '@/lib/routeAuth'
import { normalizePhone } from '@/lib/phone'
import { normalizeEmail } from '@/lib/contacts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/admin/contacts/[id]
// DELETE /api/admin/contacts/[id]
//
// Server-side contact edit / delete using the service-role client. The /admin
// page used to write directly with the anon client, which RLS could silently
// no-op — meaning Jacob's hand-edits never landed. This endpoint sidesteps RLS
// and confirms the write committed by returning the updated row.

export async function PATCH(req, ctx) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const { id } = await ctx.params
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const patch = { updated_at: new Date().toISOString() }
  if (typeof body.first_name === 'string') patch.first_name = body.first_name.trim()
  if (typeof body.last_name === 'string') patch.last_name = body.last_name.trim()
  if (typeof body.phone === 'string') {
    const normalized = normalizePhone(body.phone)
    patch.phone = normalized
  }
  if (typeof body.email === 'string') {
    const normalized = normalizeEmail(body.email)
    patch.email = normalized
  }
  if (typeof body.sms_consent === 'boolean') patch.sms_consent = body.sms_consent

  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('contacts')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    return Response.json(
      { error: `update failed: ${error.message || error.code}`, details: error.details || null },
      { status: 500 }
    )
  }

  return Response.json({ ok: true, contact: data })
}

// POST /api/admin/contacts/[id] with body { group_id }
// Adds the contact to a group as a rider. Idempotent on (group_id, contact_id)
// — returns ok even if they're already in the group.
export async function POST(req, ctx) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const { id } = await ctx.params
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }
  const groupId = body?.group_id
  if (!groupId) return Response.json({ error: 'group_id required' }, { status: 400 })

  const supabase = supabaseAdmin()

  const { data: existing } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('contact_id', id)
    .maybeSingle()
  if (existing) return Response.json({ ok: true, already: true })

  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, contact_id: id })
  if (error) {
    return Response.json(
      { error: `assign failed: ${error.message || error.code}` },
      { status: 500 }
    )
  }
  return Response.json({ ok: true })
}

export async function DELETE(_req, ctx) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const { id } = await ctx.params
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const supabase = supabaseAdmin()

  // Cascade-style cleanup: drop group_members + waiver_signatures first so
  // we don't leave dangling FK references. Orders/order_items reference
  // contact_id with ON DELETE SET NULL, so they'll just lose the linkage.
  await supabase.from('group_members').delete().eq('contact_id', id)
  await supabase.from('waiver_signatures').delete().eq('contact_id', id)

  const { error } = await supabase.from('contacts').delete().eq('id', id)
  if (error) {
    return Response.json(
      { error: `delete failed: ${error.message || error.code}` },
      { status: 500 }
    )
  }
  return Response.json({ ok: true })
}
