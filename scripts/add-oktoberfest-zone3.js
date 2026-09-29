// Adds the Zone 3 (on base, its own shuttle) pickup times to the two
// Oktoberfest door pickup events. Every hour, since base has a dedicated bus.
// Dry run by default; pass --apply to write.
//   node --env-file=.env.local scripts/add-oktoberfest-zone3.js [--apply]
const { createClient } = require('@supabase/supabase-js')

const APPLY = process.argv.includes('--apply')
const EVENTS = [
  { id: 'a7f276e5-0495-444c-be54-2f4fe6ee8bf4', label: 'Friday', hours: [16, 17, 18, 19] },
  { id: '953f7f87-e044-4763-bf15-c9b81f917a04', label: 'Saturday', hours: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19] },
]
const fmt = h => `${((h + 11) % 12) + 1}:00 ${h >= 12 ? 'PM' : 'AM'}`

async function main() {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  for (const ev of EVENTS) {
    const { data: existing, error } = await sb.from('ticket_types').select('name').eq('event_id', ev.id)
    if (error) throw error
    const have = new Set(existing.map(t => t.name))
    const rows = ev.hours
      .map((h, i) => ({
        event_id: ev.id, name: `${fmt(h)} · Zone 3`, price_cents: 1000, capacity: 13,
        stop_index: null, active: true, sort_order: 100 + i,
      }))
      .filter(r => !have.has(r.name))
    console.log(`${ev.label}: ${rows.length} to add`, rows.map(r => r.name).join(', '))
    if (APPLY && rows.length) {
      const { error: insErr } = await sb.from('ticket_types').insert(rows)
      if (insErr) throw insErr
      console.log('  added')
    }
  }
  if (!APPLY) console.log('Dry run. Re-run with --apply to write.')
}

main().catch(e => { console.error(e); process.exit(1) })
