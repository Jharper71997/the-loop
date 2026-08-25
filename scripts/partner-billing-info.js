// Gather what's needed to draft partner billing emails:
//  (a) each bar's contact email from the bars table
//  (b) whether Stripe has a customer billing-portal LOGIN page (a shareable,
//      persistent link bars can use to manage / cancel their subscription)
// Read-only except portal config LIST (no writes). Run from the-loop.
const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } })
const Stripe = require('stripe'); const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

async function main() {
  console.log('=== BARS TABLE ===')
  const { data: bars, error } = await sb.from('bars').select('*')
  if (error) console.log('bars error:', error.message)
  else {
    console.log('columns:', bars.length ? Object.keys(bars[0]).join(', ') : '(none)')
    for (const b of bars) {
      const email = b.email || b.contact_email || b.billing_email || b.owner_email || null
      console.log(`  ${(b.name || b.slug || '?').padEnd(20)} email=${email || '—'}  fee=${b.monthly_fee ?? b.fee_cents ?? '?'}  stripe_cust=${b.stripe_customer_id || '—'}`)
    }
  }

  console.log('\n=== STRIPE BILLING PORTAL ===')
  try {
    const cfgs = await stripe.billingPortal.configurations.list({ limit: 10 })
    if (!cfgs.data.length) console.log('No portal configuration. A shareable cancel/manage link requires enabling the Customer Portal login page in Stripe.')
    for (const c of cfgs.data) {
      console.log(`config ${c.id} active=${c.active} default=${c.is_default} login_page=${c.login_page?.enabled} url=${c.login_page?.url || '(not enabled)'}`)
      console.log('   features: cancel=', c.features?.subscription_cancel?.enabled, ' update=', c.features?.subscription_update?.enabled)
    }
  } catch (e) { console.log('portal list error:', e.message) }
}
main().catch(e => { console.error(e.message || e); process.exit(1) })
