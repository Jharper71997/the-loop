import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    for (const k of ['name', 'event_date', 'pickup_time', 'description', 'capacity', 'status']) {
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
  }

  return Response.json({ ok: true })
}
