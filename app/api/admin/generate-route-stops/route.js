import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotLeadership } from '@/lib/routeAuth'
import { generateStopsForEvent } from '@/lib/routeStopLogs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/generate-route-stops?event_id=...
// Idempotent — re-runnable after schedule edits. Driver-filled rows
// (actual_arrival_at != null) are protected from being overwritten.
export async function POST(req) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const url = new URL(req.url)
  const eventId = url.searchParams.get('event_id')
  if (!eventId) {
    return Response.json({ error: 'event_id required' }, { status: 400 })
  }

  const result = await generateStopsForEvent(supabaseAdmin(), eventId)
  if (result.error) {
    return Response.json({ ok: false, ...result }, { status: 400 })
  }
  return Response.json({ ok: true, ...result })
}
