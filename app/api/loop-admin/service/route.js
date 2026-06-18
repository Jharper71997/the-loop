import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isLoopAdmin } from '@/lib/loopAdmin'
import { getActiveMarinesLoop } from '@/lib/marinesLoop'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/loop-admin/service — code-gated. The active Marines loop's editable
// route (raw schedule stops, incl. inline lat/lng + on-base flag) and its two
// fares. POST saves edits back.
export async function GET() {
  if (!(await isLoopAdmin())) return Response.json({ error: 'forbidden' }, { status: 403 })

  let loop = null
  try { loop = await getActiveMarinesLoop() } catch {}
  if (!loop?.groupId) return Response.json({ group: null })

  const sb = supabaseAdmin()
  const { data: g } = await sb
    .from('groups')
    .select('id, name, event_date, pickup_time, schedule')
    .eq('id', loop.groupId)
    .maybeSingle()

  let fares = []
  if (loop.eventId) {
    const { data } = await sb
      .from('ticket_types')
      .select('id, name, price_cents, sort_order')
      .eq('event_id', loop.eventId)
      .eq('active', true)
      .order('price_cents', { ascending: true })
    fares = data || []
  }

  return Response.json({
    group: { id: g?.id || loop.groupId, name: g?.name || loop.name, event_date: g?.event_date || loop.eventDate, pickup_time: g?.pickup_time || loop.pickupTime },
    event_id: loop.eventId,
    schedule: Array.isArray(g?.schedule) ? g.schedule : [],
    fares,
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// POST body: { group_id, event_id?, schedule?: [{name,start_time,lat,lng,on_base}], fares?: [{id, price_cents}] }
export async function POST(req) {
  if (!(await isLoopAdmin())) return Response.json({ error: 'forbidden' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'invalid_json' }, { status: 400 }) }

  const groupId = body?.group_id
  if (!groupId) return Response.json({ error: 'group_required' }, { status: 400 })

  const sb = supabaseAdmin()
  const { data: g } = await sb.from('groups').select('kind').eq('id', groupId).maybeSingle()
  if (g?.kind !== 'marines') return Response.json({ error: 'not_marines_group' }, { status: 400 })

  if (Array.isArray(body.schedule)) {
    const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null }
    const schedule = body.schedule.map((s, i) => ({
      name: String(s?.name || `Stop ${i + 1}`).trim() || `Stop ${i + 1}`,
      start_time: s?.start_time ? String(s.start_time).trim() : '',
      lat: num(s?.lat),
      lng: num(s?.lng),
      on_base: !!s?.on_base,
    }))
    const { error } = await sb.from('groups').update({ schedule }).eq('id', groupId)
    if (error) return Response.json({ error: `schedule_update: ${error.message}` }, { status: 500 })
  }

  if (Array.isArray(body.fares) && body.event_id) {
    for (const f of body.fares) {
      if (!f?.id) continue
      const cents = Number(f.price_cents)
      if (!Number.isInteger(cents) || cents < 0) continue
      const { error } = await sb
        .from('ticket_types')
        .update({ price_cents: cents })
        .eq('id', f.id)
        .eq('event_id', body.event_id)
      if (error) return Response.json({ error: `fare_update: ${error.message}` }, { status: 500 })
    }
  }

  return Response.json({ ok: true })
}
