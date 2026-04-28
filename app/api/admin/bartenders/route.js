import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/admin/bartenders — full roster (active + inactive) for the admin
// page. Middleware already gates this behind leadership login via the parent
// /admin/leaderboard path; this endpoint is callable from any logged-in admin
// page (it's not in PUBLIC_PREFIXES, so middleware enforces auth).
export async function GET() {
  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('bartenders')
    .select('slug, display_name, bar, qr_image_url, active, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ bartenders: data || [] })
}

// PATCH /api/admin/bartenders — toggle active state.
// Body: { slug, active }
export async function PATCH(req) {
  let body
  try { body = await req.json() } catch { return bad('invalid json') }

  const slug = String(body?.slug || '').trim()
  const active = Boolean(body?.active)
  if (!slug) return bad('slug required')

  const supabase = supabaseAdmin()
  const { error } = await supabase
    .from('bartenders')
    .update({ active })
    .eq('slug', slug)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }
  return Response.json({ ok: true })
}

function bad(msg) {
  return Response.json({ error: msg }, { status: 400 })
}
