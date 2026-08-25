import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { canCheckIn } from '@/lib/roles'
import { sendPushToContact } from '@/lib/push'
import { lookupBarsByNames } from '@/lib/barsServer'
import { haversineMeters as haversine } from '@/lib/geo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Hybrid "5 minutes away" rider alert.
//
//   GET  /api/shuttle/approaching?event_id=...
//     Server-side detection off the live shuttle pings. Returns the bar the
//     shuttle is actually approaching right now (nearest placed stop, ETA 1–5
//     min, moving, getting closer) + how many riders are waiting there — or
//     { candidate: null }. The driver + security screens poll this and pop a
//     one-tap confirm. Detection is location-based, so going off route still
//     points at the right bar; a human confirms, so a drive-by never auto-fires.
//
//   POST /api/shuttle/approaching  { event_id, stop_index }
//     Confirm — push the heads-up to riders booked to board at that stop who
//     haven't checked in yet.
//
// Auth on both: the door/driver allowlist (same as check-in).

const PING_STALE_MS = 4 * 60 * 1000

async function requireStaff() {
  const cookieStore = await cookies()
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { error: 'unauthenticated', status: 401 }
  if (!canCheckIn(user.email)) return { error: 'forbidden', status: 403 }
  return { user }
}

// Distinct contact_ids booked to board at a stop, paid, not voided, not yet
// checked in. Effective pickup = per-bar ticket's stop_index, else a walk-on's
// chosen pickup_stop_index.
async function waitingContactsAtStop(admin, eventId, stopIndex) {
  const { data: rows } = await admin
    .from('order_items')
    .select('contact_id, stop_index, pickup_stop_index, checked_in_at, voided_at, orders!inner(event_id, status)')
    .eq('orders.event_id', eventId)
    .eq('orders.status', 'paid')
    .is('voided_at', null)
    .is('checked_in_at', null)
  const out = new Set()
  for (const r of rows || []) {
    if (!r.contact_id) continue
    const eff = Number.isInteger(r.stop_index) ? r.stop_index
      : (Number.isInteger(r.pickup_stop_index) ? r.pickup_stop_index : null)
    if (eff === stopIndex) out.add(r.contact_id)
  }
  return [...out]
}

async function loadStops(admin, eventId) {
  const { data: ev } = await admin.from('events').select('group_id').eq('id', eventId).maybeSingle()
  if (!ev?.group_id) return { stops: [], groupId: null }
  const { data: g } = await admin.from('groups').select('schedule').eq('id', ev.group_id).maybeSingle()
  const schedule = Array.isArray(g?.schedule) ? g.schedule : []
  const barLookup = await lookupBarsByNames(admin, schedule.map(s => s?.name).filter(Boolean))
  const stops = schedule
    .map((s, i) => {
      const bar = s?.name ? barLookup.get(s.name) : null
      return { index: i, name: s?.name || `Stop ${i + 1}`, lat: bar?.lat ?? null, lng: bar?.lng ?? null }
    })
    .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
  return { stops, groupId: ev.group_id }
}

export async function GET(req) {
  const auth = await requireStaff()
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status })

  const eventId = new URL(req.url).searchParams.get('event_id')
  if (!eventId) return Response.json({ candidate: null })

  const admin = supabaseAdmin()
  const { stops, groupId } = await loadStops(admin, eventId)
  if (!stops.length) return Response.json({ candidate: null })

  // Latest two pings for this loop — newest first. Two so we can tell whether
  // the shuttle is getting closer to a stop (approaching) vs pulling away.
  let pq = admin
    .from('shuttle_pings')
    .select('lat, lng, speed_mph, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(2)
  if (groupId) pq = pq.eq('group_id', groupId)
  const { data: pings } = await pq
  const now = pings?.[0]
  const prev = pings?.[1]
  if (!now || now.is_active === false) return Response.json({ candidate: null })
  if (Date.now() - Date.parse(now.created_at) > PING_STALE_MS) return Response.json({ candidate: null })

  const speed = Number(now.speed_mph)
  if (!Number.isFinite(speed) || speed <= 5) return Response.json({ candidate: null }) // parked / no speed

  let best = null
  for (const s of stops) {
    const distNow = haversine(now.lat, now.lng, s.lat, s.lng)
    if (!Number.isFinite(distNow) || distNow < 60) continue // already there
    const etaMin = Math.round((distNow / 1609.344 / speed) * 60)
    if (etaMin < 1 || etaMin > 5) continue
    if (prev) {
      const distPrev = haversine(prev.lat, prev.lng, s.lat, s.lng)
      if (Number.isFinite(distPrev) && distNow >= distPrev) continue // not approaching
    }
    if (!best || distNow < best.distNow) best = { stop: s, distNow, etaMin }
  }
  if (!best) return Response.json({ candidate: null })

  const riders = await waitingContactsAtStop(admin, eventId, best.stop.index)
  return Response.json({
    candidate: {
      stop_index: best.stop.index,
      bar_name: best.stop.name,
      eta_min: best.etaMin,
      riders: riders.length,
    },
  })
}

export async function POST(req) {
  const auth = await requireStaff()
  if (auth.error) return Response.json({ ok: false, reason: auth.error }, { status: auth.status })

  let body
  try { body = await req.json() } catch { return Response.json({ ok: false, reason: 'invalid_json' }, { status: 400 }) }
  const eventId = body?.event_id
  const stopIndex = Number(body?.stop_index)
  if (!eventId || !Number.isInteger(stopIndex)) {
    return Response.json({ ok: false, reason: 'bad_params' }, { status: 400 })
  }

  const admin = supabaseAdmin()

  // Bar name for the message.
  let barName = null
  const { data: ev } = await admin.from('events').select('group_id').eq('id', eventId).maybeSingle()
  if (ev?.group_id) {
    const { data: g } = await admin.from('groups').select('schedule').eq('id', ev.group_id).maybeSingle()
    const sched = Array.isArray(g?.schedule) ? g.schedule : []
    barName = sched[stopIndex]?.name || null
  }

  const targets = await waitingContactsAtStop(admin, eventId, stopIndex)
  const msg = barName
    ? `Your Brew Loop shuttle is about 5 minutes from ${barName}. Head outside so you don't miss it.`
    : `Your Brew Loop shuttle is about 5 minutes away. Head outside so you don't miss it.`

  let sent = 0
  for (const cid of targets) {
    try {
      const r = await sendPushToContact(cid, {
        title: '🚐 Shuttle almost there',
        body: msg,
        url: '/my-tickets',
        // One alert per stop — a re-fire coalesces instead of stacking.
        tag: `approach-${eventId}-${stopIndex}`,
      })
      if (r?.sent) sent += r.sent
    } catch (err) {
      console.error('[shuttle/approaching] push failed', cid, err?.message)
    }
  }

  return Response.json({ ok: true, targeted: targets.length, sent })
}
