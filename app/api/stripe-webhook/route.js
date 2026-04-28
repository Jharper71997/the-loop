import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { recordSignature } from '@/lib/waiver'
import { finalizeBooking } from '@/lib/booking'
import { sendSms } from '@/lib/sms'
import { recordAlert } from '@/lib/alerts'

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

async function handleCheckoutCompleted(supabase, session) {
  const orderId = session.metadata?.order_id
  if (!orderId) {
    // Likely the legacy Stripe Checkout flow with metadata.group_id — preserve it.
    return handleLegacyGroupCheckout(supabase, session)
  }

  const { data: order } = await supabase
    .from('orders')
    .select('id, event_id, contact_id, status, buyer_phone, party_size')
    .eq('id', orderId)
    .maybeSingle()
  if (!order) throw new Error(`order ${orderId} not found`)

  if (order.status === 'paid') return

  const qrCode = session.metadata?.qr_code || null
  const utmSource = session.metadata?.utm_source || null
  const utmMedium = session.metadata?.utm_medium || null
  const utmCampaign = session.metadata?.utm_campaign || null

  const orderUpdate = {
    status: 'paid',
    stripe_payment_intent_id: session.payment_intent || null,
    paid_at: new Date().toISOString(),
  }
  if (qrCode || utmSource || utmMedium || utmCampaign) {
    orderUpdate.metadata = {
      qr_code: qrCode,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
    }
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

    if (order.buyer_phone) {
      const dateLabel = formatRefundDate(event?.event_date)
      const dollars = (order.total_cents / 100).toFixed(2)
      const body = `Brew Loop: your booking${dateLabel ? ` for ${dateLabel}` : ''} has been refunded ($${dollars}). Hope to see you on a future Loop.`
      try {
        await sendSms(order.buyer_phone, body)
      } catch (err) {
        console.error('[stripe-webhook] refund SMS failed', err)
      }
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
