import { sendBookingConfirmation, sendRiderConfirmation } from './sms'
import { sendEmail } from './email'
import { bookingConfirmationHtml, bookingConfirmationText } from './emailTemplates'
import { appUrl } from './stripe'
import { randomCode } from './qrcodeAi'
import { normalizePhone } from './phone'
import { normalizeEmail } from './contacts'
import { recordAlert } from './alerts'
import { sendPushToContact } from './push'

// finalizeBooking — runs the post-payment side effects that both the native
// Stripe webhook and the Ticket Tailor ingestion need: mint a per-ticket
// check-in QR for every active order_item, then text + email the buyer +
// each rider their confirmation with one /tickets/<code> link per ticket.
//
// Idempotent by default: order_items that already have a checkin QR keep
// theirs; SMS/email only sends if last_confirmation_sent_at < paid_at.
//
// opts.skipSms — set when replaying old orders (TT backfill). QRs still mint.
// opts.force — bypass the dedup window (used by self-serve resend).
export async function finalizeBooking(supabase, orderId, opts = {}) {
  const { skipSms = false, force = false } = opts
  if (!orderId) return { skipped: 'no_order_id' }

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, contact_id, event_id, buyer_phone, buyer_email, buyer_name, party_size, paid_at')
    .eq('id', orderId)
    .maybeSingle()
  if (orderErr) throw new Error(`order read: ${orderErr.message}`)
  if (!order) return { skipped: 'order_not_found' }

  // Skip voided items everywhere — they shouldn't get tickets, SMS, or email.
  const { data: items, error: itemsErr } = await supabase
    .from('order_items')
    .select('id, rider_first_name, rider_last_name, contact_id, rider_phone, rider_email, claim_token, claimed_at, voided_at')
    .eq('order_id', order.id)
    .is('voided_at', null)
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
  // consistently across replays. Skip claim-link items that haven't been
  // claimed yet — they don't have a real rider name to show.
  const ticketLinks = items
    .filter(i => !i.claim_token || i.claimed_at)
    .map(item => ({
      name: riderName(item),
      url: `${appUrl()}/tickets/${existingByItem.get(item.id)}`,
    }))
    .filter(t => t.url)

  // Claim links to share with friends — buyer's confirmation includes one
  // per unclaimed seat so they can forward to each friend.
  const claimLinks = items
    .filter(i => i.claim_token && !i.claimed_at)
    .map(i => `${appUrl()}/c/${i.claim_token}`)

  let smsResult = null
  let riderSmsResults = []
  let emailResult = null
  let riderEmailResults = []

  if (!skipSms && order.event_id) {
    const { data: ev } = await supabase
      .from('events')
      .select('id, name, event_date, pickup_time')
      .eq('id', order.event_id)
      .maybeSingle()

    if (ev) {
      // ---- Buyer SMS ----
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
          await recordAlert(supabase, {
            kind: 'sms_failed',
            subject: `Buyer SMS failed for order ${order.id.slice(0, 8)}`,
            body: err?.message || String(err),
            context: { order_id: order.id, channel: 'sms', recipient: 'buyer' },
          })
        }
      }

      // ---- Buyer Push (best effort — silent if no subscription) ----
      if (order.contact_id) {
        try {
          await sendPushToContact(order.contact_id, {
            title: 'You\'re on the Loop',
            body: `Brew Loop ${formatEventLabel(ev)} — tap to view your ticket.`,
            url: ticketLinks[0]?.url ? new URL(ticketLinks[0].url).pathname : '/my-tickets',
            tag: `order-${order.id}`,
          })
        } catch (err) {
          console.error('[finalizeBooking] buyer push failed', err)
        }
      }

      // ---- Buyer Email ----
      if (order.buyer_email) {
        try {
          const buyerContact = order.contact_id
            ? (await supabase.from('contacts').select('id, first_name, has_signed_waiver').eq('id', order.contact_id).maybeSingle()).data
            : null
          const waiverLink = buyerContact ? `${appUrl()}/waiver/${buyerContact.id}` : null
          emailResult = await sendEmail({
            to: order.buyer_email,
            subject: `Your Brew Loop ticket — ${formatEventLabel(ev)}`,
            html: bookingConfirmationHtml({
              buyer: { firstName: buyerContact?.first_name || splitFirstName(order.buyer_name) },
              event: ev,
              ticketLinks,
              waiverLink,
              hasSignedWaiver: !!buyerContact?.has_signed_waiver,
              claimLinks,
            }),
            text: bookingConfirmationText({
              buyer: { firstName: buyerContact?.first_name || splitFirstName(order.buyer_name) },
              event: ev,
              ticketLinks,
              waiverLink,
              hasSignedWaiver: !!buyerContact?.has_signed_waiver,
              claimLinks,
            }),
          })
        } catch (err) {
          console.error('[finalizeBooking] buyer email failed', err)
          emailResult = { error: err?.message || String(err) }
          await recordAlert(supabase, {
            kind: 'email_failed',
            subject: `Buyer email failed for order ${order.id.slice(0, 8)}`,
            body: err?.message || String(err),
            context: { order_id: order.id, channel: 'email', recipient: 'buyer' },
          })
        }
      }

      // ---- Per-rider SMS + email ----
      const fan = await sendPerRiderConfirmations(supabase, {
        order, event: ev, items, existingByItem, force,
      })
      riderSmsResults = fan.sms
      riderEmailResults = fan.email
    }
  }

  return {
    ok: true,
    order_id: order.id,
    items: items.length,
    minted_now: mintedNow,
    sms: smsResult,
    rider_sms: riderSmsResults,
    email: emailResult,
    rider_email: riderEmailResults,
    claim_links: claimLinks,
  }
}

