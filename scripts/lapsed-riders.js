// Pull lapsed riders from orders table: rode before but not in last 8 weeks.
// node scripts/lapsed-riders.js

const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

const FOUNDERS = ['jacob harper', 'richard flowers', 'lydia harper', 'alyssa flowers']
const CUTOFF_DATE = new Date('2026-04-23') // 8 weeks before 2026-06-17

async function main() {
  const { data: orders, error } = await sb
    .from('orders')
    .select('id, buyer_name, buyer_email, buyer_phone, paid_at, event_id, total_cents, status')
    .in('status', ['paid', 'completed'])
    .not('buyer_name', 'is', null)
  if (error) throw error

  console.log('Total paid orders:', orders.length)

  const real = orders.filter(o => !FOUNDERS.includes((o.buyer_name || '').trim().toLowerCase()))

  const byRider = {}
  for (const o of real) {
    const key = (o.buyer_email || o.buyer_phone || o.buyer_name || '').trim().toLowerCase()
    if (!key) continue
    if (!byRider[key]) byRider[key] = { name: o.buyer_name, email: o.buyer_email || '', phone: o.buyer_phone || '', orders: [] }
    byRider[key].orders.push(o)
  }

  const riders = Object.values(byRider)
  console.log('Unique riders:', riders.length)

  const lapsed = []
  for (const r of riders) {
    const dates = r.orders.map(o => new Date(o.paid_at)).sort((a,b) => b - a)
    const mostRecent = dates[0]
    const rideCount = r.orders.length
    if (mostRecent < CUTOFF_DATE) {
      lapsed.push({
        name: r.name,
        email: r.email,
        phone: r.phone,
        rideCount,
        lastRide: mostRecent.toISOString().split('T')[0],
        firstRide: dates[dates.length-1].toISOString().split('T')[0],
        isRepeat: rideCount >= 2
      })
    }
  }

  lapsed.sort((a, b) => {
    if (b.isRepeat !== a.isRepeat) return b.isRepeat ? 1 : -1
    return b.rideCount - a.rideCount
  })

  console.log('\nLapsed (last ride before 2026-04-23):', lapsed.length)
  console.log('  Repeat (2+):', lapsed.filter(r => r.isRepeat).length)
  console.log('  One-time:', lapsed.filter(r => !r.isRepeat).length)
  console.log('\nTop lapsed:')
  lapsed.slice(0, 30).forEach(r => {
    console.log(` [${r.isRepeat?'REPEAT':'once'}] ${r.name} | rides:${r.rideCount} | last:${r.lastRide} | phone:${r.phone||'none'} | email:${r.email||'none'}`)
  })

  const out = 'C:/Users/jacob/OneDrive/Desktop/lapsed-riders.json'
  fs.writeFileSync(out, JSON.stringify(lapsed, null, 2))
  console.log('\nWrote', lapsed.length, 'riders to', out)
}
main().catch(e => { console.error('ERROR:', e.message || e); process.exit(1) })
