import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isLoopAdmin } from '@/lib/loopAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/loop-admin/verifications — list military verification requests.
// Gated by the Loop access code (not Brew Loop login).
export async function GET() {
  if (!(await isLoopAdmin())) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = supabaseAdmin()
  const { data, error } = await supabase
    .from('military_verifications')
    .select('id, full_name, email, phone, branch, rank, unit, status, method, note, admin_note, flagged, created_at, reviewed_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ verifications: data || [] })
}
