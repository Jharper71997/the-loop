import { randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { createBookingCheckoutSession } from '@/lib/stripe'
import { upsertContactByPhoneOrEmail, normalizeEmail } from '@/lib/contacts'
import { normalizePhone } from '@/lib/phone'
import { getCurrentWaiverVersion, contactHasSignedCurrent, recordSignature } from '@/lib/waiver'
import { syncTtForEvent } from '@/lib/ticketTailorSync'
import { getActivePass } from '@/lib/loopPass'
import { finalizeBooking } from '@/lib/booking'

function mintClaimToken() {
  // 24 bytes => 32 url-safe base64 chars. Long enough that brute-forcing
  // an unclaimed token is computationally infeasible; short enough to copy
  // into a text message without wrapping.
  return randomBytes(24).toString('base64url')
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/checkout
// Body:
// {
//   event_id: uuid,
//   buyer: { first_name, last_name, email, phone, sms_consent },
//   riders: [
//     {
//       ticket_type_id: uuid,
//       first_name, last_name, email, phone,
//       signed_self: bool,           // rider is signing themselves
//       signed_by_buyer: bool,       // buyer is signing on this rider's behalf
//       typed_name: string           // typed signature (required unless already on file)
//     }, ...
//   ],
//   buyer_typed_name: string          // required if buyer or any rider is signing
// }
// Thin wrapper so an uncaught throw anywhere in the handler (a Supabase error
// bubbling up from upsertContactByPhoneOrEmail / getCurrentWaiverVersion / etc.)
// always returns a JSON body instead of a bare 500. A bare 500 has an empty
// body, which makes the client's res.json() throw "Unexpected end of JSON
// input" and surfaces a cryptic error to the rider. Real cause is logged here.
export async function POST(req) {
  try {
    return await handleCheckout(req)
  } catch (err) {
    console.error('[checkout] unhandled error', err)
    return Response.json({ error: 'checkout_failed' }, { status: 500 })
  }
}

async function handleCheckout(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const { event_id, buyer, riders, buyer_typed_name, client_token } = body || {}
  if (!event_id || !buyer || !Array.isArray(riders) || !riders.length) {
    return Response.json({ error: 'missing event_id, buyer, or riders' }, { status: 400 })
  }

  const supabase = supabaseAdmin()

  // Idempotent retry: if the rider double-taps Pay or the network retries the
  // POST, the same client_token replays the same Stripe URL instead of
  // creating a second order + second Checkout session.
  if (client_token) {
    const { data: existing } = await supabase
      .from('orders')
      .select('id, stripe_checkout_url, status, created_at')
      .eq('event_id', event_id)
      .eq('client_token', client_token)
      .maybeSingle()
    if (existing?.stripe_checkout_url) {
      return Response.json({
        checkout_url: existing.stripe_checkout_url,
        order_id: existing.id,
        replayed: true,
      })
    }
    if (existing) {
      // No URL yet. If the row is fresh, the first request is still mid-flight
      // — ask the client to wait. If it's older than 30s the Stripe call
      // almost certainly failed (the row would be unrecoverable otherwise),
      // so wipe it and fall through to a clean retry.
      const ageMs = Date.now() - new Date(existing.created_at).getTime()
      if (ageMs < 30_000) {
        return Response.json({ error: 'in_flight_retry' }, { status: 409 })
      }
      await supabase.from('orders').delete().eq('id', existing.id)
    }
  }

  const { data: event } = await supabase
    .from('events')
    .select('id, name, event_date, pickup_time, status, group_id')
    .eq('id', event_id)
    .maybeSingle()
  if (!event) return Response.json({ error: 'event not found' }, { status: 404 })
  if (event.status !== 'on_sale') {
    return Response.json({ error: `event_not_on_sale_${event.status}` }, { status: 400 })
  }

  const ticketTypeIds = [...new Set(riders.map(r => r.ticket_type_id).filter(Boolean))]
  const { data: ticketTypes } = await supabase
    .from('ticket_types')
    .select('id, name, price_cents, stop_index, capacity, event_id, active')
    .in('id', ticketTypeIds)
  const ttById = new Map((ticketTypes || []).map(t => [t.id, t]))

  for (const r of riders) {
    const tt = ttById.get(r.ticket_type_id)
    if (!tt || tt.event_id !== event.id || !tt.active) {
      return Response.json({ error: 'invalid ticket_type_id' }, { status: 400 })
    }
  }

  // Walk-on pickup. A ticket type with no stop_index has no bar attached, so the
  // rider chose a pickup bar at checkout (an index into the night's schedule).
  // Validate it against the schedule and require it when bars exist. Per-bar
  // tickets ignore this — their pickup is the ticket type's own stop_index.
  let scheduleLen = 0
  if (event.group_id) {
    const { data: g } = await supabase
      .from('groups').select('schedule').eq('id', event.group_id).maybeSingle()
    scheduleLen = Array.isArray(g?.schedule) ? g.schedule.length : 0
  }
  function pickupIndexFor(r) {
    const tt = ttById.get(r.ticket_type_id)
    if (!tt || tt.stop_index != null) return null
    const raw = Number(r.pickup_stop_index)
    return Number.isInteger(raw) && raw >= 0 && raw < scheduleLen ? raw : null
  }
  for (const r of riders) {
    const tt = ttById.get(r.ticket_type_id)
    if (tt && tt.stop_index == null && scheduleLen > 0 && pickupIndexFor(r) == null) {
      return Response.json({ error: 'pickup_required' }, { status: 400 })
    }
  }

  // Per-stop capacity check. The shuttle has a physical cap (13) per pickup,
  // and that cap is shared across BOTH native Loop orders and Ticket Tailor
  // orders that have been mirrored into order_items via lib/ticketTailor.js.
  // TT-mirrored rows have a null ticket_type_id, so counting by ticket_type
  // alone misses them and oversells. Count by (event_id, stop_index) instead,
  // which captures both channels. Falls back to ticket_type_id for ticket
  // types that have no stop_index set yet (legacy / non-stop tickets).
  // VOIDED items are excluded — voiding is meant to free a seat back up.
  const pendingCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()

  const requestedByStop = new Map()
  const stopMeta = new Map()
  for (const r of riders) {
    const tt = ttById.get(r.ticket_type_id)
    if (!tt) continue
    const key = tt.stop_index != null ? `stop:${tt.stop_index}` : `tt:${tt.id}`
    requestedByStop.set(key, (requestedByStop.get(key) || 0) + 1)
    if (!stopMeta.has(key)) stopMeta.set(key, tt)
  }

  // Self-heal: clear pending orders for this event older than the cutoff so
  // their items stop holding seats. Cascade deletes order_items.
  await supabase
    .from('orders')
    .delete()
    .eq('event_id', event_id)
    .eq('status', 'pending')
    .lt('created_at', pendingCutoff)

  async function countTakenForStop(tt) {
    let paidQuery = supabase
      .from('order_items')
      .select('id, orders!inner(id, event_id, status)', { count: 'exact', head: true })
      .eq('orders.event_id', event.id)
      .is('voided_at', null)
      .eq('orders.status', 'paid')
    let pendingQuery = supabase
      .from('order_items')
      .select('id, orders!inner(id, event_id, status, created_at)', { count: 'exact', head: true })
      .eq('orders.event_id', event.id)
      .is('voided_at', null)
      .eq('orders.status', 'pending')
      .gte('orders.created_at', pendingCutoff)
    if (tt.stop_index != null) {
      paidQuery = paidQuery.eq('stop_index', tt.stop_index)
      pendingQuery = pendingQuery.eq('stop_index', tt.stop_index)
    } else {
      paidQuery = paidQuery.eq('ticket_type_id', tt.id)
      pendingQuery = pendingQuery.eq('ticket_type_id', tt.id)
    }
    const [{ count: paidCount }, { count: pendingCount }] = await Promise.all([paidQuery, pendingQuery])
    return (paidCount || 0) + (pendingCount || 0)
  }

  for (const [key, requested] of requestedByStop.entries()) {
    const tt = stopMeta.get(key)
    if (tt.capacity == null) continue
    const taken = await countTakenForStop(tt)
    if (taken + requested > tt.capacity) {
      return Response.json({
        error: 'sold_out',
        ticket_type_id: tt.id,
        ticket_type_name: tt.name,
        remaining: Math.max(0, tt.capacity - taken),
        requested,
      }, { status: 409 })
    }
  }

  const currentWaiver = await getCurrentWaiverVersion(supabase)
  if (!currentWaiver) {
    return Response.json({ error: 'waiver_not_configured' }, { status: 500 })
  }

  const buyerContact = await upsertContactByPhoneOrEmail(supabase, {
    firstName: buyer.first_name,
    lastName: buyer.last_name,
    email: buyer.email,
    phone: buyer.phone,
    smsConsent: !!buyer.sms_consent,
  })
  if (!buyerContact) {
    return Response.json({ error: 'buyer missing phone and email' }, { status: 400 })
  }

  const riderContacts = []
  for (const r of riders) {
    // Claim-link riders skip contact lookup entirely — the friend creates
    // their own contact when they open the claim URL.
    if (r.claim_link) {
      riderContacts.push({ rider: r, contact: null, claim: true })
      continue
    }

    const riderIsBuyer =
      (r.phone && normalizePhone(r.phone) === normalizePhone(buyer.phone)) ||
      (r.email && normalizeEmail(r.email) === normalizeEmail(buyer.email))

    let contact
    if (riderIsBuyer) {
      contact = buyerContact
    } else {
      contact = await upsertContactByPhoneOrEmail(supabase, {
        firstName: r.first_name,
        lastName: r.last_name,
        email: r.email,
        phone: r.phone,
      })
      if (!contact) {
        return Response.json({ error: 'rider missing phone and email' }, { status: 400 })
      }
    }
    riderContacts.push({ rider: r, contact })
  }

  const waiverQueue = []
  for (const rc of riderContacts) {
    if (rc.claim) continue // friend will sign at /c/<token>
    const alreadySigned = await contactHasSignedCurrent(supabase, rc.contact.id)
    if (alreadySigned) continue

    if (rc.rider.signed_self) {
      const typed = (rc.rider.typed_name || '').trim()
      if (!typed) return Response.json({ error: 'missing typed_name for rider signing self' }, { status: 400 })
      waiverQueue.push({
        contactId: rc.contact.id,
        typedName: typed,
        signedForContactId: null,
      })
    } else if (rc.rider.signed_by_buyer) {
      const typed = (buyer_typed_name || '').trim()
      if (!typed) return Response.json({ error: 'missing buyer_typed_name for group signing' }, { status: 400 })
      waiverQueue.push({
        contactId: rc.contact.id,
        typedName: typed,
        signedForContactId: buyerContact.id,
      })
    } else {
      return Response.json({
        error: 'unsigned_rider',
        contact_id: rc.contact.id,
        message: 'Every rider must either sign themselves or be signed for by the buyer',
      }, { status: 400 })
    }
  }

  // Bartender code → slug. Customer types e.g. "BRITTANY" at checkout; we
  // look it up case-insensitively against bartenders.share_code and stamp the
  // slug as qr_code so the existing attribution path (Stripe metadata →
  // webhook → orders.metadata.qr_code → leaderboard) credits the bartender.
  // Unknown / inactive codes are silently ignored — we don't want to block a
  // sale because a customer fat-fingered a code.
  let resolvedAttribution = body.attribution || null
  const bartenderCodeRaw = String(resolvedAttribution?.bartender_code || '').trim()
  if (bartenderCodeRaw) {
    const { data: bt } = await supabase
      .from('bartenders')
      .select('slug, active')
      .ilike('share_code', bartenderCodeRaw)
      .maybeSingle()
    if (bt && bt.active) {
      resolvedAttribution = { ...resolvedAttribution, qr_code: bt.slug }
    }
    delete resolvedAttribution.bartender_code
  }

  // Loop Pass redemption. A rider whose contact holds an active pass rides for
  // free: the seat still counts against capacity (already counted above) but is
  // dropped from the charge. One active pass covers one seat per order, so a
  // passholder can't cover their whole party off a single pass. Claim-link
  // riders have no contact yet, so they're never covered here.
  const usedPassContacts = new Set()
  for (const rc of riderContacts) {
    rc.covered = false
    if (rc.claim || !rc.contact?.id) continue
    if (usedPassContacts.has(rc.contact.id)) continue
    const pass = await getActivePass(supabase, rc.contact.id)
    if (pass) {
      rc.covered = true
      usedPassContacts.add(rc.contact.id)
    }
  }

  const priceForRc = rc => (rc.covered ? 0 : (ttById.get(rc.rider.ticket_type_id)?.price_cents || 0))
  const ticketCents = riderContacts.reduce((s, rc) => s + priceForRc(rc), 0)

  // Checkout add-ons. Re-price every selection against the catalog so a tampered
  // client can't set its own price. Unknown / inactive / wrong-event add-ons are
  // dropped silently rather than failing the sale.
  const addonRows = []
  const addonLineItems = []
  const requestedAddons = Array.isArray(body.addons) ? body.addons : []
  if (requestedAddons.length) {
    const addonIds = [...new Set(requestedAddons.map(a => a?.addon_id).filter(Boolean))]
    if (addonIds.length) {
      const { data: catalog } = await supabase
        .from('addons')
        .select('id, name, price_cents, active, event_id')
        .in('id', addonIds)
      const addonById = new Map((catalog || []).map(a => [a.id, a]))
      for (const a of requestedAddons) {
        const def = addonById.get(a?.addon_id)
        const qty = Math.max(0, Math.min(20, parseInt(a?.quantity, 10) || 0))
        if (!def || !def.active || qty < 1) continue
        if (def.event_id && def.event_id !== event.id) continue
        addonRows.push({ addon_id: def.id, name: def.name, unit_price_cents: def.price_cents, quantity: qty })
        addonLineItems.push({ name: def.name, unit_price_cents: def.price_cents, quantity: qty, addon: true })
      }
    }
  }
  const addonCents = addonRows.reduce((s, a) => s + a.unit_price_cents * a.quantity, 0)
  const totalCents = ticketCents + addonCents

  // Rider referral (leaderboard-only): resolve the referrer's code → contact and
  // stamp it on the order. No discount is applied. Self-referrals are ignored.
  let referrerContactId = null
  let referrerCode = String(resolvedAttribution?.referrer_code || '').trim()
  // Fall back to the durable cookie set by /invite/<code> — the rider may have
  // browsed from /events to a specific loop, dropping the URL param along the way.
  if (!referrerCode) {
    try { referrerCode = (await cookies()).get('bl_rref')?.value?.trim() || '' } catch {}
  }
  referrerCode = referrerCode.toUpperCase()
  if (referrerCode) {
    const { data: refContact } = await supabase
      .from('contacts')
      .select('id')
      .eq('referral_code', referrerCode)
      .maybeSingle()
    if (refContact && refContact.id !== buyerContact.id) referrerContactId = refContact.id
  }

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      contact_id: buyerContact.id,
      event_id: event.id,
      total_cents: totalCents,
      status: 'pending',
      buyer_email: normalizeEmail(buyer.email),
      buyer_phone: normalizePhone(buyer.phone),
      buyer_name: `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim(),
      party_size: riders.length,
      referrer_contact_id: referrerContactId,
      client_token: client_token || null,
    })
    .select('id')
    .single()
  if (orderErr) {
    // 23505 = unique violation on (event_id, client_token). Race between two
    // simultaneous POSTs; the loser replays the winner's checkout URL.
    if (orderErr.code === '23505' && client_token) {
      const { data: winner } = await supabase
        .from('orders')
        .select('id, stripe_checkout_url')
        .eq('event_id', event.id)
        .eq('client_token', client_token)
        .maybeSingle()
      if (winner?.stripe_checkout_url) {
        return Response.json({
          checkout_url: winner.stripe_checkout_url,
          order_id: winner.id,
          replayed: true,
        })
      }
      return Response.json({ error: 'in_flight_retry' }, { status: 409 })
    }
    console.error('[checkout] order insert failed', orderErr)
    return Response.json({ error: 'order_insert_failed' }, { status: 500 })
  }

  const orderItemRows = riderContacts.map(rc => {
    const tt = ttById.get(rc.rider.ticket_type_id)
    if (rc.claim) {
      // Claim-link item: friend hasn't filled their info yet. Mint an
      // unguessable token they'll use at /c/<token>.
      return {
        order_id: order.id,
        ticket_type_id: tt.id,
        contact_id: null,
        rider_first_name: '',
        rider_last_name: '',
        rider_email: null,
        rider_phone: null,
        unit_price_cents: tt.price_cents,
        stop_index: tt.stop_index,
        pickup_stop_index: pickupIndexFor(rc.rider),
        claim_token: mintClaimToken(),
      }
    }
    return {
      order_id: order.id,
      ticket_type_id: tt.id,
      contact_id: rc.contact.id,
      rider_first_name: rc.rider.first_name || '',
      rider_last_name: rc.rider.last_name || '',
      rider_email: normalizeEmail(rc.rider.email),
      rider_phone: normalizePhone(rc.rider.phone),
      unit_price_cents: priceForRc(rc),
      stop_index: tt.stop_index,
      pickup_stop_index: pickupIndexFor(rc.rider),
    }
  })
  const { error: itemsErr } = await supabase.from('order_items').insert(orderItemRows)
  if (itemsErr) {
    console.error('[checkout] order_items insert failed', itemsErr)
    return Response.json({ error: 'order_items_insert_failed' }, { status: 500 })
  }

  if (addonRows.length) {
    const { error: addonErr } = await supabase
      .from('order_addons')
      .insert(addonRows.map(a => ({ order_id: order.id, ...a })))
    if (addonErr) {
      // Non-fatal: the ticket sale is what matters. Log + alert so an add-on
      // that didn't persist can be reconciled, but don't block the booking.
      console.error('[checkout] order_addons insert failed', addonErr)
    }
  }

  // Belt-and-suspenders capacity recheck. The pre-insert check is racy across
  // simultaneous buyers (two reads see the same "remaining"). If the race lost
  // and we just oversold a stop, undo this order before handing off to Stripe
  // so the buyer sees sold_out instead of paying for a seat we can't honor.
  // Same stop_index-based counting as the pre-insert check so TT-mirrored
  // items are included.
  for (const [key, requested] of requestedByStop.entries()) {
    const tt = stopMeta.get(key)
    if (tt.capacity == null) continue
    const taken = await countTakenForStop(tt)
    if (taken > tt.capacity) {
      // Undo: cascade-deletes order_items, frees the slot back up.
      await supabase.from('orders').delete().eq('id', order.id)
      return Response.json({
        error: 'sold_out',
        ticket_type_id: tt.id,
        ticket_type_name: tt.name,
        remaining: 0,
        requested,
      }, { status: 409 })
    }
  }

  // Only non-covered seats are charged. Loop Pass seats are omitted entirely
  // (a $0 Stripe line item is rejected in payment mode).
  const sessionLineItems = []
  const byType = new Map()
  for (const rc of riderContacts) {
    if (rc.covered) continue
    const id = rc.rider.ticket_type_id
    byType.set(id, (byType.get(id) || 0) + 1)
  }
  for (const [ttId, qty] of byType.entries()) {
    const tt = ttById.get(ttId)
    sessionLineItems.push({ name: tt.name, unit_price_cents: tt.price_cents, quantity: qty })
  }
  // Add-ons are charged on top of (non-covered) seats — a Loop Pass covers the
  // ride, not the extras.
  for (const a of addonLineItems) sessionLineItems.push(a)

  // Fully covered by Loop Pass(es): nothing to charge. A $0 Stripe Checkout
  // session can't be created, and no webhook would fire to settle it — so mark
  // the order paid here and run the same post-payment steps the Stripe webhook
  // would: waiver signatures, group membership, ticket QRs + confirmations, and
  // the TT inventory push.
  if (sessionLineItems.length === 0) {
    const update = { status: 'paid', paid_at: new Date().toISOString() }
    if (resolvedAttribution?.qr_code || resolvedAttribution?.utm_source || resolvedAttribution?.utm_medium || resolvedAttribution?.utm_campaign) {
      update.metadata = {
        qr_code: resolvedAttribution.qr_code || null,
        utm_source: resolvedAttribution.utm_source || null,
        utm_medium: resolvedAttribution.utm_medium || null,
        utm_campaign: resolvedAttribution.utm_campaign || null,
      }
    }
    await supabase.from('orders').update(update).eq('id', order.id)

    const signedContactIds = new Set()
    for (const s of waiverQueue) {
      try {
        await recordSignature(supabase, {
          contactId: s.contactId,
          fullNameTyped: s.typedName,
          signedForContactId: s.signedForContactId || null,
          orderId: order.id,
        })
        signedContactIds.add(s.contactId)
      } catch (err) {
        console.error('[checkout] free-order waiver signature failed', err)
      }
    }
    if (signedContactIds.size) {
      await supabase
        .from('waiver_signatures')
        .update({ order_id: order.id })
        .is('order_id', null)
        .in('contact_id', [...signedContactIds])
    }

    if (event.group_id) {
      const memberRows = riderContacts
        .filter(rc => rc.contact?.id)
        .map(rc => {
          const tt = ttById.get(rc.rider.ticket_type_id)
          const eff = tt?.stop_index != null ? tt.stop_index : pickupIndexFor(rc.rider)
          return {
            group_id: event.group_id,
            contact_id: rc.contact.id,
            ...(eff != null ? { current_stop_index: eff } : {}),
          }
        })
      if (memberRows.length) {
        await supabase
          .from('group_members')
          .upsert(memberRows, { onConflict: 'group_id,contact_id', ignoreDuplicates: true })
      }
    }

    try {
      await finalizeBooking(supabase, order.id)
    } catch (err) {
      console.error('[checkout] free-order finalizeBooking failed', err)
    }
    try {
      await syncTtForEvent(supabase, event.id)
    } catch (err) {
      console.error('[checkout] free-order tt sync threw', err)
    }

    return Response.json({ checkout_url: `/book/success?order_id=${order.id}`, order_id: order.id, free: true })
  }

  let session
  try {
    session = await createBookingCheckoutSession({
      event,
      items: sessionLineItems,
      buyer: {
        email: normalizeEmail(buyer.email),
        name: `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim(),
        phone: normalizePhone(buyer.phone),
      },
      orderId: order.id,
      waiverPayload: JSON.stringify({ sigs: waiverQueue }),
      attribution: resolvedAttribution,
      origin: req.headers.get('origin') || req.headers.get('referer'),
    })
  } catch (err) {
    return Response.json({ error: `stripe: ${err.message}` }, { status: 500 })
  }

  await supabase
    .from('orders')
    .update({
      stripe_checkout_session_id: session.id,
      stripe_checkout_url: session.url,
    })
    .eq('id', order.id)

  // Decrement TT's quantity_total now that the seat is pending in our DB —
  // closes the race where a Loop cart sits at Stripe Checkout while TT sells
  // the same seat. syncTtForEvent counts paid + fresh pending. Best-effort:
  // never block the customer's checkout flow on a TT call.
  try {
    await syncTtForEvent(supabase, event.id)
  } catch (err) {
    console.error('[checkout] tt sync threw', err)
  }

  return Response.json({ checkout_url: session.url, order_id: order.id })
}
