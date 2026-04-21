import Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { recordSignature, textUnsignedContact } from '@/lib/waiver'
import { sendBookingConfirmation } from '@/lib/sms'
import { appUrl } from '@/lib/stripe'
import { randomCode } from '@/lib/qrcodeAi'

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

    if (order.buyer_phone) {
      const { data: buyerContact } = await supabase
        .from('contacts')
        .select('id, has_signed_waiver, waiver_version')
        .eq('id', order.contact_id)
        .maybeSingle()

      const waiverLink = buyerContact && !buyerContact.has_signed_waiver
        ? `${appUrl()}/waiver/${buyerContact.id}`
        : null

      try {
        await sendBookingConfirmation(order.buyer_phone, {
          buyer: { name: session.customer_details?.name || '' },
          event: event,
          waiverLink,
        })
      } catch (err) {
        console.error('[stripe-webhook] SMS failed', err)
      }
    }

    // Mint a per-ticket check-in QR code for every order_item. We only
    // insert the DB row (no PNG API call yet) so each purchase is free —
    // qrcode.ai PNG rendering happens on demand when an admin opens the
    // item on /qr. The /r/<code> redirect already works without a PNG.
    try {
      const { data: freshItems } = await supabase
        .from('order_items')
        .select('id, rider_first_name, rider_last_name')
        .eq('order_id', order.id)

      const qrRows = (freshItems || []).map(it => ({
        code: randomCode(8),
        kind: 'checkin',
        label: `Check-in · ${[it.rider_first_name, it.rider_last_name].filter(Boolean).join(' ') || order.id.slice(0, 6)}`,
        target_url: `${appUrl()}/track?checkin=ok`,
        order_item_id: it.id,
      }))

      if (qrRows.length) {
        const { error: qrErr } = await supabase.from('qr_codes').insert(qrRows)
        if (qrErr) console.error('[stripe-webhook] checkin QR insert failed', qrErr)
      }
    } catch (err) {
      console.error('[stripe-webhook] checkin QR mint failed', err)
    }

    // Waiver reminders for additional riders on the order (party_size > 1).
    // Buyer already got one in sendBookingConfirmation above; this handles
    // everyone else who was added as a contact but hasn't signed.
    try {
      const { data: items } = await supabase
        .from('order_items')
        .select('contact_id')
        .eq('order_id', order.id)

      const riderContactIds = [...new Set((items || [])
        .map(it => it.contact_id)
        .filter(cid => cid && cid !== order.contact_id))]

      if (riderContactIds.length) {
        const { data: riders } = await supabase
          .from('contacts')
          .select('id, first_name, phone, has_signed_waiver, waiver_sms_sent_at, waiver_sms_count')
          .in('id', riderContactIds)
        for (const rider of riders || []) {
          try { await textUnsignedContact(supabase, rider) }
          catch (err) { console.error('[stripe-webhook] rider waiver SMS failed', err) }
        }
      }
    } catch (err) {
      console.error('[stripe-webhook] rider waiver sweep failed', err)
    }
  }
}

async function handleRefund(supabase, obj) {
  const paymentIntent = obj.payment_intent
  if (!paymentIntent) return
  const { data: order } = await supabase
    .from('orders')
    .select('id, event_id, status')
    .eq('stripe_payment_intent_id', paymentIntent)
    .maybeSingle()
  if (!order) return

  await supabase
    .from('orders')
    .update({ status: 'refunded', refunded_at: new Date().toISOString() })
    .eq('id', order.id)

  if (order.event_id) {
    const { data: event } = await supabase
      .from('events')
      .select('group_id')
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
  }
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
