// READ-ONLY. Dumps everything actually purchased for THIS weekend (Jun 19-20 2026)
// straight from the app DB, the SAME way lib/leadershipHome.js getLive() counts it,
// so we can see why the app number looks off. Writes nothing.
//
//   node scripts/diag-this-weekend.js
//
// Needs SUPABASE_SERVICE_KEY in .env.local.

const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
if (!KEY) { console.error('SUPABASE_SERVICE_KEY not set in .env.local'); process.exit(1) }
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const FROM = '2026-06-18', TO = '2026-06-22'

async function main() {
  // 1) Events this weekend
  const { data: events, error: evErr } = await sb
    .from('events')
    .select('id, name, event_date, status, group_id')
    .gte('event_date', FROM).lte('event_date', TO)
    .order('event_date')
  if (evErr) throw evErr
  console.log(`\n=== EVENTS (${FROM}..${TO}) — ${events.length} ===`)
  for (const e of events) console.log(`  ${e.event_date}  ${e.id}  status=${e.status}  group=${e.group_id}  ${e.name}`)
  if (!events.length) { console.log('No events in range — widen FROM/TO.'); return }

  // 2) Groups for those events (cohorts carry tt_event_id + closed_out_at per app logic)
  const groupIds = [...new Set(events.map(e => e.group_id).filter(Boolean))]
  const { data: groups } = await sb
    .from('groups')
    .select('id, name, tt_event_id, closed_out_at')
    .in('id', groupIds)
  console.log(`\n=== GROUPS — ${groups ? groups.length : 0} ===`)
  for (const g of groups || []) console.log(`  ${g.id}  tt_event_id=${g.tt_event_id || '-'}  closed_out_at=${g.closed_out_at || 'OPEN'}  ${g.name}`)

  // 3) NATIVE orders for these events (any status), with items
  const { data: nativeOrders, error: oErr } = await sb
    .from('orders')
    .select('id, created_at, paid_at, refunded_at, status, party_size, total_cents, buyer_name, buyer_email, event_id, stripe_checkout_session_id, metadata, order_items(id, voided_at, tt_ticket_id, rider_first_name, ticket_types(name))')
    .in('event_id', events.map(e => e.id))
    .order('created_at', { ascending: true })
  if (oErr) throw oErr

  // 4) TT orders matched by metadata->>tt_event_id (the way getLive() pulls them)
  const ttEventIds = (groups || []).map(g => g.tt_event_id).filter(Boolean)
  let ttOrders = []
  for (const tid of ttEventIds) {
    const { data: tt } = await sb
      .from('orders')
      .select('id, created_at, paid_at, refunded_at, status, party_size, total_cents, buyer_name, buyer_email, event_id, metadata, order_items(id, voided_at, tt_ticket_id)')
      .eq('metadata->>tt_event_id', String(tid))
    for (const o of tt || []) ttOrders.push({ ...o, _ttEventId: tid })
  }

  const evDate = id => (events.find(e => e.id === id) || {}).event_date || '(no event row)'
  const channel = (o) => {
    const items = (o.order_items || [])
    if (items.some(i => i.tt_ticket_id)) return 'ticket_tailor'
    if (items.length) return 'native'
    if (o.stripe_checkout_session_id) return 'stripe_link'
    return 'unknown'
  }
  const line = (o, evLabel) => {
    const active = (o.order_items || []).filter(i => !i.voided_at)
    const voided = (o.order_items || []).filter(i => i.voided_at)
    return `  ${evLabel} | ${String(o.status).padEnd(9)} | ${channel(o).padEnd(13)} | party=${o.party_size} riders=${active.length}${voided.length?` (+${voided.length} voided)`:''} | $${((o.total_cents||0)/100).toFixed(2)} | paid=${o.paid_at?o.paid_at.slice(0,16):'-'}${o.refunded_at?' REFUNDED':''} | ${o.buyer_name||'?'} <${o.buyer_email||''}>`
  }

  console.log(`\n=== NATIVE orders (by event_id) — ${nativeOrders.length} ===`)
  for (const o of nativeOrders) console.log(line(o, evDate(o.event_id)))

  console.log(`\n=== TT orders (by metadata.tt_event_id) — ${ttOrders.length} ===`)
  for (const o of ttOrders) console.log(line(o, 'tt:'+o._ttEventId))

  // 5) Reproduce getLive() math: dedup by order id, status='paid', sum party_size
  console.log(`\n=== WHAT THE APP (getLive) WOULD SHOW for the active loop ===`)
  for (const g of groups || []) {
    const evs = events.filter(e => e.group_id === g.id)
    const evIds = evs.map(e => e.id)
    const seen = new Set()
    let riders = 0, collected = 0, counted = 0
    const paidNative = nativeOrders.filter(o => evIds.includes(o.event_id) && o.status === 'paid')
    const paidTT = ttOrders.filter(o => o._ttEventId === g.tt_event_id && o.status === 'paid')
    for (const o of [...paidNative, ...paidTT]) {
      if (seen.has(o.id)) continue
      seen.add(o.id)
      riders += (o.party_size || 0)
      collected += (o.total_cents || 0)
      counted++
    }
    console.log(`  GROUP ${g.id} (${g.name}) closed=${g.closed_out_at?'YES':'no'}:`)
    console.log(`     events=${evIds.length} | paid orders counted=${counted} (native ${paidNative.length} + tt ${paidTT.length}) | RIDERS BOOKED=${riders} | COLLECTED=$${(collected/100).toFixed(2)}`)
  }

  // 6) Ground-truth per night (paid/completed, non-voided rider items)
  console.log(`\n=== GROUND TRUTH per night (paid+completed, non-voided rider items) ===`)
  for (const e of events) {
    const evOrders = nativeOrders.filter(o => o.event_id === e.id)
    const paid = evOrders.filter(o => ['paid','completed'].includes(o.status))
    const items = paid.flatMap(o => (o.order_items||[]).filter(i => !i.voided_at))
    const tt = items.filter(i => i.tt_ticket_id).length
    const byStatus = {}; for (const o of evOrders) byStatus[o.status]=(byStatus[o.status]||0)+1
    console.log(`  ${e.event_date} (${e.id}): paid orders=${paid.length} | rider items=${items.length} (tt ${tt}/native ${items.length-tt}) | sum(party_size)=${paid.reduce((a,o)=>a+(o.party_size||0),0)} | statuses=${JSON.stringify(byStatus)}`)
  }
}
main().catch(e => { console.error('ERROR:', e.message || e); process.exit(1) })
