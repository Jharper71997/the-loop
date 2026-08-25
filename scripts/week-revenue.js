// Read-only: sum Brew Loop revenue from paid orders this week (by paid_at).
//   node scripts/week-revenue.js [YYYY-MM-DD start]
const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
if (!KEY) { console.error('SUPABASE_SERVICE_KEY not set in .env.local'); process.exit(1) }
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

// Week = Mon 2026-06-15 .. now, unless a start date is passed.
const start = process.argv[2] || '2026-06-15'
const startISO = new Date(start + 'T00:00:00Z').toISOString()

async function main() {
  const { data, error } = await sb
    .from('orders')
    .select('id, status, total_cents, paid_at, buyer_name, event_id')
    .gte('paid_at', startISO)
    .order('paid_at', { ascending: true })
  if (error) throw error
  const paid = data.filter(o => ['paid', 'completed'].includes(o.status) && o.paid_at)
  let total = 0
  const byDay = {}
  for (const o of paid) {
    const day = o.paid_at.slice(0, 10)
    byDay[day] = byDay[day] || { count: 0, cents: 0 }
    byDay[day].count++; byDay[day].cents += (o.total_cents || 0)
    total += (o.total_cents || 0)
  }
  console.log(`Paid orders since ${start}: ${paid.length}`)
  console.log('\nBy day:')
  for (const [d, v] of Object.entries(byDay).sort()) console.log(`  ${d}  ${v.count} orders  $${(v.cents/100).toFixed(2)}`)
  console.log(`\nTOTAL revenue this week: $${(total/100).toFixed(2)} across ${paid.length} paid orders`)
}
main().catch(e => { console.error('ERROR:', e.message || e); process.exit(1) })
