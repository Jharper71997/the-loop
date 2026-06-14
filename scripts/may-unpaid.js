// Which sponsor/bar subscriptions did NOT pay in May 2026. Read-only.
const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const Stripe = require('stripe'); const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const MGTE = Math.floor(new Date('2026-05-01T00:00:00-05:00').getTime()/1000)
const MLTE = Math.floor(new Date('2026-05-31T23:59:59-05:00').getTime()/1000)

async function listAll(method, params) {
  const out = []; let starting_after
  for (;;) {
    const page = await method({ limit: 100, ...params, ...(starting_after?{starting_after}:{}) })
    out.push(...page.data)
    if (!page.has_more) break
    starting_after = page.data[page.data.length-1].id
  }
  return out
}

async function main() {
  // All subscriptions of any status, with customer + latest invoice expanded.
  const subs = await listAll(p => stripe.subscriptions.list(p), { status: 'all', expand: ['data.customer'] })
  // All charges in May, to see who actually paid.
  const charges = (await listAll(p => stripe.charges.list(p), { created: { gte: MGTE, lte: MLTE } }))
    .filter(c => c.paid && c.status === 'succeeded')
  const paidCustomers = new Set(charges.map(c => typeof c.customer === 'string' ? c.customer : c.customer?.id).filter(Boolean))

  const rows = []
  for (const s of subs) {
    const cust = s.customer
    const item = s.items?.data?.[0]
    const price = item?.price
    const amt = price ? (price.unit_amount * (item.quantity||1))/100 : 0
    rows.push({
      name: cust?.name || cust?.email || cust?.id,
      email: cust?.email || '',
      status: s.status,
      amount: amt,
      interval: price?.recurring ? `${price.recurring.interval_count}/${price.recurring.interval}` : 'one-time',
      paidInMay: paidCustomers.has(cust?.id),
      started: new Date(s.created*1000).toISOString().slice(0,10),
      cancelAt: s.canceled_at ? new Date(s.canceled_at*1000).toISOString().slice(0,10) : '',
    })
  }

  console.log(`Total subscriptions on account: ${subs.length}\n`)

  const activeNoPay = rows.filter(r => (r.status==='active'||r.status==='past_due'||r.status==='unpaid'||r.status==='trialing') && !r.paidInMay)
  console.log(`ACTIVE/OPEN SUBSCRIPTIONS THAT DID NOT PAY IN MAY (${activeNoPay.length}):`)
  for (const r of activeNoPay.sort((a,b)=>b.amount-a.amount))
    console.log(`  ${('$'+r.amount.toFixed(0)).padStart(6)}  ${(r.name||'?').slice(0,24).padEnd(24)} ${r.email.padEnd(34)} status=${r.status}, since ${r.started}`)

  const canceled = rows.filter(r => r.status==='canceled')
  console.log(`\nCANCELED SUBSCRIPTIONS (${canceled.length}):`)
  for (const r of canceled.sort((a,b)=>b.amount-a.amount))
    console.log(`  ${('$'+r.amount.toFixed(0)).padStart(6)}  ${(r.name||'?').slice(0,24).padEnd(24)} ${r.email.padEnd(34)} canceled ${r.cancelAt||'?'}`)

  console.log(`\nPAID IN MAY (for reference, ${rows.filter(r=>r.paidInMay).length}):`)
  for (const r of rows.filter(r=>r.paidInMay).sort((a,b)=>b.amount-a.amount))
    console.log(`  ${('$'+r.amount.toFixed(0)).padStart(6)}  ${(r.name||'?').slice(0,24).padEnd(24)} status=${r.status}`)
}
main().catch(e=>{console.error(e);process.exit(1)})
