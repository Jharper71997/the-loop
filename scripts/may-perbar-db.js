// EXACT per-bar May ridership straight from the app DB (the canonical source).
// Pulls every order_item for May events, maps each to its bar via the ticket
// type / stop, splits native (tt_ticket_id null) vs Ticket Tailor, and excludes
// voided items + unpaid orders. Needs SUPABASE_SERVICE_KEY in .env.local.
//
//   node scripts/may-perbar-db.js
//
// Founder test bookings are flagged (buyer name in FOUNDERS) so you can see them
// separately rather than silently dropping. Writes JSON to Desktop.

const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
if (!KEY) { console.error('SUPABASE_SERVICE_KEY not set in .env.local — add it and re-run.'); process.exit(1) }
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const FOUNDERS = ['jacob harper', 'richard flowers', 'lydia harper', 'alyssa flowers']
function parseBar(name) {
  if (!name) return 'Unknown'
  let t = String(name).split(/\s*[-–—]\s*Pick/i)[0].trim()
  t = t.replace(/^Stop\s*\d+\s*:\s*/i, '')
  if (/^walk/i.test(t)) return 'Walk-on'
  return t.replace(/^HideAway/i, 'Hideaway').replace(/\s+(Lounge|Pub|Tavern)$/i, '').replace(/^The\s+/i, '').trim() || 'Unknown'
}

async function main() {
  const { data: events, error: evErr } = await sb
    .from('events')
    .select('id, name, event_date')
    .gte('event_date', '2026-05-01').lte('event_date', '2026-05-31')
  if (evErr) throw evErr
  const evById = new Map(events.map(e => [e.id, e]))
  console.log(`May events in DB: ${events.length}`)
  if (!events.length) { console.log('No May events — check event_date range.'); return }

  const { data: items, error: itErr } = await sb
    .from('order_items')
    .select('id, tt_ticket_id, stop_index, voided_at, ticket_types(name, stop_index), orders!inner(status, event_id, buyer_name, total_cents, paid_at)')
    .in('orders.event_id', events.map(e => e.id))
    .is('voided_at', null)
  if (itErr) throw itErr

  const paid = items.filter(i => ['paid', 'completed'].includes(i.orders.status))
  const tally = {} // bar -> {tt, native, comp, founder}
  const byNight = {}
  let founderCount = 0
  for (const it of paid) {
    const bar = parseBar(it.ticket_types?.name)
    const ev = evById.get(it.orders.event_id)
    const night = ev ? `${ev.event_date}` : 'unknown'
    const isNative = !it.tt_ticket_id
    const isFounder = isNative && FOUNDERS.includes((it.orders.buyer_name || '').trim().toLowerCase()) && (it.orders.total_cents || 0) === 0
    tally[bar] = tally[bar] || { tt: 0, native: 0, founder: 0 }
    byNight[night] = byNight[night] || { tt: 0, native: 0, founder: 0 }
    if (isFounder) { tally[bar].founder++; byNight[night].founder++; founderCount++; continue }
    if (isNative) { tally[bar].native++; byNight[night].native++ }
    else { tally[bar].tt++; byNight[night].tt++ }
  }

  console.log(`\nPaid order_items (May): ${paid.length} | founder tests flagged: ${founderCount}`)
  console.log(`\nPER BAR (real riders, founder tests excluded):`)
  console.log('bar'.padEnd(16), 'TT', 'Native', 'Total')
  const rows = Object.entries(tally).map(([b, v]) => ({ bar: b, tt: v.tt, native: v.native, total: v.tt + v.native, founder: v.founder }))
    .sort((a, b) => b.total - a.total)
  for (const r of rows) console.log(r.bar.padEnd(16), String(r.tt).padStart(2), '  ', String(r.native).padStart(3), '  ', r.total)
  console.log('\nPER NIGHT:')
  for (const [n, v] of Object.entries(byNight).sort()) console.log(`  ${n}  TT ${v.tt}  native ${v.native}  (founder ${v.founder})`)

  // Native riders by (night, bar) — for merging into the partner report.
  const nativeNightBar = {}
  for (const it of paid) {
    if (it.tt_ticket_id) continue
    const bar = parseBar(it.ticket_types?.name)
    const ev = evById.get(it.orders.event_id); const night = ev ? ev.event_date : 'unknown'
    const isFounder = FOUNDERS.includes((it.orders.buyer_name || '').trim().toLowerCase()) && (it.orders.total_cents || 0) === 0
    if (isFounder) continue
    nativeNightBar[night] = nativeNightBar[night] || {}
    nativeNightBar[night][bar] = (nativeNightBar[night][bar] || 0) + 1
  }
  console.log('\nNATIVE by night+bar:')
  for (const [n, bars] of Object.entries(nativeNightBar).sort()) console.log(`  ${n}: ${Object.entries(bars).map(([b,c])=>`${b} ${c}`).join(', ')}`)

  fs.writeFileSync('C:/Users/jacob/OneDrive/Desktop/brew-loop-may-2026-perbar-db.json', JSON.stringify({ rows, byNight, founderCount }, null, 2))
  console.log('\nWrote brew-loop-may-2026-perbar-db.json to Desktop')
}
main().catch(e => { console.error('ERROR:', e.message || e); process.exit(1) })
