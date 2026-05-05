// TT-only repair: list every discount in Ticket Tailor whose name starts
// with "Bartender:" and PUT it with the full event_series list. Doesn't
// require a Supabase service key — only TICKET_TAILOR_API_KEY.
//
// Usage:
//   set -a && source /c/Users/jacob/the-loop/.env.local && set +a
//   node scripts/repair-bartender-tt-vouchers-direct.js

const TT_BASE = 'https://api.tickettailor.com/v1'

function authHeader() {
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) return null
  return 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
}

async function fetchAll(path) {
  const auth = authHeader()
  const all = []
  let cursor = null
  for (let page = 0; page < 50; page++) {
    const url = new URL(`${TT_BASE}${path}`)
    url.searchParams.set('limit', '100')
    if (cursor) url.searchParams.set('starting_after', cursor)
    const res = await fetch(url.toString(), {
      headers: { Authorization: auth, Accept: 'application/json' },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`GET ${path} → ${res.status}: ${text.slice(0, 200)}`)
    }
    const payload = await res.json().catch(() => null)
    const data = payload?.data || []
    if (!data.length) break
    all.push(...data)
    if (data.length < 100) break
    cursor = data[data.length - 1].id
  }
  return all
}

async function updateDiscount(discountId, ticketTypeIds) {
  const params = new URLSearchParams()
  // Switch from percentage/0 to fixed_amount/1¢ so TT accepts the code at
  // checkout (it rejects discounts that don't lower the basket).
  params.set('type', 'fixed_amount')
  params.set('price', '1')
  for (const tid of ticketTypeIds) {
    params.append('ticket_types[]', tid)
  }
  const res = await fetch(`${TT_BASE}/discounts/${encodeURIComponent(discountId)}`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(),
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
  if (!process.env.TICKET_TAILOR_API_KEY) {
    console.error('Missing TICKET_TAILOR_API_KEY')
    process.exit(1)
  }

  const eventSeries = await fetchAll('/event_series')
  const ticketTypeIds = []
  for (const es of eventSeries) {
    for (const tt of es?.default_ticket_types || []) {
      if (tt?.id) ticketTypeIds.push(tt.id)
    }
  }
  if (!ticketTypeIds.length) {
    console.error('No ticket_types found across event_series. Aborting.')
    process.exit(1)
  }
  console.log(`Found ${ticketTypeIds.length} ticket_types across ${eventSeries.length} event series.`)

  const discounts = await fetchAll('/discounts')
  const bartenderDiscounts = discounts.filter(d =>
    typeof d?.name === 'string' && d.name.toLowerCase().startsWith('bartender:'),
  )
  console.log(`Found ${bartenderDiscounts.length} bartender discounts to repair (out of ${discounts.length} total).`)

  let fixed = 0
  let failed = 0
  for (const d of bartenderDiscounts) {
    process.stdout.write(`[${d.id}] code=${d.code} name="${d.name}" ... `)
    const result = await updateDiscount(d.id, ticketTypeIds)
    if (result.ok) {
      console.log('OK')
      fixed++
    } else {
      console.log(`FAILED status=${result.status} body=${JSON.stringify(result.body).slice(0, 300)}`)
      failed++
    }
    await sleep(220)
  }

  console.log(`\nDone. fixed=${fixed} failed=${failed} total=${bartenderDiscounts.length}`)
}

main().catch(err => {
  console.error('Repair crashed:', err.message)
  process.exit(1)
})
