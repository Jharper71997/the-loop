// EXACT per-bar ridership for ANY month, straight from the app DB (canonical source).
// Generalizes may-perbar-db.js (which was hardcoded to May 2026) so the partner-report
// agent can run one command per month instead of re-deriving the query every time.
//
//   node scripts/perbar-db.js 2026-07                    # Jville Brew (default)
//   node scripts/perbar-db.js 2026-07 --kind surf         # Surf City Loop
//   node scripts/perbar-db.js 2026-07 --json              # print only the JSON path
//
// Counts paid, non-voided order_items (one item = one seat, per the seat-attribution
// rule: a group buy's unnamed seats belong to the buyer). Founder test bookings are
// flagged, not silently dropped. Also tallies the PRIOR month so the report can show
// direction per bar without a second run.
//
// Only counts events of the chosen --kind. The events table holds all four Loop
// businesses and blending them yields a per-bar report for a business that does not exist.
//
// Writes: C:/Users/jacob/agent-ops/reports/.perbar-<kind>-<YYYY-MM>.json

const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
if (!KEY) { console.error('SUPABASE_SERVICE_KEY not set in .env.local'); process.exit(1) }
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const QUIET = process.argv.includes('--json')
const say = (...a) => { if (!QUIET) console.log(...a) }

const arg = process.argv[2]
if (!/^\d{4}-\d{2}$/.test(arg || '')) {
  console.error('Usage: node scripts/perbar-db.js <YYYY-MM> [--kind brew|surf|marines] [--json]')
  process.exit(1)
}

// The events table holds all four businesses. Jville Brew, Surf City, and the Marines
// Loop each run their own bars, so blending them produces a per-bar report for a
// business that does not exist. July 2026 was 10 brew + 5 surf + 2 marines events.
const ki = process.argv.indexOf('--kind')
const KIND = ki > -1 ? process.argv[ki + 1] : 'brew'
if (!['brew', 'surf', 'marines'].includes(KIND)) {
  console.error(`Unknown --kind "${KIND}". Use brew, surf, or marines.`)
  process.exit(1)
}

