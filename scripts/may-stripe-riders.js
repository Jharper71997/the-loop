// Pull native Stripe Checkout riders for May 2026 and tally by night + bar.
// These are the /book bookings that never touch Ticket Tailor, so they are
// ADDITIVE to the TT numbers. Run from the-loop dir (needs stripe + .env.local).
//
//   node scripts/may-stripe-riders.js
//
// Reads STRIPE_SECRET_KEY from .env.local. Read-only (list + retrieve).

const fs = require('fs')
const path = require('path')

// Minimal .env.local loader (KEY=VALUE lines).
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}

const Stripe = require('stripe')
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Window a little wide to catch payments made just before the event; we bucket
// by the event date label on the line item, not the charge time.
const CREATED_GTE = Math.floor(new Date('2026-04-20T00:00:00-05:00').getTime() / 1000)
const CREATED_LTE = Math.floor(new Date('2026-06-03T23:59:59-05:00').getTime() / 1000)

function parseBar(lineName) {
  // product name = "<event.name> — <ticket_type.name>", e.g.
  //   "Fri, May 1 — Stop 1: Angry Ginger"  or  "... — Angry Ginger - Pickup time 7:30 p.m."
  // Take the text after the LAST em-dash, strip "Stop N:" prefix + pickup-time suffix.
  const parts = lineName.split('—')
  let tail = (parts.length > 1 ? parts[parts.length - 1] : lineName).trim()
  tail = tail.replace(/^Stop\s*\d+\s*:\s*/i, '')
  tail = tail.split(/\s*[-–]\s*Pickup/i)[0].trim()
  tail = tail.split(/\s*[-–]\s*Pick\s*up/i)[0].trim()
  if (/^walk[\s-]?on/i.test(tail)) return 'Walk-on'
  return tail.replace(/^HideAway/i, 'Hideaway').replace(/\s+Lounge$/i, '').replace(/\s+Pub$/i, '').trim() || 'Unknown'
}

async function main() {
  const sessions = []
  let starting_after
  for (;;) {
    const page = await stripe.checkout.sessions.list({
      limit: 100,
      created: { gte: CREATED_GTE, lte: CREATED_LTE },
      ...(starting_after ? { starting_after } : {}),
    })
    sessions.push(...page.data)
    if (!page.has_more) break
    starting_after = page.data[page.data.length - 1].id
  }
  const paid = sessions.filter(s => s.payment_status === 'paid' || s.status === 'complete')
  console.log(`Sessions in window: ${sessions.length} | paid/complete: ${paid.length}`)

  const byNight = {}     // dateLabel -> { riders, revenue_cents, bars:{} }
  const byBar = {}       // bar -> riders
  let totalRiders = 0, totalRevenue = 0
  const ledger = []

  for (const s of paid) {
    const li = await stripe.checkout.sessions.listLineItems(s.id, { limit: 100, expand: ['data.price.product'] })
    const created = new Date(s.created * 1000).toISOString().slice(0, 10)
    const lineSummaries = []
    for (const item of li.data) {
      const qty = item.quantity || 1
      const prod = item.price?.product
      const name = (prod && typeof prod === 'object' ? prod.name : null) || item.description || ''
      const dateLabel = (prod && typeof prod === 'object' ? prod.description : null) || 'unknown-date'
      const bar = parseBar(name)
      const cents = item.amount_total || 0
      totalRiders += qty
      totalRevenue += cents
      byBar[bar] = (byBar[bar] || 0) + qty
      byNight[dateLabel] = byNight[dateLabel] || { riders: 0, revenue_cents: 0, bars: {} }
      byNight[dateLabel].riders += qty
      byNight[dateLabel].revenue_cents += cents
      byNight[dateLabel].bars[bar] = (byNight[dateLabel].bars[bar] || 0) + qty
      lineSummaries.push(`${qty}x ${bar} [${dateLabel}] $${(cents/100).toFixed(2)}`)
    }
    ledger.push({ created, amount: (s.amount_total||0)/100, status: s.payment_status, buyer: s.customer_details?.name || s.metadata?.buyer_name || '', email: s.customer_details?.email || '', promo: !!s.total_details?.amount_discount, lines: lineSummaries })
  }

  console.log(`\n=== PER-SESSION LEDGER (paid/complete) ===`)
  for (const r of ledger.sort((a,b)=>a.created.localeCompare(b.created))) {
    console.log(`${r.created} $${String(r.amount).padStart(6)} ${r.status.padEnd(5)} ${(r.buyer||'(no name)').padEnd(22)} | ${r.lines.join(' ; ')}`)
  }

  // ---- REAL native riders: exclude only founder $0 test bookings ----
  const FOUNDERS = ['jacob harper', 'richard flowers', 'lydia harper', 'alyssa flowers']
  const realByNight = {}, realByBar = {}
  let realTotal = 0
  for (const s of paid) {
    const buyer = (s.customer_details?.name || s.metadata?.buyer_name || '').trim().toLowerCase()
    const isFounderTest = FOUNDERS.includes(buyer) && (s.amount_total || 0) === 0
    if (isFounderTest) continue
    const li = await stripe.checkout.sessions.listLineItems(s.id, { limit: 100, expand: ['data.price.product'] })
    for (const item of li.data) {
      const qty = item.quantity || 1
      const prod = item.price?.product
      const name = (prod && typeof prod === 'object' ? prod.name : null) || item.description || ''
      const dateLabel = (prod && typeof prod === 'object' ? prod.description : null) || 'unknown-date'
      const bar = parseBar(name)
      realTotal += qty
      realByBar[bar] = (realByBar[bar] || 0) + qty
      realByNight[dateLabel] = realByNight[dateLabel] || {}
      realByNight[dateLabel][bar] = (realByNight[dateLabel][bar] || 0) + qty
    }
  }
  console.log(`\n=== REAL NATIVE RIDERS (founder tests excluded) === total ${realTotal}`)
  for (const [d, bars] of Object.entries(realByNight).sort((a,b)=>a[0].localeCompare(b[0]))) {
    console.log(`  ${d.padEnd(20)} ${Object.entries(bars).map(([n,c])=>`${n} ${c}`).join(', ')}`)
  }
  console.log('  by bar:', Object.entries(realByBar).sort((a,b)=>b[1]-a[1]).map(([n,c])=>`${n} ${c}`).join(', '))

  console.log(`\n=== NATIVE STRIPE RIDERS (May window) ===`)
  console.log(`Total native riders: ${totalRiders} | revenue: $${(totalRevenue/100).toLocaleString()}`)
  console.log(`\nBy night (from line-item date label):`)
  for (const [d, v] of Object.entries(byNight).sort((a,b)=>a[0].localeCompare(b[0]))) {
    const bars = Object.entries(v.bars).map(([n,c])=>`${n} ${c}`).join(', ')
    console.log(`  ${d.padEnd(28)} riders ${String(v.riders).padStart(3)}  $${(v.revenue_cents/100).toString().padStart(5)}  | ${bars}`)
  }
  console.log(`\nBy bar (native pickup):`)
  for (const [b, c] of Object.entries(byBar).sort((a,b)=>b[1]-a[1])) {
    console.log(`  ${b.padEnd(18)} ${c}`)
  }

  fs.writeFileSync(
    'C:/Users/jacob/OneDrive/Desktop/brew-loop-may-2026-stripe-native.json',
    JSON.stringify({ totalRiders, totalRevenue_cents: totalRevenue, byNight, byBar }, null, 2)
  )
  console.log('\nWrote brew-loop-may-2026-stripe-native.json to Desktop')
}

main().catch(e => { console.error(e); process.exit(1) })
