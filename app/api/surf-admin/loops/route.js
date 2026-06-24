import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { isSurfAdmin } from '@/lib/surfAdmin'
import { insertLoop, shapeLoop } from '@/lib/surfBuild'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Surf City Loop route builder API. Purpose-built for the multi-loop,
// stop-first model — the Surf analog of /api/events but WITHOUT its
// one-event-per-group guard or schedule-derived-from-ticket-types behavior
// (Brew's /api/events stays frozen). A Surf "loop" = one group + one event +
// one ticket_type PER STOP, with stops stored inline (name + start_time +
// lat/lng) in groups.schedule. A weekend day can hold many loops.
//
// Gated by the Surf admin code (isSurfAdmin) — same auth model as Marines.

async function guard() {
  if (!(await isSurfAdmin())) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

// GET — list all Surf loops (each = group + paired event + per-stop fares),
// shaped so the builder can load + edit them. Optional ?upcoming=1 to limit to
// today-or-later.
export async function GET(req) {
  const denied = await guard()
  if (denied) return denied
  const sb = supabaseAdmin()

  const { data: groups, error } = await sb
    .from('groups')
    .select('id, name, event_date, pickup_time, schedule, closed_out_at')
    .eq('kind', 'surf')
    .order('event_date', { ascending: false })
    .order('pickup_time', { ascending: true })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  const ids = (groups || []).map(g => g.id)
  const eventsByGroup = new Map()
  const ttByEvent = new Map()
  if (ids.length) {
    const { data: events } = await sb
      .from('events')
      .select('id, group_id, name, status, pickup_time')
      .in('group_id', ids)
    for (const e of events || []) eventsByGroup.set(e.group_id, e)

    const eventIds = (events || []).map(e => e.id)
    if (eventIds.length) {
      const { data: tts } = await sb
        .from('ticket_types')
        .select('id, event_id, name, price_cents, capacity, stop_index, sort_order, active')
        .in('event_id', eventIds)
        .order('stop_index', { ascending: true })
      for (const tt of tts || []) {
        if (!ttByEvent.has(tt.event_id)) ttByEvent.set(tt.event_id, [])
        ttByEvent.get(tt.event_id).push(tt)
      }
    }
  }

  const loops = (groups || []).map(g => {
    const ev = eventsByGroup.get(g.id) || null
    const sched = Array.isArray(g.schedule) ? g.schedule : []
    const fares = ev ? (ttByEvent.get(ev.id) || []) : []
    // Merge schedule (name/time/coords) + ticket_types (price/capacity) by index.
    const stops = sched.map((s, i) => {
      const tt = fares.find(f => f.stop_index === i) || null
      return {
        name: s?.name || tt?.name || `Stop ${i + 1}`,
        start_time: s?.start_time || '',
        lat: Number.isFinite(Number(s?.lat)) ? Number(s.lat) : null,
        lng: Number.isFinite(Number(s?.lng)) ? Number(s.lng) : null,
        price_cents: tt?.price_cents ?? 0,
        capacity: tt?.capacity ?? null,
        ticket_type_id: tt?.id || null,
        stop_index: i,
      }
    })
    return {
      groupId: g.id,
      eventId: ev?.id || null,
      name: ev?.name || g.name || 'Surf City Loop',
      event_date: g.event_date || null,
      pickup_time: g.pickup_time || ev?.pickup_time || null,
      status: ev?.status || 'draft',
      closedOut: !!g.closed_out_at,
      stops,
    }
  })

  return Response.json({ loops })
}

// POST — create one or more Surf loops. Body: { loops: [ { name, event_date,
// pickup_time, status, stops: [{ name, bar_slug, lat, lng, start_time,
// price_cents, capacity }] } ] }.
export async function POST(req) {
  const denied = await guard()
  if (denied) return denied
  const sb = supabaseAdmin()

  const body = await req.json().catch(() => null)
  const loops = Array.isArray(body?.loops) ? body.loops : (body?.loop ? [body.loop] : [])
  if (!loops.length) return Response.json({ error: 'loops required' }, { status: 400 })

  const created = []
  for (const loop of loops) {
    if (!loop?.name || !(loop.event_date || loop.date)) {
      return Response.json({ error: 'each loop needs name + event_date' }, { status: 400 })
    }
    try {
      created.push(await insertLoop(sb, loop))
    } catch (e) {
      return Response.json({ error: String(e?.message || e), created }, { status: 500 })
    }
  }
  return Response.json({ ok: true, created })
}

// PUT ?group_id= — edit one loop in place. Body: { loop: { name, event_date,
// pickup_time, status, stops:[...] } }. Updates the group (name/date/time +
// inline-coord schedule) and the event (name/date/time/status), then syncs the
// per-stop ticket_types by stop_index: update existing, insert new, retire
// extras (active=false, not deleted, so any sold tickets survive). Writes the
// schedule DIRECTLY — does not derive it from ticket types.
export async function PUT(req) {
  const denied = await guard()
  if (denied) return denied
  const sb = supabaseAdmin()

  const groupId = new URL(req.url).searchParams.get('group_id')
  if (!groupId) return Response.json({ error: 'group_id required' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const loop = body?.loop
  if (!loop) return Response.json({ error: 'loop required' }, { status: 400 })

  // Confirm the group is a surf loop (never touch a brew/marines group).
  const { data: group } = await sb
    .from('groups').select('id, kind').eq('id', groupId).maybeSingle()
  if (!group || group.kind !== 'surf') {
    return Response.json({ error: 'surf loop not found' }, { status: 404 })
  }

  const { schedule, fares } = shapeLoop(loop)
  const eventDate = loop.event_date || loop.date || null
  const pickupTime = loop.pickup_time || (schedule[0] && schedule[0].start_time) || null

  const { error: gErr } = await sb.from('groups').update({
    name: loop.name, event_date: eventDate, pickup_time: pickupTime, schedule,
  }).eq('id', groupId)
  if (gErr) return Response.json({ error: `group_update: ${gErr.message}` }, { status: 500 })

  // Find (or create) the paired event.
  let { data: ev } = await sb
    .from('events').select('id').eq('group_id', groupId).maybeSingle()
  if (!ev) {
    const { data: insEv, error: eErr } = await sb.from('events').insert({
      name: loop.name, event_date: eventDate, pickup_time: pickupTime,
      status: loop.status || 'draft', kind: 'surf', group_id: groupId,
    }).select('id').single()
    if (eErr) return Response.json({ error: `event_insert: ${eErr.message}` }, { status: 500 })
    ev = insEv
  } else {
    const { error: eErr } = await sb.from('events').update({
      name: loop.name, event_date: eventDate, pickup_time: pickupTime,
      status: loop.status || 'draft', updated_at: new Date().toISOString(),
    }).eq('id', ev.id)
    if (eErr) return Response.json({ error: `event_update: ${eErr.message}` }, { status: 500 })
  }

  // Sync ticket_types by stop_index.
  const { data: existing } = await sb
    .from('ticket_types').select('id, stop_index').eq('event_id', ev.id)
  const byIndex = new Map((existing || []).filter(t => t.stop_index != null).map(t => [t.stop_index, t.id]))

  for (const f of fares) {
    const id = byIndex.get(f.stop_index)
    if (id) {
      const { error } = await sb.from('ticket_types').update({
        name: f.name, price_cents: f.price_cents, capacity: f.capacity,
        sort_order: f.sort_order, active: true,
      }).eq('id', id)
      if (error) return Response.json({ error: `tt_update: ${error.message}` }, { status: 500 })
      byIndex.delete(f.stop_index)
    } else {
      const { error } = await sb.from('ticket_types').insert({ ...f, event_id: ev.id })
      if (error) return Response.json({ error: `tt_insert: ${error.message}` }, { status: 500 })
    }
  }
  // Retire any leftover stops beyond the new stop list.
  for (const id of byIndex.values()) {
    await sb.from('ticket_types').update({ active: false }).eq('id', id)
  }

  return Response.json({ ok: true, group_id: groupId, event_id: ev.id })
}

// DELETE ?group_id=[&force=1] — remove a surf loop. Refuses if the loop has
// active paid tickets unless force=1. Deletes orders -> event (ticket_types
// cascade) -> group.
export async function DELETE(req) {
  const denied = await guard()
  if (denied) return denied
  const sb = supabaseAdmin()

  const url = new URL(req.url)
  const groupId = url.searchParams.get('group_id')
  const force = url.searchParams.get('force') === '1'
  if (!groupId) return Response.json({ error: 'group_id required' }, { status: 400 })

  const { data: group } = await sb
    .from('groups').select('id, kind').eq('id', groupId).maybeSingle()
  if (!group || group.kind !== 'surf') {
    return Response.json({ error: 'surf loop not found' }, { status: 404 })
  }

  const { data: ev } = await sb
    .from('events').select('id').eq('group_id', groupId).maybeSingle()

  if (ev?.id && !force) {
    const { data: paidOrders } = await sb
      .from('orders').select('id').eq('event_id', ev.id).eq('status', 'paid')
    const ids = (paidOrders || []).map(o => o.id)
    let active = 0
    if (ids.length) {
      const { count } = await sb.from('order_items')
        .select('id', { count: 'exact', head: true })
        .in('order_id', ids).is('voided_at', null)
      active = count || 0
    }
    if (active > 0) {
      return Response.json({
        error: 'has_paid_orders', paid_active: active,
        message: `${active} active paid ticket(s) on this loop. Void/refund first or call DELETE with force=1.`,
      }, { status: 409 })
    }
  }

  if (ev?.id) {
    await sb.from('orders').delete().eq('event_id', ev.id)
    await sb.from('events').delete().eq('id', ev.id)
  }
  await sb.from('group_members').delete().eq('group_id', groupId)
  await sb.from('groups').delete().eq('id', groupId)

  return Response.json({ ok: true, deleted_group_id: groupId, deleted_event_id: ev?.id || null })
}
