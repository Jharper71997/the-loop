// Confidence check on May rider count: count native orders straight from the
// orders table by paid_at (not via the events join), so nothing is missed.
const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
const FOUNDERS = ['jacob harper', 'richard flowers', 'lydia harper', 'alyssa flowers']

async function main() {
  // All orders paid in May.
  const { data: orders, error } = await sb
    .from('orders')
    .select('id, status, buyer_name, total_cents, party_size, paid_at, event_id, stripe_checkout_session_id, tt_order_id')
    .gte('paid_at', '2026-05-01').lte('paid_at', '2026-05-31T23:59:59')
  if (error) { console.error(error.message);
    // tt_order_id may not exist; retry without it
    const r2 = await sb.from('orders').select('id, status, buyer_name, total_cents, party_size, paid_at, event_id, stripe_checkout_session_id').gte('paid_at','2026-05-01').lte('paid_at','2026-05-31T23:59:59')
    if (r2.error) { console.error(r2.error.message); process.exit(1) }
    return summarize(r2.data)
  }
  summarize(orders)
}

async function summarize(orders) {
  const paid = orders.filter(o => ['paid','completed'].includes(o.status))
  let native = 0, nativeRiders = 0, tt = 0, ttRiders = 0, founder = 0, founderRiders = 0
  for (const o of paid) {
    const isNative = !!o.stripe_checkout_session_id
    const sz = o.party_size || 1
    const isFounder = isNative && FOUNDERS.includes((o.buyer_name||'').trim().toLowerCase()) && (o.total_cents||0) === 0
    if (isFounder) { founder++; founderRiders += sz; continue }
    if (isNative) { native++; nativeRiders += sz } else { tt++; ttRiders += sz }
  }
  console.log(`Orders paid in May: ${paid.length}`)
  console.log(`  Native (Stripe checkout) orders: ${native}  riders(party_size): ${nativeRiders}`)
  console.log(`  Non-native (TT-ingested) orders: ${tt}  riders: ${ttRiders}`)
  console.log(`  Founder $0 test orders excluded:  ${founder}  (${founderRiders} seats)`)
  // Count actual order_items for native paid orders (more accurate than party_size).
  const nativeIds = paid.filter(o => o.stripe_checkout_session_id && !(FOUNDERS.includes((o.buyer_name||'').trim().toLowerCase()) && (o.total_cents||0)===0)).map(o=>o.id)
  if (nativeIds.length) {
    const { count } = await sb.from('order_items').select('id', { count:'exact', head:true }).in('order_id', nativeIds).is('voided_at', null)
    console.log(`  Native order_items (non-void): ${count}`)
  }
}
main().catch(e=>{console.error(e);process.exit(1)})
