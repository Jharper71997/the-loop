// READ-ONLY diagnostic. Confirms whether "10 sales" + driver numbers are duplicates.
// Run: node scripts/diag-dupes.js
const fs = require('fs')
const path = require('path')

// minimal .env.local loader
const env = {}
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY)

;(async () => {
  // ---- 1. PAID ORDERS (what the finance "sales" count reads) ----
  const { data: orders, error: oErr } = await sb
    .from('orders')
    .select('id, status, paid_at, total_cents, party_size, event_id, buyer_email, stripe_checkout_session_id, metadata, created_at')
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(60)
  if (oErr) { console.error('orders err', oErr); }
  console.log(`\n===== PAID ORDERS (${(orders||[]).length}) =====`)
  for (const o of orders || []) {
    const tt = o.metadata && (o.metadata.tt_order_id || o.metadata.tt_order_reference)
    console.log(
      [ (o.paid_at||'').slice(0,16),
        '$'+((o.total_cents||0)/100).toFixed(0),
        'ps'+(o.party_size??'?'),
        'evt:'+String(o.event_id||'-').slice(0,8),
        'email:'+(o.buyer_email||'-'),
        'tt:'+(tt||'-'),
        'sess:'+String(o.stripe_checkout_session_id||'-').slice(0,12),
        'id:'+String(o.id).slice(0,8),
      ].join('  ')
    )
  }

  // duplicate detection across paid orders
  const groupBy = (arr, keyFn) => {
    const m = {}
    for (const x of arr) { const k = keyFn(x); if (k==null) continue; (m[k]=m[k]||[]).push(x) }
    return m
  }
  const byTt = groupBy(orders||[], o => o.metadata && (o.metadata.tt_order_id || o.metadata.tt_order_reference))
  const bySess = groupBy(orders||[], o => o.stripe_checkout_session_id)
  const byEmailAmt = groupBy(orders||[], o => `${o.buyer_email}|${o.total_cents}|${(o.paid_at||'').slice(0,10)}`)

  const dump = (label, m) => {
    const dups = Object.entries(m).filter(([,v]) => v.length > 1)
    console.log(`\n----- DUP CHECK: ${label} -> ${dups.length} duplicated key(s) -----`)
    for (const [k, v] of dups) console.log(`  ${k}  x${v.length}  ids=[${v.map(o=>String(o.id).slice(0,8)).join(', ')}]  paid_at=[${v.map(o=>(o.paid_at||'').slice(0,16)).join(' | ')}]`)
  }
  dump('same tt_order_id', byTt)
  dump('same stripe_session', bySess)
  dump('same email+amount+day', byEmailAmt)

  // ---- 2. GROUPS + EVENTS for the last two weekends ----
  const { data: groups } = await sb
    .from('groups')
    .select('id, event_date, name, tt_event_id, created_at')
    .gte('event_date', '2026-06-05')
    .order('event_date', { ascending: true })
  console.log(`\n===== GROUPS since 2026-06-05 (${(groups||[]).length}) =====`)
  for (const g of groups || []) {
    console.log(`  ${g.event_date}  ${String(g.name||'').slice(0,28).padEnd(28)}  tt:${g.tt_event_id||'-'}  id:${String(g.id).slice(0,8)}  created:${(g.created_at||'').slice(0,16)}`)
  }
  const gByDate = groupBy(groups||[], g => g.event_date)
  const gDup = Object.entries(gByDate).filter(([,v]) => v.length > 1)
  console.log(`\n----- DUP CHECK: groups per event_date -> ${gDup.length} dup date(s) -----`)
  for (const [d, v] of gDup) console.log(`  ${d}  x${v.length}  ids=[${v.map(g=>String(g.id).slice(0,8)).join(', ')}]`)

  if ((groups||[]).length) {
    const gids = groups.map(g => g.id)
    const { data: events } = await sb
      .from('events')
      .select('id, group_id, event_date, status, created_at')
      .in('group_id', gids)
      .order('event_date', { ascending: true })
    console.log(`\n===== EVENTS for those groups (${(events||[]).length}) =====`)
    for (const e of events || []) {
      console.log(`  ${e.event_date||'-'}  grp:${String(e.group_id||'-').slice(0,8)}  status:${e.status||'-'}  id:${String(e.id).slice(0,8)}  created:${(e.created_at||'').slice(0,16)}`)
    }
    const eByGrp = groupBy(events||[], e => e.group_id)
    const eDup = Object.entries(eByGrp).filter(([,v]) => v.length > 1)
    console.log(`\n----- DUP CHECK: events per group -> ${eDup.length} group(s) with >1 event -----`)
    for (const [g, v] of eDup) console.log(`  grp ${String(g).slice(0,8)}  x${v.length}  evt_ids=[${v.map(e=>String(e.id).slice(0,8)).join(', ')}]`)
  }

  // ---- 3. DRIVER-related tables (discover what 'driver numbers' means) ----
  for (const tbl of ['driver_reports','driver_weekends','ridership','driver_headcounts','driver_assignments','headcounts','weekend_recaps']) {
    const { data, error } = await sb.from(tbl).select('*').limit(5)
    if (error) { console.log(`\n(driver probe) ${tbl}: ${error.message}`); continue }
    console.log(`\n===== TABLE ${tbl} exists — sample ${data.length} row(s), keys: ${data[0]?Object.keys(data[0]).join(','):'(empty)'} =====`)
    for (const r of data) console.log('  ', JSON.stringify(r).slice(0, 240))
  }
})().catch(e => { console.error('FATAL', e); process.exit(1) })
