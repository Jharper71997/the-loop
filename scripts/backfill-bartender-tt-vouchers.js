// Backfill TT vouchers for bartenders who signed up before the voucher hook
// was wired in (i.e. every existing row at deploy time). Idempotent — skips
// any row that already has tt_voucher_id and re-runnable safely.
//
// Usage:
//   set -a && source /c/Users/jacob/.env && set +a
//   node scripts/backfill-bartender-tt-vouchers.js
//
// Required env:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   TICKET_TAILOR_API_KEY
//   TICKET_TAILOR_BARTENDER_VOUCHER_GROUP_ID

const { createClient } = require('@supabase/supabase-js')

const TT_BASE = 'https://api.tickettailor.com/v1'

function authHeader() {
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) return null
  return 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
}

async function createVoucherCode({ groupId, code }) {
  const auth = authHeader()
  if (!auth) return { ok: false, reason: 'no_api_key' }

  const params = new URLSearchParams()
  params.set('voucher_group_id', groupId)
  params.set('code', code)

  const res = await fetch(`${TT_BASE}/voucher_codes`, {
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
  return { ok: true, voucherId: payload?.id || null }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const groupId = process.env.TICKET_TAILOR_BARTENDER_VOUCHER_GROUP_ID

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }
  if (!groupId) {
    console.error('Missing TICKET_TAILOR_BARTENDER_VOUCHER_GROUP_ID — set up a 0%-off voucher group in TT first and put its id here')
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

  console.log(`Found ${rows.length} bartenders without a TT voucher.`)

  let created = 0
  let failed = 0

  for (const row of rows) {
    process.stdout.write(`[${row.slug}] code=${row.share_code} ... `)
    const result = await createVoucherCode({ groupId, code: row.share_code })
    if (result.ok) {
      const { error: updErr } = await supabase
        .from('bartenders')
        .update({ tt_voucher_id: result.voucherId })
        .eq('slug', row.slug)
      if (updErr) {
        console.log(`OK (id=${result.voucherId}) but Supabase update failed: ${updErr.message}`)
        failed++
      } else {
        console.log(`OK (id=${result.voucherId})`)
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
