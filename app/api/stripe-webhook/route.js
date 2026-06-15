import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { recordSignature } from '@/lib/waiver'
import { finalizeBooking } from '@/lib/booking'
import { sendSms } from '@/lib/sms'
import { recordAlert } from '@/lib/alerts'
import { syncTtForEvent } from '@/lib/ticketTailorSync'
import { stripe as stripeLib } from '@/lib/stripe'
import { mapSubStatus } from '@/lib/loopPass'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = supabaseAdmin()
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    // Loud — signature mismatch is the silent killer of post-payment delivery.
    await recordAlert(supabase, {
      kind: 'webhook_error',
      severity: 'error',
      subject: 'Stripe webhook signature verification failed',
      body: err?.message || String(err),
      context: { source: 'stripe', has_secret: !!process.env.STRIPE_WEBHOOK_SECRET },
    })
    return Response.json({ error: err.message }, { status: 400 })
  }

  const { data: logRow } = await supabase
    .from('webhook_events')
    .insert({
      source: 'stripe',
      event_type: event.type,
      external_id: event.id,
      payload: event,
      status: 'received',
    })
    .select('id')
    .single()
  const logId = logRow?.id

  async function markProcessed(status, error) {
    if (!logId) return
    await supabase
      .from('webhook_events')
      .update({
        status,
        error: error ? String(error).slice(0, 2000) : null,
        processed_at: new Date().toISOString(),
      })
      .eq('id', logId)
  }

  // Idempotency: if a prior delivery of this exact event already processed
  // successfully, skip the side effects. Stripe retries on 5xx and sometimes
  // on connection blips — without this guard we'd double-mint QRs and
  // double-send confirmations.
  if (logId) {
    const { count: priorOk } = await supabase
      .from('webhook_events')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'stripe')
      .eq('external_id', event.id)
      .eq('status', 'ok')
      .neq('id', logId)
    if (priorOk && priorOk > 0) {
      await markProcessed('ignored_duplicate')
      return Response.json({ received: true, deduped: true })
    }
  }

  try {
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(supabase, event.data.object)
    } else if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      await handleSubscriptionChange(supabase, event.data.object)
    } else if (event.type === 'charge.refunded' || event.type === 'refund.created') {
      await handleRefund(supabase, event.data.object)
    } else {
      await markProcessed('ignored')
      return Response.json({ received: true })
    }
    await markProcessed('ok')
    return Response.json({ received: true })
  } catch (err) {
    console.error('[stripe-webhook] error', err)
    await markProcessed('error', err?.message || err)
    await recordAlert(supabase, {
      kind: 'finalize_failed',
      subject: `Stripe webhook handler threw on ${event?.type}`,
      body: err?.message || String(err),
      context: { event_id: event?.id, event_type: event?.type },
    })
    return Response.json({ received: true, warning: 'processing_error' })
  }
}

// Loop Pass subscriptions ride the same Checkout webhook but have no order row.
async function handlePassCheckout(supabase, session) {
  const subId = session.subscription
  if (!subId) return

  let sub = null
  try { sub = await stripeLib().subscriptions.retrieve(subId) } catch (err) {
    console.error('[stripe-webhook] subscription retrieve failed', err)
  }

  await upsertPass(supabase, {
    subId,
    contactId: session.metadata?.contact_id || sub?.metadata?.contact_id || null,
    plan: session.metadata?.plan || sub?.metadata?.plan || 'monthly',
    customerId: session.customer || sub?.customer || null,
    status: sub ? mapSubStatus(sub.status) : 'active',
    periodEnd: sub?.current_period_end || null,
  })
}

// customer.subscription.created/updated/deleted — keep the local pass mirror in
// sync (renewals, payment failures, cancellations). Upsert on the subscription
// id so an event arriving before checkout.session.completed still creates the row.
async function handleSubscriptionChange(supabase, sub) {
  if (sub?.metadata?.kind !== 'loop_pass') return
  await upsertPass(supabase, {
    subId: sub.id,
    contactId: sub.metadata?.contact_id || null,
    plan: sub.metadata?.plan || 'monthly',
    customerId: typeof sub.customer === 'string' ? sub.customer : null,
    status: mapSubStatus(sub.status),
    periodEnd: sub.current_period_end || null,
  })
}

