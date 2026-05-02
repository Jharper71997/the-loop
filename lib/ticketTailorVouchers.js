// Ticket Tailor voucher creation per bartender, so customers buying on TT can
// type a bartender's share_code in the "promo credit or voucher code" field at
// checkout and have the order attributed to that bartender on the leaderboard.
//
// TT's voucher model is: ONE voucher_group acts as a container with the
// discount rules (type + value). Per-bartender voucher_codes live inside it.
// We use a 0%-off voucher group so codes attribute orders without changing the
// ticket price. The group is provisioned manually once by Jacob and its id
// goes into TICKET_TAILOR_BARTENDER_VOUCHER_GROUP_ID. Per-bartender codes are
// then created on demand from this helper.
//
// Failures here never block bartender signup — the QR/URL referral path still
// works for attribution. We surface failures via the `alerts` table so they're
// visible in the admin alerts view.

import { recordAlert } from '@/lib/alerts'

const TT_BASE = 'https://api.tickettailor.com/v1'

function authHeader() {
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) return null
  return 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
}

// POST /v1/voucher_codes — create one code under the configured group.
// Request body shape per TT API:
//   { voucher_group_id, code, [code_quantity] }
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
    return {
      ok: false,
      reason: 'tt_error',
      status: res.status,
      body: payload || text,
    }
  }
  return { ok: true, voucherId: payload?.id || null, payload }
}

// Idempotent: if the bartender row already has a tt_voucher_id, no-op. Else
// create the voucher and persist the id. Fire-and-forget from the signup
// route — we don't await this so signup latency isn't bound to TT.
export async function ensureBartenderVoucher(supabase, { slug, shareCode, displayName }) {
  if (!shareCode) return { skipped: 'no_share_code' }

  const groupId = (process.env.TICKET_TAILOR_BARTENDER_VOUCHER_GROUP_ID || '').trim()
  if (!groupId) {
    // First-time setup hasn't happened yet. Don't spam alerts on every
    // signup — just log and skip. Jacob will run the backfill script once
    // the group is configured.
    console.warn('[tt-voucher] TICKET_TAILOR_BARTENDER_VOUCHER_GROUP_ID not set; skipping voucher create for', slug)
    return { skipped: 'no_group_id' }
  }

  // Skip if already has a voucher id.
  const { data: row } = await supabase
    .from('bartenders')
    .select('tt_voucher_id')
    .eq('slug', slug)
    .maybeSingle()
  if (row?.tt_voucher_id) return { skipped: 'already_has_voucher', voucherId: row.tt_voucher_id }

  const result = await createVoucherCode({ groupId, code: shareCode })
  if (!result.ok) {
    await recordAlert(supabase, {
      kind: 'tt_voucher_failed',
      severity: 'warn',
      subject: `TT voucher create failed for ${displayName || slug}`,
      body: typeof result.body === 'string' ? result.body : JSON.stringify(result.body),
      context: { slug, shareCode, status: result.status, reason: result.reason },
    })
    return result
  }

  if (result.voucherId) {
    await supabase
      .from('bartenders')
      .update({ tt_voucher_id: result.voucherId })
      .eq('slug', slug)
  }

  return { ok: true, voucherId: result.voucherId }
}
