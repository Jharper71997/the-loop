// Creates the two Oktoberfest door pickup events (lib/doorPickup.js).
// Dry run by default; pass --apply to write.
//   node --env-file=.env.local scripts/create-oktoberfest-pickup.js [--apply]
const { createClient } = require('@supabase/supabase-js')

const APPLY = process.argv.includes('--apply')
const PRICE_CENTS = 1000
const SEATS = 13

// Festival: Fri 4 to 9 PM, Sat 10 AM to 9 PM. Last pickup 7 PM so every group
// gets real time there. Zones alternate so the bus never works one side of
// town twice in a row.
const DAYS = [
  { date: '2026-10-02', label: 'Friday', hours: [16, 17, 18, 19] },
  { date: '2026-10-03', label: 'Saturday', hours: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19] },
]

const fmt = h => `${((h + 11) % 12) + 1}:00 ${h >= 12 ? 'PM' : 'AM'}`

async function main() {
  const sb = APPLY && createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  for (const day of DAYS) {
    const event = {
      name: `Oktoberfest Door Pickup · ${day.label}`,
      event_date: day.date,
      pickup_time: `${String(day.hours[0]).padStart(2, '0')}:00`,
      description: 'We pick your group up at your door and drop you downtown for Jacksonville Oktoberfest. $10 a person, groups of 4 to 13. Pickup only.',
      status: 'on_sale',
      kind: 'brew',
      is_private: false,
      group_id: null,
    }
    const tts = day.hours.map((h, i) => ({
      name: `${fmt(h)} · Zone ${(i % 2) + 1}`,
      price_cents: PRICE_CENTS,
      capacity: SEATS,
      stop_index: null,
      active: true,
      sort_order: i,
    }))
    console.log(`\n${event.name} (${event.event_date})`)
    for (const t of tts) console.log(`  ${t.name}  $${t.price_cents / 100}  cap ${t.capacity}`)
    if (!APPLY) continue

    const { data: ev, error } = await sb.from('events').insert(event).select('id').single()
    if (error) throw error
    const { error: ttErr } = await sb.from('ticket_types').insert(tts.map(t => ({ ...t, event_id: ev.id })))
    if (ttErr) throw ttErr
    console.log(`  created ${ev.id}  https://jvillebrewloop.com/book/${ev.id}`)
  }
  if (!APPLY) console.log('\nDry run. Re-run with --apply to create.')
}

main().catch(e => { console.error(e); process.exit(1) })
