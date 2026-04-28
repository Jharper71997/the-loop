import { timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { handleOrder, handleVoidedTicket } from '@/lib/ticketTailor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Shared-secret check for the TT webhook. TT does not natively HMAC-sign,
// but the webhook URL configured in TT can carry a long random ?token=...
// value; we require it to match TT_WEBHOOK_TOKEN. If the env var is unset we
// fall open (legacy mode) but warn loudly in the log so a misconfig is
// visible. Once TT_WEBHOOK_TOKEN is set in Vercel + the matching ?token=...
// is appended to the TT dashboard URL, anonymous POSTs will be rejected.
function denyIfWebhookSecretMismatch(req) {
  const expected = process.env.TT_WEBHOOK_TOKEN
  if (!expected) {
    console.warn('[ticket-tailor-webhook] TT_WEBHOOK_TOKEN not set — anyone can POST forged orders')
    return null
  }
  const url = new URL(req.url)
  const provided = url.searchParams.get('token') || ''
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

export async function POST(req) {
  const denied = denyIfWebhookSecretMismatch(req)
  if (denied) return denied

  const rawBody = await req.text()

  let body
  try {
    body = JSON.parse(rawBody)
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const supabase = supabaseAdmin()
  const eventType = String(body.event || body.type || 'unknown').toLowerCase()
  const externalId = body.payload?.id || body.id || null

  const { data: logRow } = await supabase
    .from('webhook_events')
    .insert({
      source: 'ticket_tailor',
      event_type: eventType,
      external_id: externalId,
      payload: body,
      status: 'received',
    })
    .select('id')
    .single()

  const logId = logRow?.id

  async function markProcessed(status, error) {
    if (!logId) return
    await supabase
      .from('webhook_events')
      .update({ status, error: error ? String(error).slice(0, 2000) : null, processed_at: new Date().toISOString() })
      .eq('id', logId)
  }

  try {
    let handled = true
    if (eventType === 'order.created' || eventType === 'order.updated') {
      await handleOrder(supabase, body.payload)
    } else if (eventType === 'issued_ticket.voided' || eventType === 'ticket.voided') {
      await handleVoidedTicket(supabase, body.payload)
    } else {
      handled = false
    }

    await markProcessed(handled ? 'ok' : 'ignored')
    return Response.json({ received: true })
  } catch (err) {
    console.error('[ticket-tailor-webhook] error', err)
    await markProcessed('error', err?.message || err)
    return Response.json({ received: true, warning: 'processing_error' })
  }
}
