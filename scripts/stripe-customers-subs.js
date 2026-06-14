// Pull Stripe customers (emails) + their ACTIVE subscriptions, so we can (a)
// address the partner emails and (b) see which auto-invoice subscriptions to
// turn off now that bars pay via payment links. Read-only.
const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const Stripe = require('stripe'); const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

async function main() {
  console.log('=== ACTIVE / TRIALING SUBSCRIPTIONS ===')
  const subs = []; let sa
  for (;;) { const pg = await stripe.subscriptions.list({ status: 'all', limit: 100, expand: ['data.customer'], ...(sa ? { starting_after: sa } : {}) }); subs.push(...pg.data); if (!pg.has_more) break; sa = pg.data[pg.data.length - 1].id }
  for (const s of subs) {
    const c = s.customer && typeof s.customer === 'object' ? s.customer : {}
    const item = s.items?.data?.[0]
    const amt = item?.price?.unit_amount != null ? `$${(item.price.unit_amount / 100).toFixed(0)}/${item.price.recurring?.interval || '?'}` : '?'
    const prod = item?.price?.nickname || item?.price?.product || ''
    console.log(`  ${s.status.padEnd(9)} ${s.id}  ${(c.name || '').padEnd(22)} ${(c.email || '—').padEnd(30)} ${amt}  ${prod}`)
  }

  console.log('\n=== ALL CUSTOMERS (name / email) ===')
  const custs = []; sa = undefined
  for (;;) { const pg = await stripe.customers.list({ limit: 100, ...(sa ? { starting_after: sa } : {}) }); custs.push(...pg.data); if (!pg.has_more) break; sa = pg.data[pg.data.length - 1].id }
  for (const c of custs.sort((a, b) => (a.name || '').localeCompare(b.name || ''))) {
    console.log(`  ${(c.name || '(no name)').padEnd(26)} ${(c.email || '—').padEnd(32)} ${c.id}`)
  }
  console.log(`\n${subs.length} subscriptions, ${custs.length} customers`)
}
main().catch(e => { console.error(e.message || e); process.exit(1) })