// Texts + emails each rider whose phone/email differs from the buyer's, has
// SMS consent, and hasn't already been confirmed for this order. Each rider
// gets their own /tickets/<code> + /waiver/<id> link so they don't have to
// ask the buyer.
async function sendPerRiderConfirmations(supabase, { order, event, items, existingByItem, force }) {
  const buyerNorm = normalizePhone(order.buyer_phone)
  const buyerEmailNorm = normalizeEmail(order.buyer_email)
  const paidAt = order.paid_at ? new Date(order.paid_at).getTime() : Date.now()

  const contactIds = [...new Set(items.map(i => i.contact_id).filter(Boolean))]
  if (!contactIds.length) return { sms: [], email: [] }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, first_name, phone, email, sms_consent, has_signed_waiver, last_confirmation_sent_at, last_confirmation_email_sent_at')
    .in('id', contactIds)
  const contactById = new Map((contacts || []).map(c => [c.id, c]))

  const smsResults = []
  const emailResults = []
  for (const item of items) {
    if (item.claim_token && !item.claimed_at) {
      smsResults.push({ item: item.id, skipped: 'unclaimed' })
      emailResults.push({ item: item.id, skipped: 'unclaimed' })
      continue
    }
    const code = existingByItem.get(item.id)
    if (!code) continue
    const contact = item.contact_id ? contactById.get(item.contact_id) : null
    if (!contact) { smsResults.push({ item: item.id, skipped: 'no_contact' }); continue }

    // ---- Rider SMS ----
    const riderPhone = normalizePhone(contact.phone || item.rider_phone)
    if (!riderPhone) { smsResults.push({ contact: contact.id, skipped: 'no_phone' }) }
    else if (riderPhone === buyerNorm) { smsResults.push({ contact: contact.id, skipped: 'is_buyer' }) }
    else if (!contact.sms_consent) { smsResults.push({ contact: contact.id, skipped: 'no_consent' }) }
    else if (!force && (contact.last_confirmation_sent_at && new Date(contact.last_confirmation_sent_at).getTime() >= paidAt)) {
      smsResults.push({ contact: contact.id, skipped: 'already_sent' })
    } else {
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
        smsResults.push({ contact: contact.id, sent: true })
        // Fire-and-forget push alongside SMS. Push failures don't block.
        try {
          await sendPushToContact(contact.id, {
            title: 'You\'re on the Loop',
            body: `Brew Loop ${formatEventLabel(event)} — tap to view your ticket.`,
            url: `/tickets/${code}`,
            tag: `order-${order.id}-${contact.id}`,
          })
        } catch (err) {
          console.error('[finalizeBooking] rider push failed', err)
        }
      } catch (err) {
        console.error('[finalizeBooking] rider SMS failed', err)
        smsResults.push({ contact: contact.id, error: err?.message || String(err) })
        await recordAlert(supabase, {
          kind: 'sms_failed',
          subject: `Rider SMS failed for order ${order.id.slice(0, 8)}`,
          body: err?.message || String(err),
          context: { order_id: order.id, contact_id: contact.id, channel: 'sms', recipient: 'rider' },
        })
      }
    }

    // ---- Rider Email ----
    const riderEmail = normalizeEmail(contact.email || item.rider_email)
    if (!riderEmail) { emailResults.push({ contact: contact.id, skipped: 'no_email' }); continue }
    if (riderEmail === buyerEmailNorm) { emailResults.push({ contact: contact.id, skipped: 'is_buyer' }); continue }
    if (!force && contact.last_confirmation_email_sent_at && new Date(contact.last_confirmation_email_sent_at).getTime() >= paidAt) {
      emailResults.push({ contact: contact.id, skipped: 'already_sent' }); continue
    }
    try {
      const waiverLink = `${appUrl()}/waiver/${contact.id}`
      await sendEmail({
        to: riderEmail,
        subject: `Your Brew Loop ticket — ${formatEventLabel(event)}`,
        html: bookingConfirmationHtml({
          buyer: { firstName: contact.first_name || item.rider_first_name || '' },
          event,
          ticketLinks: [{ name: riderName(item), url: `${appUrl()}/tickets/${code}` }],
          waiverLink,
          hasSignedWaiver: !!contact.has_signed_waiver,
        }),
        text: bookingConfirmationText({
          buyer: { firstName: contact.first_name || item.rider_first_name || '' },
          event,
          ticketLinks: [{ name: riderName(item), url: `${appUrl()}/tickets/${code}` }],
          waiverLink,
          hasSignedWaiver: !!contact.has_signed_waiver,
        }),
      })
      await supabase
        .from('contacts')
        .update({ last_confirmation_email_sent_at: new Date().toISOString() })
        .eq('id', contact.id)
      emailResults.push({ contact: contact.id, sent: true })
    } catch (err) {
      console.error('[finalizeBooking] rider email failed', err)
      emailResults.push({ contact: contact.id, error: err?.message || String(err) })
      await recordAlert(supabase, {
        kind: 'email_failed',
        subject: `Rider email failed for order ${order.id.slice(0, 8)}`,
        body: err?.message || String(err),
        context: { order_id: order.id, contact_id: contact.id, channel: 'email', recipient: 'rider' },
      })
    }
  }
  return { sms: smsResults, email: emailResults }
}

function riderName(item) {
  return [item.rider_first_name, item.rider_last_name].filter(Boolean).join(' ') || ''
}

function splitFirstName(fullName) {
  if (!fullName) return ''
  return String(fullName).trim().split(/\s+/)[0] || ''
}

function formatEventLabel(event) {
  if (!event?.event_date) return event?.name || 'this weekend'
  try {
    const d = new Date(`${event.event_date}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return event?.event_date }
}
