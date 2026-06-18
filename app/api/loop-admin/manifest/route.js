import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isLoopAdmin } from '@/lib/loopAdmin'
import { getActiveMarinesLoop } from '@/lib/marinesLoop'
import { getMarinesManifest } from '@/lib/marinesManifest'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/loop-admin/manifest — code-gated. The dispatch board for the active
// Marines loop, grouped BY STOP. For each stop in the group's inline schedule we
// list:
//   - waiting: paid riders whose pickup_stop_index = this stop AND who are not
//     yet on board (so the driver knows who to expect at each pin)
//   - onBoard: riders currently on board whose latest board action was at this
//     stop (so the driver knows who got on where)
// Riders on board with no recorded stop fall into an "unstopped" bucket on the
// last-known/first stop so they're never lost. getMarinesManifest already
// computes per-rider on_board + pickup, so we reuse it and bucket here.
export async function GET() {
  if (!(await isLoopAdmin())) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  let loop = null
  try { loop = await getActiveMarinesLoop() } catch {}
  if (!loop?.groupId) {
    return Response.json({ group: null }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const sb = supabaseAdmin()

  // Raw inline schedule (names + coords) for the stop list. resolveScheduleStops
  // (in getActiveMarinesLoop) normalizes but loses nothing we need; use loop.stops.
  const stops = Array.isArray(loop.stops) ? loop.stops : []

  // Per-rider manifest: name, pass, pickup_stop_index, on_board, last_stop_index.
  const { riders } = await getMarinesManifest(loop.groupId)

  // Build a per-stop board: waiting (not on board, picked this stop) +
  // on board (boarded, attributed to the stop they last boarded at).
  const perStop = stops.map(s => ({
    index: s.index,
    name: s.name || `Stop ${s.index + 1}`,
    startTime: s.startTime || null,
    onBase: !!s.onBase,
    waiting: [],
    onBoard: [],
  }))
  const byIndex = new Map(perStop.map(s => [s.index, s]))
  // Fallback bucket for riders whose stop index is out of range.
  const stray = { index: null, name: 'Unassigned', startTime: null, onBase: false, waiting: [], onBoard: [] }

  let waitingTotal = 0
  let onBoardTotal = 0

  for (const r of riders) {
    const rider = { name: r.name, pass: r.pass, isDayPass: r.is_day_pass }
    if (r.on_board) {
      onBoardTotal++
      // Attribute an on-board rider to the stop they last boarded at; fall back
      // to their chosen pickup, then to the stray bucket.
      const idx = Number.isInteger(r.last_stop_index) ? r.last_stop_index
        : (Number.isInteger(r.pickup_stop_index) ? r.pickup_stop_index : null)
      const bucket = (idx != null && byIndex.has(idx)) ? byIndex.get(idx) : stray
      bucket.onBoard.push(rider)
    } else {
      waitingTotal++
      const idx = Number.isInteger(r.pickup_stop_index) ? r.pickup_stop_index : null
      const bucket = (idx != null && byIndex.has(idx)) ? byIndex.get(idx) : stray
      bucket.waiting.push(rider)
    }
  }

  const out = [...perStop]
  if (stray.waiting.length || stray.onBoard.length) out.push(stray)

  return Response.json({
    group: { id: loop.groupId, name: loop.name, eventDate: loop.eventDate },
    stops: out,
    totals: { waiting: waitingTotal, onBoard: onBoardTotal, stops: stops.length },
  }, { headers: { 'Cache-Control': 'no-store' } })
}
