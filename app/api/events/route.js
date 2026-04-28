import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotLeadership } from '@/lib/routeAuth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Sync the group's schedule from the event's ticket_types. Each ticket type
// with a stop_index becomes the schedule entry at that index — name comes
// from the ticket type, start_time is preserved if already set in the
// schedule, otherwise left blank for the admin to fill in. Ticket types
// without a stop_index don't add a stop.
async function syncScheduleFromTicketTypes(supabase, eventId) {
  const { data: ev } = await supabase
    .from('events')
    .select('id, group_id, pickup_time')
    .eq('id', eventId)
    .maybeSingle()
  if (!ev?.group_id) return

  const { data: tts } = await supabase
    .from('ticket_types')
    .select('name, stop_index, sort_order')
    .eq('event_id', eventId)
    .eq('active', true)
    .order('stop_index', { ascending: true })

  const stopMap = new Map()
  for (const tt of tts || []) {
    if (tt.stop_index == null || tt.stop_index < 0) continue
    if (!stopMap.has(tt.stop_index)) stopMap.set(tt.stop_index, tt.name)
  }
  if (stopMap.size === 0) return

  const { data: g } = await supabase
    .from('groups')
    .select('schedule')
    .eq('id', ev.group_id)
    .maybeSingle()
  const existing = Array.isArray(g?.schedule) ? g.schedule : []

  const maxIdx = Math.max(...stopMap.keys(), existing.length - 1)
  const next = []
  for (let i = 0; i <= maxIdx; i++) {
    const ttName = stopMap.get(i)
    const prior = existing[i] || {}
    const start = prior.start_time || (i === 0 ? ev.pickup_time : '') || ''
    next.push({
      name: ttName || prior.name || `Stop ${i + 1}`,
      start_time: start,
    })
  }

  await supabase.from('groups').update({ schedule: next }).eq('id', ev.group_id)
}

// POST /api/events
// Body: {
//   event: { name, event_date, pickup_time?, description?, capacity?, status?, create_group? },
//   ticket_types: [ { name, price_cents, stop_index?, capacity?, sort_order? } ]
// }
// Creates the event row, the ticket_types rows, and (optionally) a paired
// groups row so dispatch + manifest views work without manual setup.
export async function POST(req) {
  const body = await req.json().catch(() => null)
  if (!body?.event?.name || !body.event.event_date) {
    return Response.json({ error: 'event.name and event.event_date are required' }, { status: 400 })
  }

  const supabase = supabaseAdmin()

  let groupId = null
  if (body.event.create_group !== false) {
    const { data: group, error: groupErr } = await supabase
      .from('groups')
      .insert({
        name: body.event.name,
        event_date: body.event.event_date,
        pickup_time: body.event.pickup_time || null,
      })
      .select('id')
      .single()
    if (groupErr) return Response.json({ error: `group_insert: ${groupErr.message}` }, { status: 500 })
    groupId = group.id
  }

  const { data: event, error: eventErr } = await supabase
    .from('events')
    .insert({
      name: body.event.name,
      event_date: body.event.event_date,
      pickup_time: body.event.pickup_time || null,
      description: body.event.description || null,
      cover_image_url: body.event.cover_image_url || null,
      capacity: body.event.capacity || null,
      status: body.event.status || 'on_sale',
      group_id: groupId,
    })
    .select('id')
    .single()
  if (eventErr) return Response.json({ error: `event_insert: ${eventErr.message}` }, { status: 500 })

  const tts = (body.ticket_types || []).map((tt, i) => ({
    event_id: event.id,
    name: tt.name,
    price_cents: tt.price_cents,
    capacity: tt.capacity || null,
    stop_index: tt.stop_index ?? null,
    active: tt.active !== false,
    sort_order: tt.sort_order ?? i,
  }))

  if (tts.length) {
    const { error: ttErr } = await supabase.from('ticket_types').insert(tts)
    if (ttErr) return Response.json({ error: `ticket_types_insert: ${ttErr.message}` }, { status: 500 })
  }

  // Initialize the group schedule from the ticket types so admin doesn't have
  // to set it twice. Don't fail the whole event creation if the sync trips.
  try {
    await syncScheduleFromTicketTypes(supabase, event.id)
  } catch (err) {
    console.error('[/api/events POST] syncScheduleFromTicketTypes threw', err)
  }

  return Response.json({ ok: true, event_id: event.id, group_id: groupId })
}

