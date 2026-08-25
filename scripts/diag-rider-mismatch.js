// READ-ONLY diagnostic. Finds paid orders where the recorded rider count
// (non-voided order_items) does not match party_size, i.e. someone bought N
// tickets but the roster shows fewer than N riders. Also lists recent orders so
// we can eyeball the channel. Writes nothing to the DB.
//
//   node scripts/diag-rider-mismatch.js
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

async function main() {
  const SINCE = '2026-05-20' // focus on recent orders, skip migration-era noise
  // Pull recent paid/completed orders with their items.
  const { data: orders, error } = await sb
    .from('orders')
    .select('id, created_at, paid_at, status, party_size, total_cents, buyer_name, buyer_email, event_id, metadata, stripe_checkout_session_id, order_items(id, voided_at, ticket_type_id, tt_ticket_id, rider_first_name)')
    .in('status', ['paid', 'completed'])
    .gte('created_at', SINCE)
    .order('created_at', { ascending: false })
    .limit(400)
  if (error) { console.error(error); process.exit(1) }

  const channel = (o) => {
    const items = o.order_items || []
    if (items.some(i => i.tt_ticket_id)) return 'ticket_tailor'
    if (items.length) return 'native(/book)'
    if (o.stripe_checkout_session_id) return 'stripe_link?'
    return 'unknown'
  }

  const mismatches = []
  for (const o of orders || []) {
    const activeItems = (o.order_items || []).filter(i => !i.voided_at)
    const riderCount = activeItems.length
    const declared = o.party_size || 0
    if (riderCount !== declared) {
      mismatches.push({
        id: o.id.slice(0, 8),
        created: (o.created_at || '').slice(0, 10),
        buyer: o.buyer_name,
        chan: channel(o),
        party_size: declared,
        riders: riderCount,
        total: `$${((o.total_cents || 0) / 100).toFixed(2)}`,
        evt: !!o.event_id,
      })
    }
  }

  console.log(`\nScanned ${orders?.length || 0} paid/completed orders since ${SINCE}.`)
  console.log(`\n=== ORDERS WHERE party_size != riders recorded (${mismatches.length}) ===`)
  if (mismatches.length === 0) console.log('  none — every order has one order_item per declared seat.')
  else console.table(mismatches)

  // Orders with party_size > 1 (multi-ticket) — sanity sample of how they look.
  const multi = (orders || []).filter(o => (o.party_size || 0) > 1).slice(0, 25).map(o => ({
    id: o.id.slice(0, 8),
    created: (o.created_at || '').slice(0, 10),
    buyer: o.buyer_name,
    chan: channel(o),
    party_size: o.party_size,
    riders: (o.order_items || []).filter(i => !i.voided_at).length,
    total: `$${((o.total_cents || 0) / 100).toFixed(2)}`,
  }))
  console.log(`\n=== Sample of multi-ticket orders (party_size > 1) ===`)
  if (multi.length) console.table(multi); else console.log('  none found.')

  // Channel breakdown of the mismatches.
  const byChan = {}
  for (const m of mismatches) byChan[m.chan] = (byChan[m.chan] || 0) + 1
  console.log(`\n=== Mismatch count by channel ===`)
  console.table(byChan)
}

main().catch(e => { console.error(e); process.exit(1) })
