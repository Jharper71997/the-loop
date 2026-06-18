import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotCron } from '@/lib/cronAuth'
import { sendTicketReminder } from '@/lib/sms'
import { sendEmail } from '@/lib/email'
import { ticketReminderHtml, ticketReminderText } from '@/lib/emailTemplates'
import { appUrl } from '@/lib/stripe'
import { recordAlert } from '@/lib/alerts'
import { normalizePhone } from '@/lib/phone'
import { normalizeEmail } from '@/lib/contacts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Fires every 10 min via vercel.json. Finds order_items whose stop pickup
// time is roughly 60 min from now (window: 55-70 min) and sends each rider
// an SMS + email reminder with their QR. reminder_sent_at stamps the
// send so we don't double-fire across cron ticks.
//
// Window math: cron ticks every 10 min, so a [55, 70] minute window catches
// every item exactly once even with clock skew or the cron firing late.
//
// Auth: CRON_SECRET (lib/cronAuth) — same pattern as cleanup-pending.

const REMINDER_LEAD_MIN = 60
const WINDOW_LOWER_MIN = 55
const WINDOW_UPPER_MIN = 70

// Eastern time. Pickup_time is stored as HH:MM in event-local time. Hardcoding
// EDT (-04:00) — valid March-November. Fall/winter we'd need to flip to -05:00
// but Brew Loop runs are summer/fall.
const EVENT_TZ_OFFSET = '-04:00'

