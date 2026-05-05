// One-shot backfill: create a 0%-off Ticket Tailor discount code for each
// bartender that doesn't have one yet. Idempotent and re-runnable.
//
// Usage:
//   set -a && source /c/Users/jacob/.env && set +a
//   node scripts/backfill-bartender-tt-vouchers.js
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

async function ttPost(path, params) {
  const auth = authHeader()
  if (!auth) return { ok: false, reason: 'no_api_key' }

  const res = await fetch(`${TT_BASE}${path}`, {
    method: 'POST',
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

  if (!res.ok) {
    return { ok: false, status: res.status, body: payload || text }
  }
  return { ok: true, payload }
}

async function fetchAllTicketTypeIds() {
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
      for (const tt of es?.default_ticket_types || []) {
        if (tt?.id) ids.push(tt.id)
      }
    }
    if (data.length < 100) break
    cursor = data[data.length - 1].id
  }
  return ids
}

async function createDiscount({ code, displayName, ticketTypeIds }) {
  const params = new URLSearchParams()
  params.set('name', `Bartender: ${displayName || code}`)
  params.set('code', code)
  params.set('type', 'fixed_amount')
  params.set('price', '1')
  for (const tid of ticketTypeIds || []) {
    params.append('ticket_types[]', tid)
  }
  return ttPost('/discounts', params)
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

  const { data: rows, error } = await supabase
    .from('bartenders')
    .select('slug, display_name, share_code, tt_voucher_id, active')
    .is('tt_voucher_id', null)
    .not('share_code', 'is', null)
    .eq('active', true)
    .order('created_at')

  if (error) {
    console.error('Failed to read bartenders:', error.message)
    process.exit(1)
  }

  console.log(`Found ${rows.length} bartenders without a TT discount code.`)

  const ticketTypeIds = await fetchAllTicketTypeIds()
  if (!ticketTypeIds.length) {
    console.error('No ticket_types found in TT — discount codes would be valid for nothing. Aborting.')
    process.exit(1)
  }
  console.log(`Scoping discounts to ${ticketTypeIds.length} ticket types.`)

  let created = 0
  let failed = 0

  for (const row of rows) {
    process.stdout.write(`[${row.slug}] code=${row.share_code} ... `)
    const result = await createDiscount({ code: row.share_code, displayName: row.display_name, ticketTypeIds })
    if (result.ok) {
      const discountId = result.payload?.id || null
      const { error: updErr } = await supabase
        .from('bartenders')
        .update({ tt_voucher_id: discountId })
        .eq('slug', row.slug)
      if (updErr) {
        console.log(`OK (id=${discountId}) but Supabase update failed: ${updErr.message}`)
        failed++
      } else {
        console.log(`OK (id=${discountId})`)
        created++
      }
    } else {
      console.log(`FAILED status=${result.status} body=${JSON.stringify(result.body).slice(0, 200)}`)
      failed++
    }
    // Stay polite with TT's API — ~5 req/sec.
    await sleep(220)
  }

  console.log(`\nDone. created=${created} failed=${failed} total=${rows.length}`)
}

main().catch(err => {
  console.error('Backfill crashed:', err)
  process.exit(1)
})
