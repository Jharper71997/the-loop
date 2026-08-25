// Find lapsed brew loop riders (rode before but not in last 8 weeks)
const fs = require('fs'), path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

const FOUNDERS = ['jacob harper', 'richard flowers', 'lydia harper', 'alyssa flowers']
// 8 weeks before 2026-08-18
const CUTOFF = '2026-06-23'

async function run() {
  const { data, error } = await sb
    .from('orders')
    .select('id, buyer_name, buyer_email, buyer_phone, paid_at, status, events!inner(kind, event_date)')
    .eq('events.kind', 'brew')
    .eq('status', 'paid')
    .gte('paid_at', '2026-01-01')
    .order('paid_at', { ascending: false })
  if (error) { console.error(JSON.stringify(error)); process.exit(1) }

  const byEmail = new Map()
  for (const o of data) {
    const nameLower = (o.buyer_name || '').toLowerCase()
    if (FOUNDERS.some(f => nameLower.includes(f.split(' ')[0]))) continue
    const key = (o.buyer_email || '').toLowerCase().trim() || (o.buyer_name || '').toLowerCase().trim()
    if (!key) continue
    if (!byEmail.has(key)) {
      byEmail.set(key, { name: o.buyer_name, email: o.buyer_email, phone: o.buyer_phone, dates: [] })
    }
    const rec = byEmail.get(key)
    const d = (o.events && o.events.event_date) ? o.events.event_date : (o.paid_at || '').slice(0, 10)
    if (d) rec.dates.push(d)
  }

  const lapsed = []
  for (const [, r] of byEmail) {
    const sorted = [...new Set(r.dates)].sort()
    const lastDate = sorted[sorted.length - 1] || ''
    if (lastDate && lastDate < CUTOFF) {
      lapsed.push({ name: r.name, email: r.email, phone: r.phone, rideCount: sorted.length, lastDate, allDates: sorted })
    }
  }

  lapsed.sort((a, b) => b.rideCount - a.rideCount || b.lastDate.localeCompare(a.lastDate))
  const out = path.join('C:/Users/jacob/agent-ops/reports', 'lapsed-riders-2026-08-18.json')
  fs.writeFileSync(out, JSON.stringify(lapsed, null, 2))
  console.log(`${lapsed.length} lapsed riders -> ${out}`)
  lapsed.slice(0, 20).forEach(r => console.log(`  ${r.name} | rides:${r.rideCount} last:${r.lastDate} | ${r.email || r.phone || 'no contact'}`))
}
run().catch(e => { console.error(e); process.exit(1) })
