// Swap Brassa Tacos & Taps in for Archies Pub on the SATURDAY route.
// Jacob, 2026-08-19: "make unhinged fridays and brassas on Saturday ... we
// added brassas tacos and taps in jacksonville". Unhinged was already on the
// Friday route, so only Saturday changes. Archies stays on Fridays, so it
// keeps its Loop slot — it just loses the Saturday 8:00 pickup.
//
// Saturday route after this runs:
//   7:30  Angry Ginger
//   7:45  Twin Ravens
//   8:00  Brassa Tacos & Taps   <-- was Archies Pub
//   8:15  Black Rose
//   8:35  Hideaway Lounge
//
// Touches THREE places, all keyed on stop_index 2 of Saturday brew groups:
//   1. bars               — insert the brassa partner row (idempotent upsert)
//   2. groups.schedule    — the route the live map + driver view read
//   3. ticket_types.name  — what the native /book checkout shows
// The Ticket Tailor side (series es_2345304 default ticket type tt_6649864 +
// the series description) is done separately via the TT API, since TT holds
// the Saturday route in the series defaults rather than per-occurrence.
//
// Dry-run by default — prints the rows it WOULD change. Pass --apply to write.
//
//   node scripts/swap-saturday-brassa.js            # dry run
//   node scripts/swap-saturday-brassa.js --apply    # actually write

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const APPLY = process.argv.includes('--apply')

const OLD_NAME = 'Archies Pub'
const NEW_NAME = 'Brassa Tacos & Taps'
const STOP_INDEX = 2
const FROM_DATE = '2026-08-29' // Jacob 2026-08-25: THIS Saturday only.
// Was '2026-08-19' on the first pass, which also caught the already-run
// 2026-08-22 loop — rewriting a past night's route is rewriting history, so
// the window starts on the night being changed.

// Geocoded 2026-08-19 off the real street address (Nominatim), not guessed —
// the live track map drops a pin from these and a wrong pin sends riders to
// the wrong parking lot. Western Forum shopping center.
const BRASSA_BAR_ROW = {
  slug: 'brassa',
  name: 'Brassa Tacos & Taps',
  status: 'active',
  business: 'brew',
  // Terms not agreed yet — left at 0 so bl-bars does not invoice them for a
  // fee nobody quoted. Set once Jacob and Richard confirm.
  monthly_fee_cents: 0,
  payment_method: 'check',
  address: '4157 Western Blvd Suite 100, Jacksonville, NC 28546',
  lat: 34.7984386,
  lng: -77.4141254,
  contact_phone: '(910) 333-0012',
  blurb: 'Mexican restaurant on Western Boulevard, newest stop on the Loop.',
  notes: 'Added 2026-08-19, takes the Saturday 8:00 p.m. slot from Archies. Confirm payment terms with Richard.',
}

loadDotEnvIfMissing(path.resolve(__dirname, '..', '.env.local'))

function loadDotEnvIfMissing(envPath) {
  if (!fs.existsSync(envPath)) return
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq < 0) continue
    const key = line.slice(0, eq).trim()
    if (!key || process.env[key] != null) continue
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    process.env[key] = val
  }
}

;(async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY (service role).')
    process.exit(1)
  }
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  console.log(APPLY ? '*** APPLY MODE — writing ***' : '--- DRY RUN (no writes) — pass --apply to write ---')

  // ---- 1. partner bar row -------------------------------------------------
  const { data: existing } = await sb.from('bars').select('slug').eq('slug', BRASSA_BAR_ROW.slug).maybeSingle()
  console.log(`\n[bars] ${existing ? 'already present, would refresh' : 'INSERT'} ${BRASSA_BAR_ROW.slug}`)
  console.log('       ' + JSON.stringify(BRASSA_BAR_ROW))
  if (APPLY) {
    const { error } = await sb.from('bars').upsert(BRASSA_BAR_ROW, { onConflict: 'slug' })
    if (error) throw error
  }

  // ---- 2. groups.schedule -------------------------------------------------
  // Saturday groups only. Match on the stop actually sitting at index 2 rather
  // than on the day-of-week, so a Friday group can never be caught by accident.
  const { data: groups, error: gErr } = await sb
    .from('groups')
    .select('id, name, event_date, schedule')
    .eq('kind', 'brew')
    .gte('event_date', FROM_DATE)
    .order('event_date')
  if (gErr) throw gErr

  const targets = []
  for (const g of groups || []) {
    const sched = Array.isArray(g.schedule) ? g.schedule : null
    if (!sched || sched[STOP_INDEX]?.name !== OLD_NAME) continue
    // Friday runs Archies at 20:15, Saturday at 20:00. Only Saturday moves.
    if (sched[STOP_INDEX]?.start_time !== '20:00') continue
    targets.push(g)
  }

  if (!targets.length) {
    console.log('\n[groups] no future Saturday group has "Archies Pub" at stop 2 / 20:00 — nothing to do.')
  }

  for (const g of targets) {
    const next = g.schedule.map((s, i) => (i === STOP_INDEX ? { ...s, name: NEW_NAME } : s))
    console.log(`\n[groups] ${g.event_date}  ${g.id}`)
    console.log('   before: ' + g.schedule.map(s => `${s.start_time} ${s.name}`).join(' | '))
    console.log('   after : ' + next.map(s => `${s.start_time} ${s.name}`).join(' | '))
    if (APPLY) {
      const { error } = await sb.from('groups').update({ schedule: next }).eq('id', g.id)
      if (error) throw error
    }

    // ---- 3. ticket_types on that group's events --------------------------
    const { data: evs, error: eErr } = await sb.from('events').select('id, name').eq('group_id', g.id)
    if (eErr) throw eErr
    for (const ev of evs || []) {
      const { data: tts, error: tErr } = await sb
        .from('ticket_types')
        .select('id, name, stop_index')
        .eq('event_id', ev.id)
        .eq('stop_index', STOP_INDEX)
      if (tErr) throw tErr
      for (const t of tts || []) {
        if (t.name !== OLD_NAME) {
          console.log(`   [ticket_types] SKIP ${t.id} — name is "${t.name}", expected "${OLD_NAME}"`)
          continue
        }
        console.log(`   [ticket_types] ${t.id}  "${t.name}" -> "${NEW_NAME}"`)
        if (APPLY) {
          const { error } = await sb.from('ticket_types').update({ name: NEW_NAME }).eq('id', t.id)
          if (error) throw error
        }
      }
    }
  }

  console.log(APPLY ? '\nDone.' : '\nDry run complete — re-run with --apply to write.')
})().catch(e => { console.error(e); process.exit(1) })