export async function GET(req) {
  const denied = denyIfNotCron(req)
  if (denied) return denied

  const sb = supabaseAdmin()
  const now = Date.now()
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  // Pull events for today + tomorrow that could plausibly have a stop in
  // the reminder window. paid + non-voided items only.
  const { data: events, error: evErr } = await sb
    .from('events')
    .select('id, name, event_date, group_id')
    .in('event_date', [today, tomorrow])
    .eq('status', 'on_sale')
    .eq('kind', 'brew')   // Brew Loop reminder copy/templates — Marines is out of scope here
  if (evErr) return Response.json({ error: evErr.message }, { status: 500 })
  if (!events?.length) return Response.json({ ok: true, processed: 0, reason: 'no_events' })

  const groupIds = [...new Set(events.map(e => e.group_id).filter(Boolean))]
  const { data: groups } = await sb
    .from('groups')
    .select('id, schedule')
    .in('id', groupIds)
  const scheduleByGroup = new Map((groups || []).map(g => [g.id, Array.isArray(g.schedule) ? g.schedule : []]))

  const eventIds = events.map(e => e.id)
  const { data: orders } = await sb
    .from('orders')
    .select('id, event_id, buyer_phone, buyer_email, buyer_name')
    .in('event_id', eventIds)
    .eq('status', 'paid')
  const ordersById = new Map((orders || []).map(o => [o.id, o]))

  if (!orders?.length) return Response.json({ ok: true, processed: 0, reason: 'no_paid_orders' })

  const orderIds = orders.map(o => o.id)
  const { data: items, error: itemsErr } = await sb
    .from('order_items')
    .select('id, order_id, stop_index, contact_id, rider_first_name, rider_phone, rider_email, claim_token, claimed_at, voided_at, reminder_sent_at')
    .in('order_id', orderIds)
    .is('voided_at', null)
    .is('reminder_sent_at', null)
  if (itemsErr) return Response.json({ error: itemsErr.message }, { status: 500 })
  if (!items?.length) return Response.json({ ok: true, processed: 0, reason: 'no_pending_items' })

  // Need QR codes to build ticket URLs.
  const itemIds = items.map(i => i.id)
  const { data: qrs } = await sb
    .from('qr_codes')
    .select('code, order_item_id')
    .eq('kind', 'checkin')
    .in('order_item_id', itemIds)
  const codeByItem = new Map((qrs || []).map(q => [q.order_item_id, q.code]))

  const eventById = new Map(events.map(e => [e.id, e]))

  const contactIds = [...new Set(items.map(i => i.contact_id).filter(Boolean))]
  const { data: contacts } = await sb
    .from('contacts')
    .select('id, first_name, phone, email, sms_consent')
    .in('id', contactIds)
  const contactById = new Map((contacts || []).map(c => [c.id, c]))

  const results = []
  for (const item of items) {
    if (item.claim_token && !item.claimed_at) {
      results.push({ item: item.id, skipped: 'unclaimed' })
      continue
    }

    const order = ordersById.get(item.order_id)
    const event = order ? eventById.get(order.event_id) : null
    if (!event) { results.push({ item: item.id, skipped: 'no_event' }); continue }

    const schedule = scheduleByGroup.get(event.group_id) || []
    const stop = Number.isFinite(item.stop_index) ? schedule[item.stop_index] : null
    if (!stop?.start_time) { results.push({ item: item.id, skipped: 'no_stop_time' }); continue }

    const pickupAt = parsePickupAt(event.event_date, stop.start_time)
    if (!Number.isFinite(pickupAt)) { results.push({ item: item.id, skipped: 'bad_time' }); continue }

    const minsAway = (pickupAt - now) / 60_000
    if (minsAway < WINDOW_LOWER_MIN || minsAway > WINDOW_UPPER_MIN) {
      results.push({ item: item.id, skipped: `outside_window (${Math.round(minsAway)}m)` })
      continue
    }

    const code = codeByItem.get(item.id)
    if (!code) { results.push({ item: item.id, skipped: 'no_qr_code' }); continue }
    const ticketUrl = `${appUrl()}/tickets/${code}`

    const contact = item.contact_id ? contactById.get(item.contact_id) : null
    const firstName = contact?.first_name || item.rider_first_name || (order?.buyer_name?.split(' ')?.[0] || '')

    const phone = normalizePhone(contact?.phone || item.rider_phone || order?.buyer_phone)
    const email = normalizeEmail(contact?.email || item.rider_email || order?.buyer_email)

    let smsSent = false
    let emailSent = false

    // ---- SMS ----
    if (phone && (contact?.sms_consent !== false)) {
      try {
        await sendTicketReminder(phone, {
          rider: { firstName, ticketUrl },
          stopName: stop.name,
          stopTime: stop.start_time,
        })
        smsSent = true
      } catch (err) {
        console.error('[ticket-reminder] sms failed', err)
        await recordAlert(sb, {
          kind: 'sms_failed',
          subject: `Reminder SMS failed for item ${item.id.slice(0, 8)}`,
          body: err?.message || String(err),
          context: { item_id: item.id, channel: 'sms', recipient: 'rider', flow: 'reminder' },
        })
      }
    }

    // ---- Email ----
    if (email) {
      try {
        await sendEmail({
          to: email,
          subject: `Brew Loop pickup in 1 hour — ${stop.name || formatDate(event.event_date)}`,
          html: ticketReminderHtml({
            rider: { firstName },
            event,
            ticketUrl,
            stopName: stop.name,
            stopTime: stop.start_time,
          }),
          text: ticketReminderText({
            rider: { firstName },
            event,
            ticketUrl,
            stopName: stop.name,
            stopTime: stop.start_time,
          }),
        })
        emailSent = true
      } catch (err) {
        console.error('[ticket-reminder] email failed', err)
        await recordAlert(sb, {
          kind: 'email_failed',
          subject: `Reminder email failed for item ${item.id.slice(0, 8)}`,
          body: err?.message || String(err),
          context: { item_id: item.id, channel: 'email', recipient: 'rider', flow: 'reminder' },
        })
      }
    }

    // Stamp regardless of partial failure so we don't loop forever on a
    // permanently-broken send. The alert above surfaces the failure.
    await sb
      .from('order_items')
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq('id', item.id)

    results.push({ item: item.id, sms: smsSent, email: emailSent, mins_away: Math.round(minsAway) })
  }

  return Response.json({
    ok: true,
    processed: results.length,
    sent: results.filter(r => r.sms || r.email).length,
    results,
  })
}

function parsePickupAt(dateIso, hhmm) {
  if (!dateIso || !hhmm) return NaN
  const t = `${dateIso}T${hhmm.length === 5 ? hhmm + ':00' : hhmm}${EVENT_TZ_OFFSET}`
  const ms = Date.parse(t)
  return Number.isFinite(ms) ? ms : NaN
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-04:00`)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch { return iso }
}
