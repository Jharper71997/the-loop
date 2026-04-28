import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/push/unsubscribe — body: { endpoint }
export async function POST(req) {
  let body
  try { body = await req.json() } catch { return Response.json({ error: 'invalid json' }, { status: 400 }) }

  const endpoint = String(body?.endpoint || '').trim()
  if (!endpoint) return Response.json({ error: 'endpoint required' }, { status: 400 })

  const supabase = supabaseAdmin()
  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}
