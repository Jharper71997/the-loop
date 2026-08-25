import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotCron } from '@/lib/cronAuth'
import { sendRideFeedbackRequest } from '@/lib/sms'
import { sendEmail } from '@/lib/email'
import { rideFeedbackHtml, rideFeedbackText } from '@/lib/emailTemplates'
import { appUrl } from '@/lib/stripe'
import { recordAlert } from '@/lib/alerts'
import { normalizePhone } from '@/lib/phone'
import { normalizeEmail } from '@/lib/contacts'
import { todayInTZ } from '@/lib/schedule'
import { isAutomationEnabled, AUTOMATION_KEYS } from '@/lib/automationSettings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Morning-after feedback survey. Runs once daily (~10:30 AM Eastern) and texts
// + emails everyone who rode LAST NIGHT a link to /feedback/<token>.
//
// Why the morning and not at drop-off: riders are still out at 1 AM, and the
// reviews that come out of a 1 AM tap read like 1 AM. Late morning is when
// they're home, sober, and remembering it fondly — which is also when a Google
// review actually gets written rather than started and abandoned.
//
// Who gets it — per event, in this order:
//   1. If ANY ticket on that event was scanned, only scanned tickets get the
//      survey. No-shows didn't ride and shouldn't be asked how the ride was.
//   2. If NOTHING was scanned (driver never opened the scanner, which happens),
//      fall back to every paid non-voided ticket. Better to ask a no-show than
//      to silently survey nobody on a full Loop.
//
// Dedupe: one send per phone and per email per run. A buyer who booked four
// seats and left the rider fields blank has all four items falling back to the
// buyer's contact info — without this they'd get four identical texts. The
// extra items still get stamped so the next run doesn't retry them.
//
// feedback_sent_at stamps the send; feedback_token is the per-ticket URL key.
// Both are on order_items (sql/047_ride_feedback.sql).
//
// Auth: CRON_SECRET via constant-time Bearer compare (lib/cronAuth).
// Gated by the ride_feedback_cron toggle at /leadership/automations, which
// defaults OFF.

const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function genToken(len = 10) {
  const bytes = randomBytes(len)
  let out = ''
  for (let i = 0; i < len; i++) out += TOKEN_ALPHABET[bytes[i] % TOKEN_ALPHABET.length]
  return out
}

