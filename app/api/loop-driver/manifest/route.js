import { isLoopDriver } from '@/lib/loopDriver'
import { getMarinesManifest } from '@/lib/marinesManifest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/loop-driver/manifest?group_id=...  — code-gated (loop_driver cookie).
// Live manifest the driver polls: who's on board / waiting at which stop.
export async function GET(req) {
  if (!(await isLoopDriver())) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }
  const groupId = new URL(req.url).searchParams.get('group_id')
  if (!groupId) return Response.json({ riders: [] })
  try {
    const manifest = await getMarinesManifest(groupId)
    return Response.json(manifest, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return Response.json({ riders: [], error: err?.message || 'manifest_failed' }, { status: 500 })
  }
}