async function upsertPass(supabase, { subId, contactId, plan, customerId, status, periodEnd }) {
  const row = {
    contact_id: contactId || null,
    plan: plan === 'season' ? 'season' : 'monthly',
    status,
    stripe_subscription_id: subId,
    stripe_customer_id: customerId || null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase
    .from('loop_passes')
    .upsert(row, { onConflict: 'stripe_subscription_id' })
  if (error) console.error('[stripe-webhook] loop_passes upsert failed', error)
}

// Best-effort friendly promo code for a completed session. Prefers the
// human-readable promotion code (e.g. "FREERIDE") over Stripe's internal ids;
// falls back to the coupon name/id. Never throws — attribution is non-critical.
async function resolvePromoCode(session) {
  try {
    const disc = Array.isArray(session.discounts) ? session.discounts[0] : null
    if (!disc) return null
    if (disc.promotion_code) {
      const id = typeof disc.promotion_code === 'string' ? disc.promotion_code : disc.promotion_code?.id
      if (id) {
        try {
          const pc = await stripeLib.promotionCodes.retrieve(id)
          return pc?.code || id
        } catch { return id }
      }
    }
    if (disc.coupon) {
      return typeof disc.coupon === 'string' ? disc.coupon : (disc.coupon?.name || disc.coupon?.id || null)
    }
    return null
  } catch { return null }
}

async function handleCheckoutCompleted(supabase, session) {
  // Loop Pass purchases come through Checkout too, but in subscription mode and
  // with no order_id — route them to the pass handler before the order lookup.
  if (session.mode === 'subscription' || session.metadata?.kind === 'loop_pass') {
    return handlePassCheckout(supabase, session)
  }

  const orderId = session.metadata?.order_id
  if (!orderId) {
    // Likely the legacy Stripe Checkout flow with metadata.group_id — preserve it.
    return handleLegacyGroupCheckout(supabase, session)
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, event_id, contact_id, status, buyer_phone, party_size, metadata')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) throw new Error(`order ${orderId} not found`)

  if (order.status === 'paid') return

  const qrCode = session.metadata?.qr_code || null
  const utmSource = session.metadata?.utm_source || null
  const utmMedium = session.metadata?.utm_medium || null
  const utmCampaign = session.metadata?.utm_campaign || null

  // Capture what was ACTUALLY collected vs the ticket's face value, plus any
  // promo code, so leadership can separate real paid sales from free/comped
  // rides — a 100%-off code completes checkout at $0 but the order still
  // carries its face value in total_cents.
  const collectedCents = Number.isInteger(session.amount_total) ? session.amount_total : null
  const discountCents = session.total_details?.amount_discount ?? 0
  const promoCode = await resolvePromoCode(session)

  const orderUpdate = {
    status: 'paid',
    stripe_payment_intent_id: session.payment_intent || null,
    paid_at: new Date().toISOString(),
  }
  const baseMeta = (order.metadata && typeof order.metadata === 'object') ? order.metadata : {}
  orderUpdate.metadata = {
    ...baseMeta,
    amount_collected_cents: collectedCents,
    discount_cents: discountCents,
    promo_code: promoCode,
    comp: collectedCents === 0,
  }
  if (qrCode || utmSource || utmMedium || utmCampaign) {
    orderUpdate.metadata.qr_code = qrCode
    orderUpdate.metadata.utm_source = utmSource
    orderUpdate.metadata.utm_medium = utmMedium
    orderUpdate.metadata.utm_campaign = utmCampaign
  }

  await supabase
    .from('orders')
    .update(orderUpdate)
    .eq('id', order.id)

  // Link the most recent scan from this QR code to this order so attribution
  // rollups can count "scans that converted". We pick the latest unattributed
  // scan of this code, which is a reasonable heuristic for "the scan that
  // started this buyer's journey".
  if (qrCode) {
    const { data: qrRow } = await supabase
      .from('qr_codes')
      .select('id')
      .eq('code', qrCode)
      .maybeSingle()
    if (qrRow) {
      const { data: recentScan } = await supabase
        .from('qr_scans')
        .select('id')
        .eq('qr_id', qrRow.id)
        .is('resulting_order_id', null)
        .order('scanned_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (recentScan) {
        await supabase
          .from('qr_scans')
          .update({ resulting_order_id: order.id })
          .eq('id', recentScan.id)
      }
    }
  }

  const sigPayload = parseSigPayload(session.metadata?.waiver_payload)
  const sigsByContact = new Map()
  for (const s of sigPayload.sigs || []) {
    try {
      await recordSignature(supabase, {
        contactId: s.contactId,
        fullNameTyped: s.typedName,
        signedForContactId: s.signedForContactId || null,
        orderId: order.id,
      })
      sigsByContact.set(s.contactId, true)
    } catch (err) {
      console.error('[stripe-webhook] waiver signature failed', err)
    }
  }

  await supabase
    .from('waiver_signatures')
    .update({ order_id: order.id })
    .eq('order_id', null)
    .in('contact_id', [...sigsByContact.keys()])

  if (order.event_id) {
    const { data: event } = await supabase
      .from('events')
      .select('id, name, event_date, pickup_time, group_id')
      .eq('id', order.event_id)
      .maybeSingle()

    if (event?.group_id) {
      const { data: items } = await supabase
        .from('order_items')
        .select('contact_id, stop_index')
        .eq('order_id', order.id)

      const memberRows = (items || [])
        .filter(it => it.contact_id)
        .map(it => ({
          group_id: event.group_id,
          contact_id: it.contact_id,
          ...(it.stop_index != null ? { current_stop_index: it.stop_index } : {}),
        }))

      if (memberRows.length) {
        await supabase
          .from('group_members')
          .upsert(memberRows, { onConflict: 'group_id,contact_id', ignoreDuplicates: true })
      }
    }

    // Mint per-ticket check-in QRs + send the buyer a confirmation SMS with
    // /tickets/<code> links. Single codepath shared with the TT webhook so
    // both channels deliver the same in-app experience.
    try {
      await finalizeBooking(supabase, order.id)
    } catch (err) {
      console.error('[stripe-webhook] finalizeBooking failed', err)
      await recordAlert(supabase, {
        kind: 'finalize_failed',
        subject: `finalizeBooking threw for order ${order.id.slice(0, 8)}`,
        body: err?.message || String(err),
        context: { order_id: order.id, event_id: order.event_id },
      })
    }

    // Push remaining seats back to Ticket Tailor so TT's own checkout reflects
    // the shared 13-per-stop ceiling. Native-only hook (TT webhook handles its
    // own ingestion path). Best-effort — never let a TT failure block a paid
    // Loop sale from settling.
    if (order.event_id) {
      try {
        await syncTtForEvent(supabase, order.event_id)
      } catch (err) {
        console.error('[stripe-webhook] tt sync threw', err)
      }
    }
  }
}

async function handleRefund(supabase, obj) {
  const paymentIntent = obj.payment_intent
  if (!paymentIntent) return
  const { data: order } = await supabase
    .from('orders')
    .select('id, event_id, status, buyer_phone, buyer_name, total_cents')
    .eq('stripe_payment_intent_id', paymentIntent)
    .maybeSingle()
  if (!order) return
  // Idempotent: charge.refunded + refund.created can both fire for the same
  // refund; only the first should run side effects.
  if (order.status === 'refunded') return

  await supabase
    .from('orders')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('id', order.id)

  if (order.event_id) {
    const { data: event } = await supabase
      .from('events')
      .select('group_id, name, event_date')
      .eq('id', order.event_id)
      .maybeSingle()
    if (event?.group_id) {
      const { data: items } = await supabase
        .from('order_items')
        .select('contact_id')
        .eq('order_id', order.id)
      const contactIds = (items || []).map(i => i.contact_id).filter(Boolean)
      if (contactIds.length) {
        await supabase
          .from('group_members')
          .delete()
          .eq('group_id', event.group_id)
          .in('contact_id', contactIds)
      }
    }

    // Refund-confirmation SMS removed 2026-05-02 — all automatic texts off
    // per product decision. Stripe still emails the buyer the refund receipt.

    // Refunded seats are no longer status='paid', so the capacity count drops
    // — push the freed inventory back to TT.
    try {
      await syncTtForEvent(supabase, order.event_id)
    } catch (err) {
      console.error('[stripe-webhook refund] tt sync threw', err)
    }
  }
}

function formatRefundDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return iso }
}

async function handleLegacyGroupCheckout(supabase, session) {
  const { customer_details, metadata } = session
  const groupId = metadata?.group_id
  if (!groupId) return

  const name = customer_details?.name?.split(' ') || ['', '']
  const first_name = name[0]
  const last_name = name.slice(1).join(' ')

  const { data: contact } = await supabase
    .from('contacts')
    .insert([{
      first_name,
      last_name,
      email: customer_details?.email,
      phone: customer_details?.phone,
    }])
    .select()
    .single()

  if (contact) {
    await supabase.from('group_members').insert([{ group_id: groupId, contact_id: contact.id }])
  }
}

function parseSigPayload(raw) {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}
