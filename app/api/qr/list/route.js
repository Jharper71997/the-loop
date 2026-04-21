import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/qr/list
// Returns every QR code with aggregated scan counts (all-time + last 30d)
// and conversion count (scans that led to paid orders).
export async function GET() {
  const admin = supabaseAdmin()

  const { data: codes, error } = await admin
    .from('qr_codes')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  if (!codes?.length) return Response.json({ codes: [] })

  const ids = codes.map(c => c.id)
  const since30 = new Date(Date.now() - 30 * 86400000).toISOString()

  const [allScansRes, recentScansRes, convertedScansRes] = await Promise.all([
    admin.from('qr_scans').select('qr_id').in('qr_id', ids),
    admin.from('qr_scans').select('qr_id').in('qr_id', ids).gte('scanned_at', since30),
    admin.from('qr_scans').select('qr_id').in('qr_id', ids).not('resulting_order_id', 'is', null),
  ])

  const count = rows => {
    const map = new Map()
    for (const r of rows || []) map.set(r.qr_id, (map.get(r.qr_id) || 0) + 1)
    return map
  }
  const allMap = count(allScansRes.data)
  const recentMap = count(recentScansRes.data)
  const convMap = count(convertedScansRes.data)

  const enriched = codes.map(c => ({
    ...c,
    scans_total: allMap.get(c.id) || 0,
    scans_30d: recentMap.get(c.id) || 0,
    conversions: convMap.get(c.id) || 0,
  }))

  return Response.json({ codes: enriched })
}
