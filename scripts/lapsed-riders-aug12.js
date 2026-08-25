// Lapsed riders as of 2026-08-12. Cutoff = 8 weeks back = 2026-06-17
// node scripts/lapsed-riders-aug12.js

const fs = require('fs'); const path = require('path')

// Load env — check multiple files
const envFiles = [
  path.join(__dirname, '..', '.env.production.local'),
  path.join(__dirname, '..', '.env.local'),
]
for (const f of envFiles) {
  if (!fs.existsSync(f)) continue
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
}

const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })

const FOUNDERS = ['jacob harper', 'richard flowers', 'lydia harper', 'alyssa flowers']
const CUTOFF_DATE = new Date('2026-06-17') // 8 weeks before 2026-08-12
const TODAY_STR = '2026-08-12'

function formatPhone(p) {
  if (!p) return ''
  const digits = p.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`
  return p
}

function draftSms(rider) {
  const firstName = (rider.name || '').split(' ')[0] || 'Hey'
  if (rider.isRepeat) {
    return `${firstName}, the Brew Loop shuttle misses you! It's been a while since your last ride with us. Hop back on this weekend and hit all 8 bars the easy way. Book your seat: https://app.jvillebrewloop.com/book`
  }
  return `${firstName}, you rode the Brew Loop a while back and we'd love to have you on again! Safe ride, great stops, good company. Grab your seat: https://app.jvillebrewloop.com/book`
}

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
        phone: formatPhone(r.phone),
        rideCount,
        lastRide: mostRecent.toISOString().split('T')[0],
        firstRide: dates[dates.length-1].toISOString().split('T')[0],
        isRepeat: rideCount >= 2,
        hasPhone: !!(r.phone && r.phone.trim()),
        smsReady: draftSms({ name: r.name, isRepeat: rideCount >= 2 })
      })
    }
  }

  lapsed.sort((a, b) => {
    if (b.isRepeat !== a.isRepeat) return b.isRepeat ? 1 : -1
    if (b.hasPhone !== a.hasPhone) return b.hasPhone ? 1 : -1
    return b.rideCount - a.rideCount
  })

  console.log('\nLapsed (last ride before ' + CUTOFF_DATE.toISOString().split('T')[0] + '):', lapsed.length)
  console.log('  Repeat (2+) with phone:', lapsed.filter(r => r.isRepeat && r.hasPhone).length)
  console.log('  Repeat (2+) no phone:', lapsed.filter(r => r.isRepeat && !r.hasPhone).length)
  console.log('  One-time with phone:', lapsed.filter(r => !r.isRepeat && r.hasPhone).length)
  console.log('  One-time no phone:', lapsed.filter(r => !r.isRepeat && !r.hasPhone).length)

  console.log('\nAll lapsed:')
  lapsed.forEach((r, i) => {
    console.log(` ${i+1}. [${r.isRepeat?'REPEAT':'once '}] ${(r.name||'').padEnd(25)} rides:${r.rideCount} last:${r.lastRide} phone:${r.phone||'none'}`)
  })

  const out = 'C:/Users/jacob/OneDrive/Desktop/lapsed-riders-2026-08-12.json'
  fs.writeFileSync(out, JSON.stringify(lapsed, null, 2))
  console.log('\nWrote', lapsed.length, 'riders to', out)
  return lapsed
}
main().catch(e => { console.error('ERROR:', e.message || e); process.exit(1) })
