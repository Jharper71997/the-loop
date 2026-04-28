import { sendBookingConfirmation } from './sms'
import { appUrl } from './stripe'
import { randomCode } from './qrcodeAi'

// finalizeBooking — runs the post-payment side effects that both the native
// Stripe webhook and the Ticket Tailor ingestion need: mint a per-ticket
// check-in QR for every order_item, then text the buyer their booking
// confirmation with one /tickets/<code> link per ticket.
//
// Idempotent: order_items that already have a checkin QR keep theirs; SMS is
// skipped if every item was already minted (so backfill replays don't spam).
//
// opts.skipSms — set when replaying old orders (TT backfill). QRs still mint.
export async function finalizeBooking(supabase, orderId, opts = {}) {
  const { skipSms = false } = opts
  if (!orderId) return { skipped: 'no_order_id' }

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, contact_id, event_id, buyer_phone, buyer_name, party_size, paid_at')
    .eq('id', orderId)
    .maybeSingle()
  if (orderErr) throw new Error(`order read: ${orderErr.message}`)
  if (!order) return { skipped: 'order_not_found' }

  const { data: items, error: itemsErr } = await supabase
    .from('order_items')
    .select('id, rider_first_name, rider_last_name, contact_id')
    .eq('order_id', order.id)
  if (itemsErr) throw new Error(`order_items read: ${itemsErr.message}`)
  if (!items || items.length === 0) return { skipped: 'no_items' }

  const itemIds = items.map(i => i.id)
  const { data: existingQrs } = await supabase
    .from('qr_codes')
    .select('code, order_item_id')
    .eq('kind', 'checkin')
    .in('order_item_id', itemIds)

  const existingByItem = new Map((existingQrs || []).map(q => [q.order_item_id, q.code]))

  const toInsert = []
  for (const item of items) {
    if (existingByItem.has(item.id)) continue
    const code = randomCode(8)
    toInsert.push({
      code,
      kind: 'checkin',
      label: `Check-in · ${riderName(item) || order.id.slice(0, 6)}`,
      target_url: `${appUrl()}/r/${code}`,
      order_item_id: item.id,
    })
  }

  let mintedNow = 0
  if (toInsert.length) {
    const { error: insertErr } = await supabase.from('qr_codes').insert(toInsert)
    if (insertErr) throw new Error(`qr_codes insert: ${insertErr.message}`)
    mintedNow = toInsert.length
    for (const row of toInsert) existingByItem.set(row.order_item_id, row.code)
  }

  // Build ticket links in stable item order so the SMS lists riders
  // consistently across replays.
  const ticketLinks = items.map(item => ({
    name: riderName(item),
    url: `${appUrl()}/tickets/${existingByItem.get(item.id)}`,
  })).filter(t => t.url)

  let smsResult = null
  if (!skipSms && order.buyer_phone && order.event_id) {
    const { data: ev } = await supabase
      .from('events')
      .select('id, name, event_date, pickup_time')
      .eq('id', order.event_id)
      .maybeSingle()

    if (ev) {
      try {
        smsResult = await sendBookingConfirmation(order.buyer_phone, {
          buyer: { name: order.buyer_name || '' },
          event: ev,
          ticketLinks,
        })
      } catch (err) {
        console.error('[finalizeBooking] SMS failed', err)
        smsResult = { error: err?.message || String(err) }
      }
    }
  }

  return {
    ok: true,
    order_id: order.id,
    items: items.length,
    minted_now: mintedNow,
    sms: smsResult,
  }
}

function riderName(item) {
  return [item.rider_first_name, item.rider_last_name].filter(Boolean).join(' ') || ''
}