// PUT /api/events/?event_id=...
// Body: { event?: {...patch}, ticket_types?: [{ id?, ...row }] }
// For ticket_types: rows with id are updated; rows without id are inserted;
// existing ticket_types whose ids aren't in the request are left alone (use
// active:false to retire one).
export async function PUT(req) {
  const url = new URL(req.url)
  const eventId = url.searchParams.get('event_id')
  if (!eventId) return Response.json({ error: 'event_id required' }, { status: 400 })

  const body = await req.json().catch(() => null)
  if (!body) return Response.json({ error: 'invalid JSON' }, { status: 400 })

  const supabase = supabaseAdmin()

  if (body.event) {
    const patch = {}
    for (const k of ['name', 'event_date', 'pickup_time', 'description', 'capacity', 'status', 'cover_image_url']) {
      if (k in body.event) patch[k] = body.event[k] || null
    }
    patch.updated_at = new Date().toISOString()
    const { error } = await supabase.from('events').update(patch).eq('id', eventId)
    if (error) return Response.json({ error: `event_update: ${error.message}` }, { status: 500 })
  }

  if (Array.isArray(body.ticket_types)) {
    for (const tt of body.ticket_types) {
      if (tt.id) {
        const patch = {}
        for (const k of ['name', 'price_cents', 'stop_index', 'capacity', 'active', 'sort_order']) {
          if (k in tt) patch[k] = tt[k]
        }
        const { error } = await supabase.from('ticket_types').update(patch).eq('id', tt.id)
        if (error) return Response.json({ error: `ticket_type_update: ${error.message}` }, { status: 500 })
      } else {
        const { error } = await supabase.from('ticket_types').insert({
          event_id: eventId,
          name: tt.name,
          price_cents: tt.price_cents,
          stop_index: tt.stop_index ?? null,
          capacity: tt.capacity || null,
          active: tt.active !== false,
          sort_order: tt.sort_order ?? 0,
        })
        if (error) return Response.json({ error: `ticket_type_insert: ${error.message}` }, { status: 500 })
      }
    }
    // Re-derive the schedule from the now-current ticket types so the
    // dispatch view, public schedule, and admin schedule editor all match.
    // Don't let a sync hiccup (e.g. duplicate group rows) block the actual
    // ticket-type save the admin just made.
    try {
      await syncScheduleFromTicketTypes(supabase, eventId)
    } catch (err) {
      console.error('[/api/events PUT] syncScheduleFromTicketTypes threw', err)
    }
  }

  return Response.json({ ok: true })
}

// DELETE /api/events?event_id=...&force=1
// Hard-deletes an event, its ticket_types (cascade), all linked orders +
// order_items + qr_codes (cascade), waiver signatures tied to those orders
// (cascade), the paired group, and group_members for that group.
//
// Refuses by default if there are any non-voided paid orders — those need to
// be voided/refunded first or pass force=1 to override (audit trail in
// order_items.voided_by survives because cascade nukes the rows).
export async function DELETE(req) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  const url = new URL(req.url)
  const eventId = url.searchParams.get('event_id')
  const force = url.searchParams.get('force') === '1'
  if (!eventId) return Response.json({ error: 'event_id required' }, { status: 400 })

  const supabase = supabaseAdmin()

  // Lookup the event + its paired group so we can clean up groups too.
  const { data: ev, error: evErr } = await supabase
    .from('events')
    .select('id, group_id, name')
    .eq('id', eventId)
    .maybeSingle()
  if (evErr) return Response.json({ error: `lookup: ${evErr.message}` }, { status: 500 })
  if (!ev) return Response.json({ error: 'not_found' }, { status: 404 })

  if (!force) {
    const { data: paidOrders } = await supabase
      .from('orders')
      .select('id')
      .eq('event_id', eventId)
      .eq('status', 'paid')
    const paidOrderIds = (paidOrders || []).map(o => o.id)
    let paidActive = 0
    if (paidOrderIds.length) {
      const { count } = await supabase
        .from('order_items')
        .select('id', { count: 'exact', head: true })
        .in('order_id', paidOrderIds)
        .is('voided_at', null)
      paidActive = count || 0
    }
    if (paidActive > 0) {
      return Response.json({
        error: 'has_paid_orders',
        paid_active: paidActive,
        message: `${paidActive} active paid ticket${paidActive === 1 ? '' : 's'} on this event. Void or refund them first, or call DELETE again with force=1.`,
      }, { status: 409 })
    }
  }

  // 1) Delete every order on this event. order_items, qr_codes, qr_scans, and
  //    waiver_signatures all cascade off orders/order_items.
  const { error: orderErr } = await supabase
    .from('orders')
    .delete()
    .eq('event_id', eventId)
  if (orderErr) return Response.json({ error: `orders_delete: ${orderErr.message}` }, { status: 500 })

  // 2) Delete the event itself. ticket_types cascades.
  const { error: eventDelErr } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId)
  if (eventDelErr) return Response.json({ error: `event_delete: ${eventDelErr.message}` }, { status: 500 })

  // 3) Clean up the paired group + its members.
  if (ev.group_id) {
    await supabase.from('group_members').delete().eq('group_id', ev.group_id)
    await supabase.from('groups').delete().eq('id', ev.group_id)
  }

  return Response.json({ ok: true, deleted_event_id: eventId, deleted_group_id: ev.group_id || null })
}
