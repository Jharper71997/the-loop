// Read Stripe invoices in the May window + their line items / metadata, to
// identify the bachelorette / Thursday lump-sum booking. Read-only.
const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const Stripe = require('stripe'); const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const GTE = Math.floor(new Date('2026-04-20T00:00:00-05:00').getTime()/1000)
const LTE = Math.floor(new Date('2026-06-03T23:59:59-05:00').getTime()/1000)

async function main() {
  const invoices = []
  let starting_after
  for (;;) {
    const page = await stripe.invoices.list({ limit: 100, created: { gte: GTE, lte: LTE }, ...(starting_after?{starting_after}:{}) })
    invoices.push(...page.data); if (!page.has_more) break; starting_after = page.data[page.data.length-1].id
  }
  console.log(`Invoices in window: ${invoices.length}`)
  for (const inv of invoices.sort((a,b)=>a.created-b.created)) {
    const date = new Date(inv.created*1000).toISOString().slice(0,10)
    const cust = inv.customer_name || inv.customer_email || ''
    console.log(`\n--- ${date} $${(inv.amount_paid/100).toFixed(2)} ${inv.status} ${cust} ${inv.subscription?'[SUBSCRIPTION]':'[ONE-OFF]'} ${inv.description||''}`)
    for (const li of (inv.lines?.data||[])) {
      console.log(`     ${li.quantity}x  $${((li.amount||0)/100).toFixed(2)}  ${li.description||''}`)
    }
    if (inv.metadata && Object.keys(inv.metadata).length) console.log('     meta:', JSON.stringify(inv.metadata))
  }

  // Also list payment links (group bookings are sometimes a flat link).
  try {
    const links = await stripe.paymentLinks.list({ limit: 50 })
    console.log(`\n=== PAYMENT LINKS (${links.data.length}) ===`)
    for (const pl of links.data) {
      const lis = await stripe.paymentLinks.listLineItems(pl.id, { limit: 10 })
      console.log(`${pl.active?'active ':'inactive'} ${pl.id} ${pl.url}`)
      for (const li of lis.data) console.log(`     ${li.quantity}x ${li.description||''}`)
    }
  } catch (e) { console.log('payment links:', e.message) }
}
main().catch(e=>{console.error(e);process.exit(1)})
