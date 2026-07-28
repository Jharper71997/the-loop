// One-off: build a PRIVATE CHARTER on the Jville Brew Loop (kind='brew').
//
// A private charter = one groups row + one paired events row + TWO custom
// ticket_types (NOT the per-stop model): a single $500 "whole shuttle" seat the
// organizer buys, plus 13 free "guest seat" claim-link seats so every rider
// signs their own waiver. Total charge stays $500; capacity is 14.
//
// Dry-run by default; pass --apply to write to the LIVE Supabase.
//   node scripts/build-charter-jul18.js            # dry run (prints, no writes)
//   node scripts/build-charter-jul18.js --apply    # actually insert
//
// Requires (loaded from ../.env.local): NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_KEY (service role), APP_URL (for the booking link).

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

loadDotEnvIfMissing(path.resolve(__dirname, '..', '.env.local'))
const APPLY = process.argv.includes('--apply')

// ---------------------------------------------------------------------------
// THE CHARTER
// ---------------------------------------------------------------------------
const CHARTER = {
  name: 'Private Charter',
  event_date: '2026-07-18',       // Saturday
  pickup_time: '10:30',           // Voodoo pickup
  status: 'on_sale',              // must be on_sale for the link to be bookable
  kind: 'brew',
  capacity: 14,
  description:
    'Private charter. Pickup at Voodoo, 10:30 AM. Stops: Angry Ginger 11:00, ' +
    'Swansboro Front Street 12:40, Clovehitch 3:45, Topsail Brewing 5:00, then ' +
    'back to Voodoo. The organizer books the whole shuttle and each guest signs ' +
    'their own waiver.',
  // Driver / manifest schedule (single arrival time per stop, 24h HH:MM).
  schedule: [
    { name: 'Voodoo (pickup)',        start_time: '10:30' },
    { name: 'Angry Ginger',           start_time: '11:00' },
    { name: 'Swansboro Front Street', start_time: '12:40' },
    { name: 'Clovehitch',             start_time: '15:45' },
    { name: 'Topsail Brewing',        start_time: '17:00' },
    { name: 'Voodoo (drop-off)',      start_time: '18:00' },
  ],
  // Two custom ticket types. Both tied to stop 0 (Voodoo 10:30) so every rider
  // shows one clean "Voodoo 10:30" pickup and no walk-on picker appears.
  // CAPACITY: leave null. No production event sets a per-ticket capacity, so
  // that code path is unexercised; a null cap skips the count query entirely
  // and matches every working event. The shuttle size is informational only
  // (events.capacity), the organizer self-limits. The $500 is guaranteed
  // because the organizer must book their own "Whole shuttle" seat; guest
  // seats are $0 (Stripe accepts $0 lines when the order total is > 0).
  fares: [
    { name: 'Whole shuttle (organizer)', price_cents: 50000, stop_index: 0, capacity: null, sort_order: 0, active: true },
    { name: 'Guest seat',                price_cents: 0,     stop_index: 0, capacity: null, sort_order: 1, active: true },
  ],
}

function fmtTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = String(hhmm).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suf = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suf}`
}
const usd = c => `$${(c / 100).toFixed(2)}`

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const appUrl = (process.env.APP_URL || 'https://the-loop-eight.vercel.app').replace(/\/$/, '')
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY')

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

  const groupRow = {
    name: CHARTER.name, event_date: CHARTER.event_date,
    pickup_time: CHARTER.pickup_time, kind: CHARTER.kind, schedule: CHARTER.schedule,
  }
  const eventRow = {
    name: CHARTER.name, event_date: CHARTER.event_date, pickup_time: CHARTER.pickup_time,
    status: CHARTER.status, kind: CHARTER.kind, description: CHARTER.description,
    capacity: CHARTER.capacity,
  }

  // ---- print preview ----
  console.log('\n=============================================================')
  console.log(`  PRIVATE CHARTER  ${APPLY ? '(APPLY — writing live)' : '(DRY RUN — no writes)'}`)
  console.log('=============================================================')
  console.log(`  Event      : ${CHARTER.name}`)
  console.log(`  Date       : ${CHARTER.event_date} (Sat) · pickup ${fmtTime(CHARTER.pickup_time)}`)
  console.log(`  Kind       : ${CHARTER.kind}   Status: ${CHARTER.status}   Capacity: ${CHARTER.capacity}`)
  console.log(`  Itinerary  :`)
  CHARTER.schedule.forEach((s, i) => console.log(`     ${i + 1}. ${fmtTime(s.start_time).padStart(8)}  ${s.name}`))
  console.log(`  Tickets    :`)
  CHARTER.fares.forEach(f => console.log(
    `     - ${f.name} — ${fmtTime(CHARTER.schedule[f.stop_index].start_time)} — ${usd(f.price_cents)}  (cap ${f.capacity})`))
  console.log(`  Booking link will be: ${appUrl}/book/<eventId>`)
  console.log('-------------------------------------------------------------')

  // ---- idempotency guard ----
  const { data: dupGroups } = await sb.from('groups').select('id')
    .eq('event_date', CHARTER.event_date).eq('kind', CHARTER.kind).eq('name', CHARTER.name)
  const dupIds = (dupGroups || []).map(g => g.id)
  if (dupIds.length) {
    const { data: dupEvents } = await sb.from('events').select('id').in('group_id', dupIds).limit(1)
    if ((dupEvents || []).length) {
      console.log(`  ⚠  A "${CHARTER.name}" on ${CHARTER.event_date} already exists (event ${dupEvents[0].id}).`)
      console.log(`     Refusing to create a duplicate. Booking link: ${appUrl}/book/${dupEvents[0].id}\n`)
      return
    }
  }

  if (!APPLY) {
    console.log('  Dry run only. Re-run with --apply to create these rows.\n')
    return
  }

  // ---- write: group -> event -> ticket_types ----
  const { data: g, error: gErr } = await sb.from('groups').insert(groupRow).select().single()
  if (gErr) throw new Error(`group insert failed: ${gErr.message}`)

  const { data: e, error: eErr } = await sb.from('events')
    .insert({ ...eventRow, group_id: g.id }).select().single()
  if (eErr) throw new Error(`event insert failed: ${eErr.message}`)

  const fareRows = CHARTER.fares.map(f => ({ ...f, event_id: e.id }))
  const { data: tts, error: fErr } = await sb.from('ticket_types').insert(fareRows).select()
  if (fErr) throw new Error(`ticket_types insert failed: ${fErr.message}`)

  console.log('  ✅ CREATED')
  console.log(`     group_id  : ${g.id}`)
  console.log(`     event_id  : ${e.id}`)
  console.log(`     tickets   : ${tts.length} (${tts.map(t => t.name).join(', ')})`)
  console.log(`\n  >>> SEND THIS LINK TO THE ORGANIZER:`)
  console.log(`      ${appUrl}/book/${e.id}\n`)
}

main().catch(err => { console.error('\n  ❌ ', err.message, '\n'); process.exit(1) })

// ---------------------------------------------------------------------------
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
