// Verify the July 2026 Black Rose partner report numbers straight from the DB,
// and list the actual people. Read-only.
//
//   node scripts/verify-blackrose-july.js

const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
if (!KEY) { console.error('SUPABASE_SERVICE_KEY missing'); process.exit(1) }
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
    .select('*')
    .gte('event_date', '2026-07-01').lte('event_date', '2026-07-31')
    .order('event_date')
  if (evErr) throw evErr
  console.log(`\n=== JULY 2026 EVENTS (${events.length}) ===`)
  for (const e of events) {
    const dow = new Date(e.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
    console.log(`  ${e.event_date} ${dow}  ${e.name}  [kind=${e.kind ?? 'n/a'} status=${e.status ?? 'n/a'} id=${e.id}]`)
  }
  const evById = new Map(events.map(e => [e.id, e]))

  // ---- stops per event (was Black Rose actually on the route?) ----
  try {
    const { data: stops } = await sb.from('event_stops').select('*').in('event_id', events.map(e => e.id))
    if (stops && stops.length) {
      console.log(`\n=== EVENT_STOPS ===`)
      const byEv = {}
      for (const s of stops) { (byEv[s.event_id] = byEv[s.event_id] || []).push(s) }
      for (const [eid, ss] of Object.entries(byEv)) {
        const ev = evById.get(eid)
        console.log(`  ${ev?.event_date}: ` + ss.sort((a, b) => (a.stop_index ?? 0) - (b.stop_index ?? 0))
          .map(s => `${s.stop_index}:${s.bar_name ?? s.name ?? JSON.stringify(s).slice(0, 60)}`).join(' | '))
      }
    }
  } catch (e) { console.log('\n(no event_stops table: ' + (e.message || e) + ')') }

  // ---- order items ----
  const { data: items, error: itErr } = await sb
    .from('order_items')
    .select('id, tt_ticket_id, stop_index, pickup_stop_index, voided_at, rider_first_name, rider_last_name, rider_email, rider_phone, ticket_types(name, stop_index), orders!inner(id, status, event_id, buyer_name, buyer_email, buyer_phone, party_size, total_cents, paid_at)')
    .in('orders.event_id', events.map(e => e.id))
  if (itErr) throw itErr

  const live = items.filter(i => !i.voided_at)
  const paid = live.filter(i => ['paid', 'completed'].includes(i.orders.status))
  console.log(`\n=== ORDER ITEMS (July) ===`)
  console.log(`  all items: ${items.length} | non-voided: ${live.length} | paid+completed: ${paid.length}`)
  const statuses = {}
  for (const i of live) statuses[i.orders.status] = (statuses[i.orders.status] || 0) + 1
  console.log(`  non-voided by order status:`, statuses)

  // party_size cross-check: items per order vs orders.party_size
  const byOrder = {}
  for (const i of paid) { (byOrder[i.orders.id] = byOrder[i.orders.id] || { o: i.orders, n: 0 }).n++ }
  const mismatch = Object.values(byOrder).filter(v => (v.o.party_size || 0) !== v.n)
  console.log(`\n  orders (paid): ${Object.keys(byOrder).length}`)
  console.log(`  sum of items: ${paid.length} | sum of orders.party_size: ${Object.values(byOrder).reduce((a, v) => a + (v.o.party_size || 0), 0)}`)
  if (mismatch.length) {
    console.log(`  !! ${mismatch.length} orders where item count != party_size:`)
    for (const m of mismatch) console.log(`     ${m.o.buyer_name} — items ${m.n} vs party_size ${m.o.party_size} (order ${m.o.id})`)
  } else console.log('  item count matches party_size on every paid order.')

  // ---- per night / per bar ----
  const nightBar = {}
  const nightTotal = {}
  for (const it of paid) {
    const ev = evById.get(it.orders.event_id); const night = ev ? ev.event_date : 'unknown'
    const isFounder = !it.tt_ticket_id && FOUNDERS.includes((it.orders.buyer_name || '').trim().toLowerCase()) && (it.orders.total_cents || 0) === 0
    if (isFounder) continue
    const bar = parseBar(it.ticket_types?.name)
    nightBar[night] = nightBar[night] || {}
    nightBar[night][bar] = (nightBar[night][bar] || 0) + 1
    nightTotal[night] = (nightTotal[night] || 0) + 1
  }
  console.log(`\n=== RIDERS PER NIGHT (paid, non-voided, founders excluded) ===`)
  for (const [n, tot] of Object.entries(nightTotal).sort()) {
    const dow = new Date(n + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
    console.log(`  ${n} ${dow}  total ${tot}  ::  ` + Object.entries(nightBar[n]).sort((a, b) => b[1] - a[1]).map(([b, c]) => `${b} ${c}`).join(', '))
  }

  // ---- Black Rose boarders, with names ----
  console.log(`\n=== BLACK ROSE BOARDERS (people who started the night there) ===`)
  const br = paid.filter(it => /black\s*rose/i.test(it.ticket_types?.name || ''))
  const brRows = br.map(it => ({
    night: evById.get(it.orders.event_id)?.event_date,
    rider: [it.rider_first_name, it.rider_last_name].filter(Boolean).join(' '),
    buyer: it.orders.buyer_name || '',
    email: it.rider_email || it.orders.buyer_email || '',
    phone: it.rider_phone || it.orders.buyer_phone || '',
    source: it.tt_ticket_id ? 'TicketTailor' : 'app',
    paid_at: it.orders.paid_at,
    cents: it.orders.total_cents,
    order_id: it.orders.id,
  })).sort((a, b) => (a.night || '').localeCompare(b.night || '') || a.buyer.localeCompare(b.buyer))
  console.log(`  count: ${brRows.length}`)
  for (const r of brRows) console.log(`  ${r.night}  ${(r.rider || r.buyer).padEnd(24)} ${r.email.padEnd(30)} ${r.phone.padEnd(14)} ${r.source}`)

  // ---- everyone who rode on nights Black Rose was on the route ----
  const brNights = [...new Set(brRows.map(r => r.night))]
  console.log(`\n=== ALL RIDERS ON NIGHTS WITH BLACK ROSE ACTIVITY (${brNights.join(', ')}) ===`)
  const allRows = paid.filter(it => brNights.includes(evById.get(it.orders.event_id)?.event_date))
    .filter(it => !(!it.tt_ticket_id && FOUNDERS.includes((it.orders.buyer_name || '').trim().toLowerCase()) && (it.orders.total_cents || 0) === 0))
    .map(it => ({
      night: evById.get(it.orders.event_id)?.event_date,
      rider: [it.rider_first_name, it.rider_last_name].filter(Boolean).join(' '),
      buyer: it.orders.buyer_name || '',
      email: it.rider_email || it.orders.buyer_email || '',
      phone: it.rider_phone || it.orders.buyer_phone || '',
      bar: parseBar(it.ticket_types?.name),
      source: it.tt_ticket_id ? 'TicketTailor' : 'app',
    })).sort((a, b) => (a.night || '').localeCompare(b.night || '') || a.bar.localeCompare(b.bar) || a.buyer.localeCompare(b.buyer))
  for (const r of allRows) console.log(`  ${r.night}  ${(r.rider || r.buyer).padEnd(24)} ${r.bar.padEnd(14)} ${r.email.padEnd(30)} ${r.phone.padEnd(14)} ${r.source}`)

  fs.writeFileSync(path.join(__dirname, 'verify-blackrose-july.json'),
    JSON.stringify({ events, nightTotal, nightBar, boarders: brRows, allRiders: allRows }, null, 2))
  console.log(`\nWrote scripts/verify-blackrose-july.json`)
}
main().catch(e => { console.error('ERROR:', e.message || e); process.exit(1) })
