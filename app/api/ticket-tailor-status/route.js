import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/ticket-tailor-status
// Diagnostic endpoint — answers "why isn't the TT sync working" in one fetch.
//
// Returns:
//   api_key_set: bool       — TICKET_TAILOR_API_KEY env var present?
//   api_key_probe: {        — did the key actually work when we hit /events?
//     ok: bool,
//     status: number | null,
//     error: string | null,
//   }
//   groups_with_tt: number  — count of groups rows with a non-null tt_event_id
//   webhooks_24h: number    — TT webhooks received in last 24 hours
//   last_webhook: {         — most recent TT webhook_events row (any status)
//     received_at: ts,
//     status: string,
//     event_type: string,
//     error: string | null,
//   } | null
//   tt_orders_in_db: number — orders rows tagged metadata.source=ticket_tailor
export async function GET() {
  const supabase = supabaseAdmin()
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  const apiKeySet = !!apiKey

  let apiKeyProbe = { ok: null, status: null, error: null }
  if (apiKeySet) {
    try {
      const auth = 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
      const res = await fetch('https://api.tickettailor.com/v1/events?limit=1', {
        headers: { Authorization: auth, Accept: 'application/json' },
      })
      if (res.ok) {
        apiKeyProbe = { ok: true, status: res.status, error: null }
      } else {
        const text = await res.text().catch(() => '')
        apiKeyProbe = {
          ok: false,
          status: res.status,
          error: text.slice(0, 200) || res.statusText,
        }
      }
    } catch (err) {
      apiKeyProbe = { ok: false, status: null, error: `fetch: ${err?.message || err}` }
    }
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [ttGroupsRes, webhooks24hRes, lastWebhookRes, ttOrdersRes] = await Promise.all([
    supabase
      .from('groups')
      .select('id', { count: 'exact', head: true })
      .not('tt_event_id', 'is', null),
    supabase
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'ticket_tailor')
      .gte('received_at', since24h),
    supabase
      .from('webhook_events')
      .select('received_at, status, event_type, error')
      .eq('source', 'ticket_tailor')
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('metadata->>source', 'ticket_tailor'),
  ])

  return Response.json({
    api_key_set: apiKeySet,
    api_key_probe: apiKeyProbe,
    groups_with_tt: ttGroupsRes.count ?? 0,
    webhooks_24h: webhooks24hRes.count ?? 0,
    last_webhook: lastWebhookRes.data || null,
    tt_orders_in_db: ttOrdersRes.count ?? 0,
  })
}
