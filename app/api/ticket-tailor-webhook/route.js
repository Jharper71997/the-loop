import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { handleOrder, handleVoidedTicket } from '@/lib/ticketTailor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
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
