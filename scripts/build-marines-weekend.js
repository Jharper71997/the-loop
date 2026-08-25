// Build a weekend of "The Loop" (Marines / Camp Lejeune NC). Rider + admin are a
// Surf-style clone of Brew/Surf, but the FARE MODEL is flat: every Marines loop
// sells the same two walk-on fares (Single Ride $10 / All-Day Pass $20) from
// MARINES_FARES in lib/surfBuild — NOT one ticket per stop like Surf/Brew. Each
// loop is its own groups row (kind='marines') + paired events row + those two
// ticket_types. PLAN below is an ARRAY OF LOOPS. Native ticketing ONLY (no TT).
// Riders must clear DoD-ID verification (/marines/verify) before checkout.
//
// Per-stop shaping is handled by lib/surfBuild (shared with Surf), passing
// kind='marines'. This is the same engine the in-app builder at /loop/builder
// uses, so the two paths produce identical rows — the builder is preferred for
// day-to-day; this script is for bulk/scripted seeding.
//
// New weekend: edit PLAN below (dates + loops + stops), then run.
// Dry-run by default; pass --apply to write.
//
//   set -a && source /c/Users/jacob/the-loop/.env.local && set +a
//   node scripts/build-marines-weekend.js            # dry run (prints, no writes)
//   node scripts/build-marines-weekend.js --apply    # actually insert
//
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY (service role).
// Prereq: migrations 043 (kind='marines') + 045 (marines partner bars) applied.

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { previewLoop, insertLoop, loopExists } = require('../lib/surfBuild')

loadDotEnvIfMissing(path.resolve(__dirname, '..', '.env.local'))

const APPLY = process.argv.includes('--apply')
const KIND = 'marines'

// ---------------------------------------------------------------------------
// EDIT EACH WEEKEND. One entry per LOOP (not per day). Each loop:
//   { name, event_date, pickup_time, status, stops: [...] }
// and each stop:
//   { name, bar_slug, lat, lng, start_time, price_cents, capacity }
//
// bar_slug must match a MARINES_BARS slug in lib/bars.js (PLACEHOLDERS today):
//   dragon-brew, good-times  (confirm the real Camp Lejeune stop list)
//
// COORDS: lat/lng are UNKNOWN right now and left undefined below.
//   >>> ACTION: fill REAL coords per stop (or set them later in the /loop route
//   builder, which rewrites groups.schedule live) before the live map will pin.
//
// PRICING: price_cents is a PLACEHOLDER ($20.00 = 2000) on every stop.
//   >>> ACTION: confirm the real per-stop fare before going on sale.
//
// STATUS: every loop is 'draft' so it's STAGED (not publicly buyable) until
//   reviewed. Flip to 'on_sale' here (fresh date) or in the /loop console.
// ---------------------------------------------------------------------------

const PRICE_CENTS = 2000 // PLACEHOLDER per-stop fare ($20) — confirm before on_sale.

// Build a stop from a partner-bar slug. lat/lng/capacity are left UNDEFINED (not
// null) so shapeLoop in lib/surfBuild drops the pin/cap rather than coercing
// null -> 0 and pinning every stop at (0,0). Set opts.lat/opts.lng once real
// Camp Lejeune coords are known.
function stop(barSlug, name, startTime, opts) {
  return {
    name,
    bar_slug: barSlug,
    lat: opts && opts.lat,
    lng: opts && opts.lng,
    start_time: startTime,
    on_base: !!(opts && opts.on_base), // base gate = the pickup stop
    // price_cents/capacity are IGNORED for Marines — the flat $10/$20 fares come
    // from MARINES_FARES in lib/surfBuild. Kept here only for shape parity.
    price_cents: (opts && opts.price_cents) || PRICE_CENTS,
    capacity: opts && opts.capacity,
  }
}

// New River constant loop (~1hr). Stop 0 = the on-base gate (pickup); the rest
// are town destinations, ranked food/barber/entertainment/tattoo. Coords are the
// geocoded reals from scripts/fix-marines-coords.js. PROVISIONAL — confirm the
// final stop list + exact base pickup with Stephen before flipping to on_sale.
function newRiverLoop(name, date) {
  return {
    name,
    event_date: date,
    pickup_time: '09:30',
    status: 'draft', // STAGED — flip to 'on_sale' here or in the /loop console
    stops: [
      stop('new-river-gate',  'New River Gate',  '09:30', { lat: 34.7286409, lng: -77.4701155, on_base: true }),
      stop('dragon-brew',     "Dragon's Brew",   '09:42', { lat: 34.7623492, lng: -77.4857645 }),
      stop('mario-co',        'Mario & Co',      '09:54', { lat: 34.7458360, lng: -77.3792252 }),
      stop('good-times',      'Good Times',      '10:06', { lat: 34.7435232, lng: -77.3825875 }),
      stop('angry-ginger',    'Angry Ginger',    '10:18', { lat: 34.7794209, lng: -77.4162900 }),
      stop('crush-nutrition', 'Crush Nutrition', '10:30', { lat: 34.7539334, lng: -77.4641163 }),
      stop('cozy-co',         'Cozy Co',         '10:42', { lat: 34.7496607, lng: -77.4324215 }),
    ],
  }
}

const PLAN = [
  newRiverLoop('The Loop — Sat Jul 25', '2026-07-25'),
  newRiverLoop('The Loop — Sun Jul 26', '2026-07-26'),
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

  for (const loop of PLAN) {
    console.log(`\n================ ${loop.name} (${loop.event_date}) ================`)

    // Idempotency: skip if this date already has a marines group+event with this name.
    const exists = await loopExists(sb, loop.event_date, loop.name, KIND)
    if (exists) {
      console.log(`SKIP — a Loop named "${loop.name}" already exists on ${loop.event_date}. Not duplicating.`)
      continue
    }

    const { groupRow, eventRow, fares } = previewLoop(loop, KIND)
    console.log('GROUP ->', JSON.stringify(groupRow))
    console.log('  EVENT ->', JSON.stringify({ ...eventRow, group_id: '(new group id)' }))
    for (const f of fares) console.log('    FARE ->', JSON.stringify({ ...f, event_id: '(new event id)' }))

    if (!APPLY) continue

    try {
      const { groupId, eventId, fareCount } = await insertLoop(sb, loop, KIND)
      console.log('inserted group', groupId)
      console.log('  inserted event', eventId)
      console.log(`    inserted ${fareCount} per-stop fares`)
    } catch (err) {
      console.error('insert failed:', err.message)
      continue
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
