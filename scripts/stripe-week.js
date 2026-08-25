// Read-only: sum Brew Loop Stripe revenue this week (succeeded charges by created).
//   node scripts/stripe-week.js [YYYY-MM-DD start]
const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }

const KEY = process.env.STRIPE_SECRET_KEY
if (!KEY) { console.error('STRIPE_SECRET_KEY not set'); process.exit(1) }

const start = process.argv[2] || '2026-06-15'
const gte = Math.floor(new Date(start + 'T00:00:00Z').getTime() / 1000)
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function main() {
  let url = `https://api.stripe.com/v1/charges?limit=100&created[gte]=${gte}`
  let gross = 0, refunded = 0, count = 0, refundCount = 0
  const byDay = {}
  while (url) {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } })
    if (!res.ok) { console.error('Stripe error', res.status, await res.text()); process.exit(1) }
    const body = await res.json()
    for (const c of body.data) {
      if (c.status !== 'succeeded' || !c.paid) continue
      const day = new Date(c.created * 1000).toISOString().slice(0, 10)
      byDay[day] = byDay[day] || { count: 0, gross: 0, refunded: 0 }
      byDay[day].count++; byDay[day].gross += c.amount; byDay[day].refunded += (c.amount_refunded || 0)
      gross += c.amount; refunded += (c.amount_refunded || 0); count++
      if (c.amount_refunded) refundCount++
    }
    if (body.has_more && body.data.length) {
      url = `https://api.stripe.com/v1/charges?limit=100&created[gte]=${gte}&starting_after=${body.data[body.data.length - 1].id}`
      await sleep(150)
    } else url = null
  }
  console.log(`Succeeded Stripe charges since ${start}: ${count}`)
  console.log('\nBy day:')
  for (const [d, v] of Object.entries(byDay).sort())
    console.log(`  ${d}  ${v.count} charges  gross $${(v.gross/100).toFixed(2)}` + (v.refunded ? `  (refunded $${(v.refunded/100).toFixed(2)})` : ''))
  console.log(`\nGROSS this week: $${(gross/100).toFixed(2)} across ${count} charges`)
  if (refunded) console.log(`Refunds: -$${(refunded/100).toFixed(2)} (${refundCount} charges)`)
  console.log(`NET this week:   $${((gross - refunded)/100).toFixed(2)}`)
}
main().catch(e => { console.error('ERROR:', e.message || e); process.exit(1) })
