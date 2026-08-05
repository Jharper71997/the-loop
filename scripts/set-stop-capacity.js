// Set the physical per-stop seat cap on every per-bar ticket type of every
// future on_sale event. Ticket types with a null capacity are UNCAPPED — both
// api/checkout/route.js and the /book page skip their capacity check entirely,
// which is how a stop with 12 of 13 seats sold could still sell 10 more.
//
// Only touches ticket types WITH a stop_index (a real bar boarding). Charter
// custom tickets and marines walk-on fares have stop_index null and are left
// alone on purpose — see project_brewloop_private_charter (leave those NULL).
//
// Usage:
//   node scripts/set-stop-capacity.js            # dry run, prints the plan
//   node scripts/set-stop-capacity.js --apply    # writes
//   node scripts/set-stop-capacity.js --cap 13 --apply
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY (or
// SUPABASE_SERVICE_ROLE_KEY). Read from the-loop/.env.local if not already set.

const fs = require('fs')
const path = require('path')

loadDotEnvIfMissing(path.resolve(__dirname, '..', '.env.local'))

const { createClient } = require('@supabase/supabase-js')

function loadDotEnvIfMissing(envPath) {
  if (!fs.existsSync(envPath)) return
  const txt = fs.readFileSync(envPath, 'utf8')
  for (const rawLine of txt.split(/\r?\n/)) {
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

const APPLY = process.argv.includes('--apply')
const capArgIdx = process.argv.indexOf('--cap')
const CAP = capArgIdx >= 0 ? Number(process.argv[capArgIdx + 1]) : 13

if (!Number.isInteger(CAP) || CAP < 1) {
  console.error(`--cap must be a positive integer (got ${process.argv[capArgIdx + 1]})`)
  process.exit(1)
}

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_KEY in env')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

async function main() {
  const sb = supabase()
  const today = new Date().toISOString().slice(0, 10)

  const { data: events, error: evErr } = await sb
    .from('events')
    .select('id, name, event_date, status')
    .gte('event_date', today)
    .eq('status', 'on_sale')
    .order('event_date', { ascending: true })
  if (evErr) throw new Error(`events: ${evErr.message}`)

  if (!events?.length) {
    console.log('No future on_sale events found.')
    return
  }

  const changes = []
  for (const ev of events) {
    const { data: tts, error: ttErr } = await sb
      .from('ticket_types')
      .select('id, name, capacity, stop_index, active')
      .eq('event_id', ev.id)
      .not('stop_index', 'is', null)
      .order('stop_index', { ascending: true })
    if (ttErr) throw new Error(`ticket_types(${ev.id}): ${ttErr.message}`)

    for (const tt of tts || []) {
      if (tt.capacity === CAP) continue
      changes.push({ ev, tt })
    }
  }

  if (!changes.length) {
    console.log(`Every per-stop ticket type on ${events.length} future event(s) is already capped at ${CAP}. Nothing to do.`)
    return
  }

  console.log(`${APPLY ? 'APPLYING' : 'DRY RUN'} — set capacity=${CAP} on ${changes.length} per-stop ticket type(s):\n`)
  for (const { ev, tt } of changes) {
    console.log(`  ${ev.event_date}  ${ev.name}`)
    console.log(`    stop #${tt.stop_index}  ${tt.name}  capacity ${tt.capacity === null ? 'NULL (uncapped)' : tt.capacity} -> ${CAP}`)
  }

  if (!APPLY) {
    console.log('\nRe-run with --apply to write.')
    return
  }

  let written = 0
  for (const { tt } of changes) {
    const { error } = await sb.from('ticket_types').update({ capacity: CAP }).eq('id', tt.id)
    if (error) {
      console.error(`  FAILED ${tt.id} (${tt.name}): ${error.message}`)
      continue
    }
    written++
  }
  console.log(`\nUpdated ${written}/${changes.length} ticket types.`)
  console.log('Verify with: node scripts/audit-capacity.js')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
