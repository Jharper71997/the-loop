// Shared Surf City Loop build logic, used by BOTH the CLI seed script
// (scripts/build-surf-weekend.js, CommonJS) and the route-builder API
// (app/api/surf-admin/loops/route.js, ESM via webpack CJS interop) so the two
// paths can't drift. Written as CommonJS for that reason. Pure: the caller
// passes in the Supabase client (service role) — this module never creates one.
//
// A Surf City "loop" = one groups row (kind='surf') + one paired events row
// (kind='surf') + one ticket_types row PER STOP (priced per stop, like Brew
// Loop). Each loop is its own group, so a weekend day can hold several loops
// (day / transition / night) with different bar sets. Stops carry INLINE
// lat/lng (copied from the chosen Surf bar) so the live map resolves without
// fuzzy name matching. Native ticketing only — NO Ticket Tailor.

// Turn builder/PLAN stops into a groups.schedule array (inline coords win) and
// the per-stop ticket_types rows. Returns { schedule, fares }.
function shapeLoop(loop) {
  const stops = Array.isArray(loop?.stops) ? loop.stops : []
  const schedule = stops.map(s => {
    const entry = { name: s.name || s.bar_slug || 'Stop', start_time: s.start_time || null }
    if (Number.isFinite(Number(s.lat)) && Number.isFinite(Number(s.lng))) {
      entry.lat = Number(s.lat)
      entry.lng = Number(s.lng)
    }
    return entry
  })
  const fares = stops.map((s, i) => ({
    name: s.name || s.bar_slug || `Stop ${i + 1}`,
    price_cents: Number.isFinite(Number(s.price_cents)) ? Math.round(Number(s.price_cents)) : 0,
    stop_index: i,
    capacity: Number.isFinite(Number(s.capacity)) ? Math.round(Number(s.capacity)) : null,
    sort_order: i,
    active: true,
  }))
  return { schedule, fares }
}

// Preview rows for one loop (dry-run printing / API validation), no DB writes.
function previewLoop(loop) {
  const { schedule, fares } = shapeLoop(loop)
  const groupRow = {
    name: loop.name,
    event_date: loop.event_date || loop.date || null,
    pickup_time: loop.pickup_time || (schedule[0] && schedule[0].start_time) || null,
    kind: 'surf',
    schedule,
  }
  const eventRow = {
    name: loop.name,
    event_date: groupRow.event_date,
    pickup_time: groupRow.pickup_time,
    status: loop.status || 'draft',
    kind: 'surf',
  }
  return { groupRow, eventRow, fares }
}

// Insert one loop (group -> event -> ticket_types). Returns
// { groupId, eventId, fareCount }. Throws on any insert error.
async function insertLoop(sb, loop) {
  const { groupRow, eventRow, fares } = previewLoop(loop)

  const { data: insGroup, error: gErr } = await sb.from('groups').insert(groupRow).select().single()
  if (gErr) throw new Error(`group insert failed: ${gErr.message}`)

  const { data: insEvent, error: eErr } = await sb.from('events')
    .insert({ ...eventRow, group_id: insGroup.id }).select().single()
  if (eErr) throw new Error(`event insert failed: ${eErr.message}`)

  let fareCount = 0
  if (fares.length) {
    const fareRows = fares.map(f => ({ ...f, event_id: insEvent.id }))
    const { data: insFares, error: fErr } = await sb.from('ticket_types').insert(fareRows).select()
    if (fErr) throw new Error(`ticket_types insert failed: ${fErr.message}`)
    fareCount = (insFares || []).length
  }

  return { groupId: insGroup.id, eventId: insEvent.id, fareCount }
}

// True if a surf group with this (event_date, name) already has a paired event.
// Used by the CLI script for idempotent re-runs.
async function loopExists(sb, eventDate, name) {
  if (!eventDate) return false
  const { data: groups } = await sb.from('groups')
    .select('id').eq('event_date', eventDate).eq('kind', 'surf').eq('name', name)
  const ids = (groups || []).map(g => g.id)
  if (!ids.length) return false
  const { data: events } = await sb.from('events').select('id').in('group_id', ids).limit(1)
  return (events || []).length > 0
}

module.exports = { shapeLoop, previewLoop, insertLoop, loopExists }
