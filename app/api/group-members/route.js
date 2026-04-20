import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH /api/group-members?id=...
// Body: { current_stop_index?: int }
export async function PATCH(req) {
  const url = new URL(req.url)
  const id = url.searchParams.get('id')
  if (!id) return Response.json({ error: 'id required' }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'invalid JSON' }, { status: 400 })

  const patch = {}
  if ('current_stop_index' in body) {
    patch.current_stop_index = body.current_stop_index == null ? null : Number(body.current_stop_index)
  }
  if (!Object.keys(patch).length) {
    return Response.json({ error: 'no fields to update' }, { status: 400 })
  }

  const supabase = supabaseAdmin()
  const { error } = await supabase
    .from('group_members')
    .update(patch)
    .eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
