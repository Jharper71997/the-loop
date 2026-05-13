// One-shot: walk every future on_sale event and push current Loop-paid counts
// to TT so TT's available reflects what's left. Use before a live weekend to
// align state without waiting for the next Loop sale to trigger the sync.
//
// Usage:
//   set -a && source /c/Users/jacob/the-loop/.env.local && set +a
//   node scripts/sync-tt-now.js         # dry-run by default (no TT writes)
//   node scripts/sync-tt-now.js --apply # actually PUT to TT
//
// Env required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY (or
// SUPABASE_SERVICE_ROLE_KEY), TICKET_TAILOR_API_KEY.

const path = require('path')

// Force dry-run unless --apply was passed. Wins over any pre-existing env.
const APPLY = process.argv.includes('--apply')
process.env.TT_SYNC_DRYRUN = APPLY ? '0' : '1'

const { createClient } = require('@supabase/supabase-js')

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_KEY')
  if (!process.env.TICKET_TAILOR_API_KEY) throw new Error('Missing TICKET_TAILOR_API_KEY')

  // Dynamic import — the sync module is ESM (lib/ticketTailorSync.js uses
  // `import`), so we can't plain `require` it from this CJS script.
  const { syncTtForEvent } = await import(path.resolve(__dirname, '../lib/ticketTailorSync.js'))

  const sb = createClient(url, key, { auth: { persistSession: false } })
  const today = new Date().toISOString().slice(0, 10)
  const { data: events, error } = await sb
    .from('events')
    .select('id, name, event_date, status, group_id')
    .gte('event_date', today)
    .eq('status', 'on_sale')
    .order('event_date', { ascending: true })
  if (error) throw error
  if (!events?.length) {
    console.log('No future on_sale events.')
    return
  }

  console.log(`Mode: ${APPLY ? 'APPLY (writing to TT)' : 'DRY-RUN (no TT writes)'}`)
  console.log(`Events to sync: ${events.length}\n`)

  for (const ev of events) {
    console.log(`--- ${ev.event_date}  ${ev.name}  (${ev.id})`)
    const result = await syncTtForEvent(sb, ev.id)
    if (result.updated?.length) {
      for (const u of result.updated) {
        console.log(
          `  ${APPLY ? 'PUT' : 'would PUT'}  tt_tt_id=${u.tt_ticket_type_id}  stop#${u.stop_index}  ${u.old} -> ${u.new}  (paid_native=${u.paid_native})`,
        )
      }
    }
    if (result.skipped?.length) {
      for (const s of result.skipped) {
        if (s.reason === 'no_change') continue
        console.log(`  skip: ${s.reason}${s.stop_name ? ` (${s.stop_name})` : ''}`)
      }
    }
    if (result.errors?.length) {
      for (const e of result.errors) {
        console.log(`  ERROR: ${e.reason}${e.status ? ` (status=${e.status})` : ''}`)
      }
    }
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
