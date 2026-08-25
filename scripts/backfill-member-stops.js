// One-off: claim-link friends were seated on the dispatch board with a null
// current_stop_index (the claim route didn't set their boarding bar). This
// backfills current_stop_index from the rider's paid, non-voided order_item for
// UPCOMING events only, so we never rewrite a past night's live position.
// Read-first, prints before/after. Pass --apply to write.
const fs = require('fs')
const path = require('path')
const env = {}
for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
}
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
const APPLY = process.argv.includes('--apply')
const TODAY = '2026-06-15'

;(async () => {
  // Upcoming events + their groups
  const { data: events } = await sb
    .from('events').select('id, event_date, group_id').gte('event_date', TODAY)
  const groupIds = [...new Set((events || []).map(e => e.group_id).filter(Boolean))]
  const eventByGroup = new Map((events || []).map(e => [e.group_id, e]))

  // Null-stop members in those groups
  const { data: members } = await sb
    .from('group_members')
    .select('id, group_id, contact_id, current_stop_index, contacts(first_name, last_name)')
    .in('group_id', groupIds)
    .is('current_stop_index', null)

  console.log(`Null-stop members in upcoming groups: ${(members || []).length}`)
  let fixed = 0
  for (const m of members || []) {
    const ev = eventByGroup.get(m.group_id)
    // The rider's paid, non-voided boarding item for this event
    const { data: items } = await sb
      .from('order_items')
      .select('stop_index, pickup_stop_index, voided_at, order:orders!inner(event_id, status)')
      .eq('contact_id', m.contact_id)
      .eq('order.event_id', ev.id)
    const item = (items || []).find(it => !it.voided_at && it.order?.status === 'paid')
    if (!item) { console.log(`  SKIP ${m.contacts?.first_name} ${m.contacts?.last_name} — no paid item`); continue }
    const stop = Number.isInteger(item.stop_index) ? item.stop_index
      : (Number.isInteger(item.pickup_stop_index) ? item.pickup_stop_index : null)
    if (stop == null) { console.log(`  SKIP ${m.contacts?.first_name} ${m.contacts?.last_name} — no boarding stop`); continue }
    console.log(`  ${APPLY ? 'SET ' : 'WOULD SET '}${m.contacts?.first_name} ${m.contacts?.last_name} (${ev.event_date}): null -> stop ${stop}`)
    if (APPLY) {
      const { error } = await sb.from('group_members').update({ current_stop_index: stop }).eq('id', m.id)
      if (error) console.error('   update failed', error.message); else fixed++
    }
  }
  console.log(APPLY ? `\nApplied ${fixed} update(s).` : `\nDry run. Re-run with --apply to write.`)
})().catch(e => { console.error('FATAL', e); process.exit(1) })
