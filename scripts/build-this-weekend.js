// Clone last weekend's Loop (Jun 5 Fri / Jun 6 Sat) into this weekend
// (Jun 12 Fri / Jun 13 Sat) and link the new Ticket Tailor events.
//
// Dry-run by default — prints the rows it WOULD insert. Pass --apply to write.
//
//   set -a && source /c/Users/jacob/the-loop/.env.local && set +a   # or uncomment SUPABASE_SERVICE_KEY
//   node scripts/build-this-weekend.js            # dry run
//   node scripts/build-this-weekend.js --apply    # actually insert
//
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY (service role).

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

loadDotEnvIfMissing(path.resolve(__dirname, '..', '.env.local'))

const APPLY = process.argv.includes('--apply')

// source date -> { dest date, new TT event id, date label for names, optional
// schedule override (Friday's stored schedule had empty stop times — repair it
// to the standard cadence that matches its live TT ticket types). }
const PLAN = [
  {
    from: '2026-06-05', to: '2026-06-12', ttEventId: 'ev_8464460',
    label: 'Fri, Jun 12',
    // Align stop names to this weekend's TT ticket-type names ("Archies Pub",
    // "Hideaway Lounge") so the tt-sync inventory bridge matches by name.
    schedule: [
      { name: 'Angry Ginger', start_time: '19:30' },
      { name: "Shirley V's", start_time: '19:45' },
      { name: 'Unhinged', start_time: '20:00' },
      { name: 'Archies Pub', start_time: '20:15' },
      { name: 'Hideaway Lounge', start_time: '20:35' },
    ],
  },
  {
    from: '2026-06-06', to: '2026-06-13', ttEventId: 'ev_8464461',
    label: 'Sat, Jun 13',
    schedule: [
      { name: 'Angry Ginger', start_time: '19:30' },
      { name: 'Twin Ravens', start_time: '19:45' },
      { name: 'Unhinged', start_time: '20:00' },
      { name: 'Black Rose', start_time: '20:15' },
      { name: 'Hideaway Lounge', start_time: '20:35' },
    ],
  },
]

// Replace the "— Fri, May 29" date suffix with this weekend's label. Splits
// ONLY on the em/en dash separator, never the hyphen in "Loop - Friday Night".
function relabel(name, label) {
  if (!name) return name
  const base = name.replace(/\s*[—–]\s.*$/, '')
  return `${base} — ${label}`
}

const STRIP = new Set(['id', 'created_at', 'updated_at'])
// Carry-over columns on ticket_types that point at last week's TT objects —
// null them so the app re-matches by name against the new TT event.
const NULL_TT_LINKS = new Set(['tt_ticket_type_id', 'tt_ticket_id'])

// Build the per-ticket_type overrides for the clone. Besides repointing
// event_id, rename each stop's ticket_type to the matching schedule stop name
// (by stop_index) so the app's display + the tt-sync name match stay aligned
// with this weekend's TT ticket-type names.
function ttOverrides(t, step, eventId) {
  const ov = { event_id: eventId }
  if (step.schedule && t.stop_index != null && step.schedule[t.stop_index]?.name) {
    ov.name = step.schedule[t.stop_index].name
  }
  return ov
}

function clean(row, overrides = {}) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    if (STRIP.has(k)) continue
    out[k] = NULL_TT_LINKS.has(k) ? null : v
  }
  return { ...out, ...overrides }
}

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
    console.log(`\n================ ${step.from} -> ${step.to}  (TT ${step.ttEventId}) ================`)

    // Guard: bail if this weekend's date already has a group with a paired
    // event. If there are only EVENTLESS groups (leftovers from a failed run),
    // delete them so we don't accumulate duplicate orphans.
    const { data: destGroups } = await sb.from('groups').select('id').eq('event_date', step.to)
    const destIds = (destGroups || []).map(g => g.id)
    if (destIds.length) {
      const { data: destEvents } = await sb.from('events').select('id, group_id').in('group_id', destIds)
      if ((destEvents || []).length) {
        console.log(`SKIP — ${step.to} already has a group+event. Not duplicating.`)
        continue
      }
      if (APPLY) {
        const { error: delErr } = await sb.from('groups').delete().in('id', destIds)
        if (delErr) { console.error('failed to clean eventless groups', delErr); continue }
        console.log(`cleaned ${destIds.length} eventless group(s) from a prior run`)
      }
    }

    // Find the SOURCE group for last week that actually has a paired event.
    const { data: srcGroups } = await sb.from('groups').select('*').eq('event_date', step.from)
    let srcGroup = null
    let srcEvents = []
    for (const g of srcGroups || []) {
      const { data: evs } = await sb.from('events').select('*').eq('group_id', g.id)
      if (evs && evs.length) { srcGroup = g; srcEvents = evs; break }
    }
    if (!srcGroup) { console.error(`No source group+event found for ${step.from}. Skipping.`); continue }

    const groupOverrides = { event_date: step.to, tt_event_id: step.ttEventId, name: relabel(srcGroup.name, step.label) }
    if (step.schedule) groupOverrides.schedule = step.schedule
    const newGroupRow = clean(srcGroup, groupOverrides)
    console.log('GROUP ->', JSON.stringify(newGroupRow))

    if (!APPLY) {
      for (const e of srcEvents) {
        const newEvent = clean(e, { event_date: step.to, group_id: '(new group id)', name: relabel(e.name, step.label) })
        console.log('  EVENT ->', JSON.stringify(newEvent))
        const { data: tts } = await sb.from('ticket_types').select('*').eq('event_id', e.id).order('sort_order')
        for (const t of tts || []) {
          console.log('    TT ->', JSON.stringify(clean(t, ttOverrides(t, step, '(new event id)'))))
        }
      }
      continue
    }

    // APPLY
    const { data: insGroup, error: gErr } = await sb.from('groups').insert(newGroupRow).select().single()
    if (gErr) { console.error('group insert failed', gErr); continue }
    console.log('inserted group', insGroup.id)

    for (const e of srcEvents) {
      const newEvent = clean(e, { event_date: step.to, group_id: insGroup.id, name: relabel(e.name, step.label) })
      const { data: insEvent, error: eErr } = await sb.from('events').insert(newEvent).select().single()
      if (eErr) { console.error('event insert failed', eErr); continue }
      console.log('  inserted event', insEvent.id)

      const { data: tts } = await sb.from('ticket_types').select('*').eq('event_id', e.id).order('sort_order')
      const newTts = (tts || []).map(t => clean(t, ttOverrides(t, step, insEvent.id)))
      if (newTts.length) {
        const { data: insTts, error: tErr } = await sb.from('ticket_types').insert(newTts).select()
        if (tErr) console.error('ticket_types insert failed', tErr)
        else console.log(`    inserted ${insTts.length} ticket_types`)
      }
    }
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
