// Build a weekend of "The Loop" (Marines) — a kind='marines' group + on-sale
// event + the two fixed fares ($10 Single Ride / $20 Day Pass), with the red
// line's stops stored INLINE (name + start_time + lat/lng + on_base) in
// groups.schedule. The Loop is native-only — NO Ticket Tailor.
//
// New route every weekend: edit PLAN below (dates + stops), then run.
// Dry-run by default; pass --apply to write.
//
//   set -a && source /c/Users/jacob/the-loop/.env.local && set +a
//   node scripts/build-marines-weekend.js            # dry run
//   node scripts/build-marines-weekend.js --apply    # actually insert
//
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY (service role).
// Prereq: migration 043 (adds groups/events.kind + loop_boardings) is applied.

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

loadDotEnvIfMissing(path.resolve(__dirname, '..', '.env.local'))

const APPLY = process.argv.includes('--apply')

// The two fares, every weekend. stop_index null routes the rider through the
// existing walk-on pickup picker; capacity null = no per-stop seat cap (the
// driver manages the physical ~13 seats from the manifest).
const FARES = [
  { name: 'Single Ride', price_cents: 1000, stop_index: null, capacity: null, sort_order: 0 },
  { name: 'Day Pass',    price_cents: 2000, stop_index: null, capacity: null, sort_order: 1 },
]

// EDIT EACH WEEKEND. One entry per service day. `schedule` is the red line in
// order — the FIRST stop is the on-base gate (on_base: true). Fill real lat/lng
// for every stop you want pinned on the live map + drawn on the red line; a
// stop with null lat/lng simply has no pin.
const PLAN = [
  {
    date: '2026-07-04',
    label: 'Sat, Jul 4',
    pickup_time: '09:30',
    status: 'on_sale',
    name: 'The Loop — Sat, Jul 4',
    schedule: [
      { name: 'Main Gate', start_time: '09:30', lat: 34.6447, lng: -77.3389, on_base: true },
      { name: 'Downtown', start_time: '10:15', lat: 34.7541, lng: -77.4302, on_base: false },
      { name: 'Mall', start_time: '11:00', lat: 34.7766, lng: -77.3870, on_base: false },
      { name: 'Beach', start_time: '12:00', lat: 34.6260, lng: -77.3870, on_base: false },
    ],
  },
  // Duplicate the block above for Sunday (and any holiday), adjusting date/label.
]

;(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY (service role).')
    console.error('Uncomment SUPABASE_SERVICE_KEY in the-loop/.env.local, then re-run.')
    process.exit(1)
  }
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  console.log(APPLY ? '*** APPLY MODE — writing rows ***' : '--- DRY RUN (no writes) — pass --apply to insert ---')

  for (const step of PLAN) {
    console.log(`\n================ The Loop · ${step.date} (${step.label}) ================`)

    // Guard: skip if this date already has a Marines group with a paired event.
    // Clean up eventless Marines groups left by a prior failed run.
    const { data: destGroups } = await sb.from('groups')
      .select('id').eq('event_date', step.date).eq('kind', 'marines')
    const destIds = (destGroups || []).map(g => g.id)
    if (destIds.length) {
      const { data: destEvents } = await sb.from('events').select('id').in('group_id', destIds)
      if ((destEvents || []).length) {
        console.log(`SKIP — ${step.date} already has a Marines group+event. Not duplicating.`)
        continue
      }
      if (APPLY) {
        const { error: delErr } = await sb.from('groups').delete().in('id', destIds)
        if (delErr) { console.error('failed to clean eventless groups', delErr); continue }
        console.log(`cleaned ${destIds.length} eventless Marines group(s) from a prior run`)
      }
    }

    const groupRow = {
      name: step.name,
      event_date: step.date,
      pickup_time: step.pickup_time || null,
      kind: 'marines',
      schedule: step.schedule || [],
    }
    const eventRow = {
      name: step.name,
      event_date: step.date,
      pickup_time: step.pickup_time || null,
      status: step.status || 'on_sale',
      kind: 'marines',
      // group_id filled after insert
    }

    console.log('GROUP ->', JSON.stringify(groupRow))
    console.log('  EVENT ->', JSON.stringify({ ...eventRow, group_id: '(new group id)' }))
    for (const f of FARES) console.log('    FARE ->', JSON.stringify({ ...f, event_id: '(new event id)' }))

    if (!APPLY) continue

    const { data: insGroup, error: gErr } = await sb.from('groups').insert(groupRow).select().single()
    if (gErr) { console.error('group insert failed', gErr); continue }
    console.log('inserted group', insGroup.id)

    const { data: insEvent, error: eErr } = await sb.from('events')
      .insert({ ...eventRow, group_id: insGroup.id }).select().single()
    if (eErr) { console.error('event insert failed', eErr); continue }
    console.log('  inserted event', insEvent.id)

    const fareRows = FARES.map(f => ({ ...f, event_id: insEvent.id, active: true }))
    const { data: insFares, error: fErr } = await sb.from('ticket_types').insert(fareRows).select()
    if (fErr) console.error('ticket_types insert failed', fErr)
    else console.log(`    inserted ${insFares.length} fares`)
  }
  console.log('\nDone.')
})()

function loadDotEnvIfMissing(envPath) {
  if (!fs.existsSync(envPath)) return
  const txt = fs.readFileSync(envPath, 'utf8')
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const k = line.slice(0, eq).trim()
    if (!k || process.env[k] != null) continue
    let v = line.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    process.env[k] = v
  }
}
