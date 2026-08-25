// One-off: deactivate the "Brew Loop koozie" and "VIP upgrade" checkout add-ons
// so they no longer appear on the native /book ticket sale page. We set
// active=false (reversible) rather than DELETE so historical order_addons and
// the catalog rows stay intact. Needs SUPABASE_SERVICE_KEY in .env.local.
//
//   node scripts/disable-addons.js          # dry run: just lists add-ons
//   node scripts/disable-addons.js --apply  # actually deactivates the two

const fs = require('fs'); const path = require('path')
const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
for (const line of envText.split(/\r?\n/)) { const m = line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '') }

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY
if (!KEY) { console.error('SUPABASE_SERVICE_KEY not set in .env.local'); process.exit(1) }
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const TARGETS = ['Brew Loop koozie', 'VIP upgrade']
const APPLY = process.argv.includes('--apply')

async function main() {
  const { data: all, error } = await sb
    .from('addons')
    .select('id, name, price_cents, kind, active, event_id')
    .order('sort_order', { ascending: true })
  if (error) throw error

  console.log('Current add-ons:')
  for (const a of all) {
    console.log(`  [${a.active ? 'ON ' : 'off'}] ${a.name} — $${(a.price_cents/100).toFixed(2)} (${a.kind})${a.event_id ? ' [event-scoped]' : ''}`)
  }

  const toDisable = all.filter(a => TARGETS.includes(a.name) && a.active)
  if (!toDisable.length) { console.log('\nNothing to do — neither target is active.'); return }

  if (!APPLY) { console.log(`\nDRY RUN. Would deactivate: ${toDisable.map(a => a.name).join(', ')}. Re-run with --apply.`); return }

  const ids = toDisable.map(a => a.id)
  const { error: upErr } = await sb.from('addons').update({ active: false }).in('id', ids)
  if (upErr) throw upErr
  console.log(`\nDeactivated: ${toDisable.map(a => a.name).join(', ')}.`)

  const { data: stillActive } = await sb
    .from('addons').select('name').eq('active', true)
  console.log(`Active add-ons remaining: ${stillActive?.length ? stillActive.map(a => a.name).join(', ') : '(none)'}`)
}

main().catch(e => { console.error(e); process.exit(1) })
