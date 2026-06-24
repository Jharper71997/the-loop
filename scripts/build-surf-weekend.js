// Build a weekend of the Surf City Loop (Topsail Island NC) — a SEPARATE
// business from Jville Brew Loop. Surf City runs MULTIPLE loops per service DAY
// (e.g. Fri night; Sat day + transition + night; Sun day). Each loop is its own
// groups row (kind='surf') + paired events row + one ticket_types row PER STOP,
// priced per stop (like Brew Loop). So the PLAN below is an ARRAY OF LOOPS, not
// one entry per day — a single day can hold several loops with different bar
// sets and times.
//
// Native ticketing ONLY — there is NO Ticket Tailor for Surf City (no tt_*
// anything). Per-stop pricing is handled inside lib/surfBuild (one ticket type
// per stop); this script just supplies each stop's price_cents.
//
// New weekend: edit PLAN below (dates + loops + stops), then run.
// Dry-run by default; pass --apply to write.
//
//   set -a && source /c/Users/jacob/the-loop/.env.local && set +a
//   node scripts/build-surf-weekend.js            # dry run (prints, no writes)
//   node scripts/build-surf-weekend.js --apply    # actually insert
//
// Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY (service role).
// Prereq: migration 044 (Surf City surf-kind groups/events) must be applied first.

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const { previewLoop, insertLoop, loopExists } = require('../lib/surfBuild')

loadDotEnvIfMissing(path.resolve(__dirname, '..', '.env.local'))

const APPLY = process.argv.includes('--apply')

// ---------------------------------------------------------------------------
// EDIT EACH WEEKEND. One entry per LOOP (not per day). Each loop:
//   { name, event_date, pickup_time, status, stops: [...] }
// and each stop:
//   { name, bar_slug, lat, lng, start_time, price_cents, capacity }
//
// bar_slug must match a SURF_BARS slug in lib/bars.js:
//   velvet, voodoo, craft-house, tortugas, backyards  (5 confirmed; more pending)
//
// COORDS: lat/lng are UNKNOWN for Topsail right now and are set to null below.
//   >>> ACTION: Jacob must fill REAL coords for every stop (or set them later in
//   the Surf route builder, which rewrites groups.schedule live) before the live
//   map will pin those stops. A null lat/lng stop simply has no pin.
//
// PRICING: price_cents is a PLACEHOLDER ($15.00 = 1500) on every stop.
//   >>> ACTION: Jacob must confirm the real per-stop fare before going on sale.
//
// STATUS: every loop is 'draft' so it's STAGED (not publicly buyable) until
//   reviewed. To make a loop live, change its status to 'on_sale' here and
//   re-run with --apply on a fresh date, OR flip the events row status to
//   'on_sale' in the admin Surf tab after review.
// ---------------------------------------------------------------------------

const PRICE_CENTS = 1500 // PLACEHOLDER per-stop fare ($15) — confirm before on_sale.

// Confirmed Surf City bars (lat/lng null until Jacob provides Topsail coords).
// Helper to build a stop from a confirmed bar slug, keeping coords null + price
// as the shared placeholder.
// NOTE: lat/lng/capacity are intentionally left UNDEFINED (not null) so that
// shapeLoop in lib/surfBuild — which keeps a coord only when Number(x) is finite
// — drops the pin/cap entirely. Passing null would coerce to 0 and wrongly pin
// every stop at (0,0). Set opts.lat/opts.lng once Jacob has real Topsail coords.
function stop(barSlug, name, startTime, opts) {
  return {
    name,
    bar_slug: barSlug,
    lat: opts && opts.lat, // TODO: real Topsail coord (or set via route builder) before live map pins
    lng: opts && opts.lng, // TODO: real Topsail coord
    start_time: startTime,
    price_cents: (opts && opts.price_cents) || PRICE_CENTS, // PLACEHOLDER — confirm
    capacity: opts && opts.capacity,
  }
}

const PLAN = [
  // --- Fri Jul 10 — NIGHT loop (~7:30pm) ---
  // Confirmed stops: Velvet, Backyards, Tortugas.
  // PENDING bars (add when confirmed): Voodoo / Craft House may join the Fri night line.
  {
    name: 'Surf City Loop — Fri Jul 10 · Night',
    event_date: '2026-07-10',
    pickup_time: '19:30',
    status: 'draft',
    stops: [
      stop('velvet', 'Velvet', '19:30'),
      stop('backyards', 'Backyards', '19:50'),
      stop('tortugas', 'Tortugas', '20:10'),
    ],
  },

  // --- Sat Jul 11 — DAY loop (~1pm) ---
  // Confirmed day stops: Voodoo, Craft House.
  {
    name: 'Surf City Loop — Sat Jul 11 · Day',
    event_date: '2026-07-11',
    pickup_time: '13:00',
    status: 'draft',
    stops: [
      stop('voodoo', 'Voodoo', '13:00'),
      stop('craft-house', 'Craft House', '13:25'),
    ],
  },

  // --- Sat Jul 11 — TRANSITION loop (~7:30pm) ---
  // Bridges day into night: Voodoo, Craft House, Backyards, Velvet.
  {
    name: 'Surf City Loop — Sat Jul 11 · Transition',
    event_date: '2026-07-11',
    pickup_time: '19:30',
    status: 'draft',
    stops: [
      stop('voodoo', 'Voodoo', '19:30'),
      stop('craft-house', 'Craft House', '19:50'),
      stop('backyards', 'Backyards', '20:10'),
      stop('velvet', 'Velvet', '20:30'),
    ],
  },

  // --- Sat Jul 11 — NIGHT loop (~9pm) ---
  // Confirmed night stops: Velvet, Backyards, Tortugas.
  {
    name: 'Surf City Loop — Sat Jul 11 · Night',
    event_date: '2026-07-11',
    pickup_time: '21:00',
    status: 'draft',
    stops: [
      stop('velvet', 'Velvet', '21:00'),
      stop('backyards', 'Backyards', '21:20'),
      stop('tortugas', 'Tortugas', '21:40'),
    ],
  },

  // --- Sun Jul 12 — DAY loop (~1pm) ---
  // Sunday daytime line; mirror the Sat day set until Sun-specific bars confirm.
  {
    name: 'Surf City Loop — Sun Jul 12 · Day',
    event_date: '2026-07-12',
    pickup_time: '13:00',
    status: 'draft',
    stops: [
      stop('voodoo', 'Voodoo', '13:00'),
      stop('craft-house', 'Craft House', '13:25'),
    ],
  },
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

    // Idempotency: skip if this date already has a surf group+event with this name.
    const exists = await loopExists(sb, loop.event_date, loop.name)
    if (exists) {
      console.log(`SKIP — a surf loop named "${loop.name}" already exists on ${loop.event_date}. Not duplicating.`)
      continue
    }

    const { groupRow, eventRow, fares } = previewLoop(loop)
    console.log('GROUP ->', JSON.stringify(groupRow))
    console.log('  EVENT ->', JSON.stringify({ ...eventRow, group_id: '(new group id)' }))
    for (const f of fares) console.log('    FARE ->', JSON.stringify({ ...f, event_id: '(new event id)' }))

    if (!APPLY) continue

    try {
      const { groupId, eventId, fareCount } = await insertLoop(sb, loop)
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
