// One-shot repair: PUT every existing bartender TT discount with the full
// list of event_series ids so customers can actually apply the code at
// checkout. Discounts created before lib/ticketTailorVouchers.js started
// passing valid_event_series_ids[] end up valid for no events ("expired or
// is not valid for this event" at checkout). This script fixes them in
// place — no new discount IDs, no churn on bartenders.tt_voucher_id.
//
// Idempotent and re-runnable.
//
// Usage:
//   set -a && source /c/Users/jacob/.env && set +a
//   node scripts/repair-bartender-tt-vouchers.js
//
// Required env:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_KEY  (or SUPABASE_SERVICE_ROLE_KEY)
//   TICKET_TAILOR_API_KEY

const { createClient } = require('@supabase/supabase-js')

const TT_BASE = 'https://api.tickettailor.com/v1'

function authHeader() {
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) return null
  return 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
}

async function fetchAllEventSeriesIds() {
  const auth = authHeader()
  if (!auth) return []
  const ids = []
  let cursor = null
  for (let page = 0; page < 20; page++) {
    const url = new URL(`${TT_BASE}/event_series`)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('starting_after', cursor)
    const res = await fetch(url.toString(), {
      headers: { Authorization: auth, Accept: 'application/json' },
    })
    if (!res.ok) break
    const payload = await res.json().catch(() => null)
    const data = payload?.data || []
    if (!data.length) break
    for (const es of data) {
      if (es?.id) ids.push(es.id)
    }
    if (data.length < 100) break
    cursor = data[data.length - 1].id
  }
  return ids
}

async function updateDiscount(discountId, eventSeriesIds) {
  const auth = authHeader()
  const params = new URLSearchParams()
  for (const esId of eventSeriesIds) {
    params.append('valid_event_series_ids[]', esId)
  }
  const res = await fetch(`${TT_BASE}/discounts/${encodeURIComponent(discountId)}`, {
    method: 'PUT',
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })
  const text = await res.text()
  let payload = null
  try { payload = text ? JSON.parse(text) : null } catch {}
  if (!res.ok) return { ok: false, status: res.status, body: payload || text }
  return { ok: true, payload }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY')
    process.exit(1)
  }
  if (!process.env.TICKET_TAILOR_API_KEY) {
    console.error('Missing TICKET_TAILOR_API_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const eventSeriesIds = await fetchAllEventSeriesIds()
  if (!eventSeriesIds.length) {
    console.error('No event_series found in TT. Aborting.')
    process.exit(1)
  }
  console.log(`Scoping every bartender discount to ${eventSeriesIds.length} event series.`)

  const { data: rows, error } = await supabase
    .from('bartenders')
    .select('slug, display_name, share_code, tt_voucher_id')
    .not('tt_voucher_id', 'is', null)
    .order('created_at')

  if (error) {
    console.error('Failed to read bartenders:', error.message)
    process.exit(1)
  }

  console.log(`Found ${rows.length} bartender discounts to repair.`)

  let fixed = 0
  let failed = 0

  for (const row of rows) {
    process.stdout.write(`[${row.slug}] code=${row.share_code} id=${row.tt_voucher_id} ... `)
    const result = await updateDiscount(row.tt_voucher_id, eventSeriesIds)
    if (result.ok) {
      console.log('OK')
      fixed++
    } else {
      console.log(`FAILED status=${result.status} body=${JSON.stringify(result.body).slice(0, 200)}`)
      failed++
    }
    await sleep(220)
  }

  console.log(`\nDone. fixed=${fixed} failed=${failed} total=${rows.length}`)
}

main().catch(err => {
  console.error('Repair crashed:', err)
  process.exit(1)
})
