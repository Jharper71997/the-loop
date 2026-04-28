import { sendBookingConfirmation, sendRiderConfirmation } from './sms'
import { appUrl } from './stripe'
import { randomCode } from './qrcodeAi'
import { normalizePhone } from './phone'

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
    .select('id, rider_first_name, rider_last_name, contact_id, rider_phone')
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
  let riderSmsResults = []
  if (!skipSms && order.event_id) {
    const { data: ev } = await supabase
      .from('events')
      .select('id, name, event_date, pickup_time')
      .eq('id', order.event_id)
      .maybeSingle()

    if (ev) {
      if (order.buyer_phone) {
        try {
          smsResult = await sendBookingConfirmation(order.buyer_phone, {
            buyer: { name: order.buyer_name || '' },
            event: ev,
            ticketLinks,
          })
        } catch (err) {
          console.error('[finalizeBooking] buyer SMS failed', err)
          smsResult = { error: err?.message || String(err) }
        }
      }

      riderSmsResults = await sendPerRiderConfirmations(supabase, {
        order,
        event: ev,
        items,
        existingByItem,
      })
    }
  }

  return {
    ok: true,
    order_id: order.id,
    items: items.length,
    minted_now: mintedNow,
    sms: smsResult,
    rider_sms: riderSmsResults,
  }
}

// Texts each rider whose phone is different from the buyer's, has SMS consent,
// and hasn't already been confirmed for this order. Each rider gets their own
// /tickets/<code> + /waiver/<id> link so they don't have to ask the buyer.
async function sendPerRiderConfirmations(supabase, { order, event, items, existingByItem }) {
  const buyerNorm = normalizePhone(order.buyer_phone)
  const paidAt = order.paid_at ? new Date(order.paid_at).getTime() : Date.now()

  const contactIds = [...new Set(items.map(i => i.contact_id).filter(Boolean))]
  if (!contactIds.length) return []

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, phone, sms_consent, has_signed_waiver, last_confirmation_sent_at')
    .in('id', contactIds)
  const contactById = new Map((contacts || []).map(c => [c.id, c]))

  const results = []
  for (const item of items) {
    const code = existingByItem.get(item.id)
    if (!code) continue
    const contact = item.contact_id ? contactById.get(item.contact_id) : null
    if (!contact) { results.push({ item: item.id, skipped: 'no_contact' }); continue }

    const riderPhone = normalizePhone(contact.phone || item.rider_phone)
    if (!riderPhone) { results.push({ contact: contact.id, skipped: 'no_phone' }); continue }
    if (riderPhone === buyerNorm) { results.push({ contact: contact.id, skipped: 'is_buyer' }); continue }
    if (!contact.sms_consent) { results.push({ contact: contact.id, skipped: 'no_consent' }); continue }

    const lastSent = contact.last_confirmation_sent_at
      ? new Date(contact.last_confirmation_sent_at).getTime()
      : 0
    if (lastSent >= paidAt) { results.push({ contact: contact.id, skipped: 'already_sent' }); continue }

    try {
      await sendRiderConfirmation(riderPhone, {
        rider: {
          firstName: contact.first_name || item.rider_first_name || '',
          ticketUrl: `${appUrl()}/tickets/${code}`,
          waiverUrl: `${appUrl()}/waiver/${contact.id}`,
          hasSignedWaiver: !!contact.has_signed_waiver,
        },
        event,
      })
      await supabase
        .from('contacts')
        .update({ last_confirmation_sent_at: new Date().toISOString() })
        .eq('id', contact.id)
      results.push({ contact: contact.id, sent: true })
    } catch (err) {
      console.error('[finalizeBooking] rider SMS failed', err)
      results.push({ contact: contact.id, error: err?.message || String(err) })
    }
  }
  return results
}

function riderName(item) {
  return [item.rider_first_name, item.rider_last_name].filter(Boolean).join(' ') || ''
}