// Month bounds as plain date strings (event_date is a date column, no TZ math).
function bounds(ym) {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()   // day 0 of next month = last day of this one
  return { start: `${ym}-01`, end: `${ym}-${String(last).padStart(2, '0')}` }
}
function priorMonth(ym) {
  const [y, m] = ym.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

const FOUNDERS = ['jacob harper', 'richard flowers', 'lydia harper', 'alyssa flowers']

// Ticket type names carry the bar ("Stop 2: Hideaway Lounge - Pickup"). Normalize to a
// stable display name so the same bar doesn't split across spellings between months.
function parseBar(name) {
  if (!name) return 'Unknown'
  let t = String(name).split(/\s*[-\u2013\u2014]\s*Pick/i)[0].trim()
  t = t.replace(/^Stop\s*\d+\s*:\s*/i, '')
  if (/^walk/i.test(t)) return 'Walk-on'
  return t.replace(/^HideAway/i, 'Hideaway').replace(/\s+(Lounge|Pub|Tavern)$/i, '').replace(/^The\s+/i, '').trim() || 'Unknown'
}

async function tallyMonth(ym) {
  const { start, end } = bounds(ym)
  const { data: events, error: evErr } = await sb
    .from('events').select('id, name, event_date, group_id, kind')
    .eq('kind', KIND)
    .gte('event_date', start).lte('event_date', end)
  if (evErr) throw evErr
  if (!events.length) return { month: ym, events: 0, rows: [], byNight: {}, founderCount: 0, totalSeats: 0, unresolved: 0 }

  const evById = new Map(events.map(e => [e.id, e]))

  // Ticket Tailor items have NO ticket_type (ticket_type_id is null) but they DO
  // carry stop_index, which indexes into that night's groups.schedule. Without this
  // every TT rider fell into "Unknown" and vanished from the partner reports.
  // The route rotates weekend to weekend, so the schedule must be read per event.
  const groupIds = [...new Set(events.map(e => e.group_id).filter(Boolean))]
  const scheduleByGroup = new Map()
  if (groupIds.length) {
    const { data: groups } = await sb.from('groups').select('id, schedule').in('id', groupIds)
    for (const g of (groups || [])) scheduleByGroup.set(g.id, Array.isArray(g.schedule) ? g.schedule : [])
  }
  const barFromStop = (ev, idx) => {
    if (!ev?.group_id || !Number.isFinite(idx)) return null
    const s = scheduleByGroup.get(ev.group_id) || []
    return s[idx]?.name || null
  }

  const { data: items, error: itErr } = await sb
    .from('order_items')
    .select('id, tt_ticket_id, stop_index, pickup_stop_index, voided_at, ticket_types(name, stop_index), orders!inner(status, event_id, buyer_name, total_cents, paid_at)')
    .in('orders.event_id', events.map(e => e.id))
    .is('voided_at', null)
  if (itErr) throw itErr

  const paid = items.filter(i => ['paid', 'completed'].includes(i.orders.status))
  const tally = {}; const byNight = {}; let founderCount = 0; let unresolved = 0
  for (const it of paid) {
    const ev = evById.get(it.orders.event_id)
    // Ticket type name wins when present (native tickets); otherwise fall back to the
    // night's schedule via stop_index, then pickup_stop_index for walk-on buyers.
    const idx = Number.isFinite(it.stop_index) ? it.stop_index : it.pickup_stop_index
    const rawName = it.ticket_types?.name || barFromStop(ev, idx)
    const bar = rawName ? parseBar(rawName) : 'Unknown'
    if (bar === 'Unknown') unresolved++
    const night = ev ? ev.event_date : 'unknown'
    const isNative = !it.tt_ticket_id
    const isFounder = isNative && FOUNDERS.includes((it.orders.buyer_name || '').trim().toLowerCase()) && (it.orders.total_cents || 0) === 0
    tally[bar] = tally[bar] || { tt: 0, native: 0, founder: 0 }
    byNight[night] = byNight[night] || { tt: 0, native: 0, founder: 0 }
    if (isFounder) { tally[bar].founder++; byNight[night].founder++; founderCount++; continue }
    if (isNative) { tally[bar].native++; byNight[night].native++ }
    else { tally[bar].tt++; byNight[night].tt++ }
  }

  const rows = Object.entries(tally)
    .map(([b, v]) => ({ bar: b, tt: v.tt, native: v.native, total: v.tt + v.native, founder: v.founder }))
    .sort((a, b) => b.total - a.total)
  return { month: ym, events: events.length, rows, byNight, founderCount, unresolved, totalSeats: rows.reduce((s, r) => s + r.total, 0) }
}

async function main() {
  const cur = await tallyMonth(arg)
  const prev = await tallyMonth(priorMonth(arg)).catch(() => null)

  // Attach direction per bar so the report can flag drops without a second query.
  const prevByBar = new Map((prev?.rows || []).map(r => [r.bar, r.total]))
  for (const r of cur.rows) {
    const was = prevByBar.has(r.bar) ? prevByBar.get(r.bar) : null
    r.priorTotal = was
    r.delta = was === null ? null : r.total - was
    r.direction = was === null ? 'new' : r.delta > 0 ? 'up' : r.delta < 0 ? 'down' : 'flat'
  }

  // Every bar that appeared in either month, so a bar that went to zero is still reported.
  const allBars = [...new Set([...cur.rows.map(r => r.bar), ...(prev?.rows || []).map(r => r.bar)])]
    .filter(b => b !== 'Unknown')
  for (const b of allBars) {
    if (cur.rows.some(r => r.bar === b)) continue
    cur.rows.push({ bar: b, tt: 0, native: 0, total: 0, founder: 0, priorTotal: prevByBar.get(b) ?? null, delta: prevByBar.get(b) != null ? -prevByBar.get(b) : null, direction: 'down' })
  }
  cur.rows.sort((a, b) => b.total - a.total)

  say(`\n${arg}: ${cur.events} events, ${cur.totalSeats} paid seats, ${cur.founderCount} founder tests excluded, ${cur.unresolved} unattributed`)
  say(`prior (${priorMonth(arg)}): ${prev ? prev.totalSeats + ' seats' : 'no data'}\n`)
  say('bar'.padEnd(18), 'TT', 'Native', 'Total', ' vs prior')
  for (const r of cur.rows) {
    const d = r.delta === null ? 'new' : (r.delta > 0 ? `+${r.delta}` : String(r.delta))
    say(r.bar.padEnd(18), String(r.tt).padStart(3), String(r.native).padStart(6), String(r.total).padStart(6), d.padStart(8))
  }
  say('\nPER NIGHT:')
  for (const [n, v] of Object.entries(cur.byNight).sort()) say(`  ${n}  TT ${v.tt}  native ${v.native}  (founder ${v.founder})`)

  const out = { month: arg, kind: KIND, priorMonth: priorMonth(arg), generatedAt: new Date().toISOString(), current: cur, prior: prev }
  const file = `C:/Users/jacob/agent-ops/reports/.perbar-${KIND}-${arg}.json`
  fs.writeFileSync(file, JSON.stringify(out, null, 2))
  console.log(file)
}
main().catch(e => { console.error('ERROR:', e.message || e); process.exit(1) })
