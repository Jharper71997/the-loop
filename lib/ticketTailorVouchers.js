// Ticket Tailor $0.01-off discount code per bartender. Customers buying
// through TT can type a bartender's share_code in the "promo credit or
// voucher code" field at checkout and the leaderboard credits the order to
// that bartender.
//
// We use TT's /v1/discounts endpoint with type=fixed_amount, price=1 (one
// cent). 0% off is rejected by TT's validator ("will not lower the basket
// value"), so we shave a penny — the cheapest amount that satisfies TT
// without being a real marketing discount. One discount per bartender,
// code = share_code.
//
// IMPORTANT: TT's discount API does NOT default to "applies to everything"
// if no ticket_type_ids are provided — the discount ends up valid for nothing
// and customers see "Discount code X has expired or is not valid for this
// event." at checkout. We fetch every ticket_type id (one per default ticket
// type per event_series) and pass them all as ticket_types[] so the
// discount works on every current event. Repaired existing discounts via
// POST /v1/discounts/:id with the same field.
//
// Failures here never block bartender signup — the QR/URL referral path still
// works for attribution. Failures are surfaced via the `alerts` table.

import { recordAlert } from '@/lib/alerts'

const TT_BASE = 'https://api.tickettailor.com/v1'

function authHeader() {
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) return null
  return 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
}

// Pull every default ticket_type id from every event_series in the TT
// account. Passed as ticket_types[] when creating a discount so the code
// is applicable to any event the customer might be buying. Returns [] if the
// API key is missing or the call fails — callers fall back to creating an
// unscoped discount (which TT will still reject at checkout, but at least we
// don't crash).
export async function fetchAllTicketTypeIds() {
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

function buildDiscountForm({ code, displayName, ticketTypeIds }) {
  const params = new URLSearchParams()
  params.set('name', `Bartender: ${displayName || code}`)
  params.set('code', code)
  params.set('type', 'fixed_amount')
  params.set('price', '1')
  for (const tid of ticketTypeIds || []) {
    params.append('ticket_types[]', tid)
  }
  return params
}

// POST /v1/discounts — create a 0%-off discount code scoped to every ticket
// type in the account.
async function createDiscount({ code, displayName, ticketTypeIds }) {
  const auth = authHeader()
  if (!auth) return { ok: false, reason: 'no_api_key' }

  const res = await fetch(`${TT_BASE}/discounts`, {
    method: 'POST',
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: buildDiscountForm({ code, displayName, ticketTypeIds }).toString(),
  })

  const text = await res.text()
  let payload = null
  try { payload = text ? JSON.parse(text) : null } catch {}

  if (!res.ok) {
    return {
      ok: false,
      reason: 'tt_error',
      status: res.status,
      body: payload || text,
    }
  }
  return { ok: true, discountId: payload?.id || null, payload }
}

// POST /v1/discounts/:id — patch an existing discount so it applies to every
// current ticket type. Used to repair discounts that ended up scoped to
// nothing (symptom: "code has expired or is not valid for this event" at
// checkout). TT's update verb is POST, not PUT — PUT returns 404.
export async function updateDiscountTicketTypes(discountId, ticketTypeIds) {
  const auth = authHeader()
  if (!auth) return { ok: false, reason: 'no_api_key' }

  const params = new URLSearchParams()
  for (const tid of ticketTypeIds || []) {
    params.append('ticket_types[]', tid)
  }

  const res = await fetch(`${TT_BASE}/discounts/${encodeURIComponent(discountId)}`, {
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
    return { ok: false, reason: 'tt_error', status: res.status, body: payload || text }
  }
  return { ok: true, payload }
}

// Idempotent: if the bartender row already has a tt_voucher_id, no-op. Else
// create the discount and persist the id. Fire-and-forget from the signup
// route — we don't await this so signup latency isn't bound to TT.
export async function ensureBartenderVoucher(supabase, { slug, shareCode, displayName }) {
  if (!shareCode) return { skipped: 'no_share_code' }

  const { data: row } = await supabase
    .from('bartenders')
    .select('tt_voucher_id')
    .eq('slug', slug)
    .maybeSingle()
  if (row?.tt_voucher_id) return { skipped: 'already_has_discount', discountId: row.tt_voucher_id }

  const ticketTypeIds = await fetchAllTicketTypeIds()
  const result = await createDiscount({ code: shareCode, displayName, ticketTypeIds })
  if (!result.ok) {
    await recordAlert(supabase, {
      kind: 'tt_voucher_failed',
      severity: 'warn',
      subject: `TT discount create failed for ${displayName || slug}`,
      body: typeof result.body === 'string' ? result.body : JSON.stringify(result.body),
      context: { slug, shareCode, status: result.status, reason: result.reason },
    })
    return result
  }

  if (result.discountId) {
    await supabase
      .from('bartenders')
      .update({ tt_voucher_id: result.discountId })
      .eq('slug', slug)
  }

  return { ok: true, discountId: result.discountId }
}