function yesterdayInTZ() {
  const today = todayInTZ()
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export async function GET(req) {
  const denied = denyIfNotCron(req)
  if (denied) return denied

  if (!(await isAutomationEnabled(AUTOMATION_KEYS.RIDE_FEEDBACK_CRON))) {
    return Response.json({ ok: true, skipped: 'disabled_in_leadership_ui' })
  }

  const sb = supabaseAdmin()
  const rideDate = yesterdayInTZ()

  const { data: events, error: evErr } = await sb
    .from('events')
    .select('id, name, event_date, kind, group_id')
    .eq('event_date', rideDate)
    .eq('kind', 'brew')
  if (evErr) return Response.json({ error: evErr.message }, { status: 500 })
  if (!events?.length) {
    return Response.json({ ok: true, ride_date: rideDate, processed: 0, reason: 'no_events' })
  }

  const eventById = new Map(events.map(e => [e.id, e]))
  const eventIds = events.map(e => e.id)

  const { data: orders, error: ordErr } = await sb
    .from('orders')
    .select('id, event_id, buyer_name, buyer_phone, buyer_email')
    .in('event_id', eventIds)
    .eq('status', 'paid')
  if (ordErr) return Response.json({ error: ordErr.message }, { status: 500 })
  if (!orders?.length) {
    return Response.json({ ok: true, ride_date: rideDate, processed: 0, reason: 'no_paid_orders' })
  }

  const ordersById = new Map(orders.map(o => [o.id, o]))
  const orderIds = orders.map(o => o.id)

  const { data: items, error: itemErr } = await sb
    .from('order_items')
    .select('id, order_id, contact_id, rider_first_name, rider_phone, rider_email, checked_in_at, voided_at, feedback_token, feedback_sent_at')
    .in('order_id', orderIds)
    .is('voided_at', null)
    .is('feedback_sent_at', null)
  if (itemErr) return Response.json({ error: itemErr.message }, { status: 500 })
  if (!items?.length) {
    return Response.json({ ok: true, ride_date: rideDate, processed: 0, reason: 'no_pending_items' })
  }

  // Scanned-only vs everyone, decided per event (see header).
  const anyScannedByEvent = new Map()
  for (const item of items) {
    const eventId = ordersById.get(item.order_id)?.event_id
    if (!eventId) continue
    if (item.checked_in_at) anyScannedByEvent.set(eventId, true)
  }

  const contactIds = [...new Set(items.map(i => i.contact_id).filter(Boolean))]
  const { data: contacts } = contactIds.length
    ? await sb.from('contacts').select('id, first_name, phone, email, sms_consent').in('id', contactIds)
    : { data: [] }
  const contactById = new Map((contacts || []).map(c => [c.id, c]))

  const sentPhones = new Set()
  const sentEmails = new Set()
  const results = []

  for (const item of items) {
    const order = ordersById.get(item.order_id)
    const event = order ? eventById.get(order.event_id) : null
    if (!event) { results.push({ item: item.id, skipped: 'no_event' }); continue }

    if (anyScannedByEvent.get(event.id) && !item.checked_in_at) {
      results.push({ item: item.id, skipped: 'no_show' })
      continue
    }

    const contact = item.contact_id ? contactById.get(item.contact_id) : null
    const firstName = contact?.first_name || item.rider_first_name || order?.buyer_name?.split(' ')?.[0] || ''
    const phone = normalizePhone(contact?.phone || item.rider_phone || order?.buyer_phone)
    const email = normalizeEmail(contact?.email || item.rider_email || order?.buyer_email)

    const phoneIsDupe = phone && sentPhones.has(phone)
    const emailIsDupe = email && sentEmails.has(email)
    if (!phone && !email) {
      // Nothing to send to. Stamp anyway so it stops showing up as pending.
      await stamp(sb, item.id)
      results.push({ item: item.id, skipped: 'no_contact' })
      continue
    }
    if (phoneIsDupe && emailIsDupe) {
      await stamp(sb, item.id)
      results.push({ item: item.id, skipped: 'duplicate_recipient' })
      continue
    }

    // Mint the token lazily — only tickets we're about to message need one.
    let token = item.feedback_token
    if (!token) {
      token = await mintToken(sb, item.id)
      if (!token) {
        results.push({ item: item.id, error: 'token_failed' })
        continue
      }
    }
    const feedbackUrl = `${appUrl()}/feedback/${token}`

    let smsSent = false
    let emailSent = false

    if (phone && !phoneIsDupe && contact?.sms_consent !== false) {
      try {
        await sendRideFeedbackRequest(phone, {
          rider: { firstName, feedbackUrl },
          kind: event.kind,
        })
        sentPhones.add(phone)
        smsSent = true
      } catch (err) {
        console.error('[ride-feedback] sms failed', err)
        await recordAlert(sb, {
          kind: 'sms_failed',
          subject: `Feedback SMS failed for item ${item.id.slice(0, 8)}`,
          body: err?.message || String(err),
          context: { item_id: item.id, channel: 'sms', recipient: 'rider', flow: 'ride_feedback' },
        })
      }
    }

    if (email && !emailIsDupe) {
      try {
        await sendEmail({
          to: email,
          subject: 'How was your Brew Loop?',
          html: rideFeedbackHtml({ rider: { firstName }, event, feedbackUrl }),
          text: rideFeedbackText({ rider: { firstName }, event, feedbackUrl }),
        })
        sentEmails.add(email)
        emailSent = true
      } catch (err) {
        console.error('[ride-feedback] email failed', err)
        await recordAlert(sb, {
          kind: 'email_failed',
          subject: `Feedback email failed for item ${item.id.slice(0, 8)}`,
          body: err?.message || String(err),
          context: { item_id: item.id, channel: 'email', recipient: 'rider', flow: 'ride_feedback' },
        })
      }
    }

    // Stamp regardless of partial failure — same reasoning as ticket-reminder:
    // a permanently-broken address shouldn't be retried every morning. The
    // alert above is what surfaces it.
    await stamp(sb, item.id)
    results.push({ item: item.id, sms: smsSent, email: emailSent })
  }

  return Response.json({
    ok: true,
    ride_date: rideDate,
    events: events.length,
    processed: results.length,
    sent: results.filter(r => r.sms || r.email).length,
    results,
  })
}

function stamp(sb, itemId) {
  return sb.from('order_items').update({ feedback_sent_at: new Date().toISOString() }).eq('id', itemId)
}

// Retry on the unique-index collision rather than trusting a single draw.
async function mintToken(sb, itemId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = genToken()
    const { error } = await sb
      .from('order_items')
      .update({ feedback_token: token })
      .eq('id', itemId)
      .is('feedback_token', null)
    if (!error) {
      const { data } = await sb.from('order_items').select('feedback_token').eq('id', itemId).maybeSingle()
      if (data?.feedback_token) return data.feedback_token
    }
  }
  return null
}
