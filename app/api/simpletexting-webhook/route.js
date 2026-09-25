import { timingSafeEqual } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import {
  upsertProviderMessage,
  applyDeliveryReport,
  applyOptOut,
} from '@/lib/smsStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/simpletexting-webhook?token=<SIMPLETEXTING_WEBHOOK_SECRET>
//
// Receiver for SimpleTexting API v2 webhooks. Registered (once, after deploy)
// by scripts/register-simpletexting-webhook.js. Payload shape, per
// https://api-doc.simpletexting.com ("Webhook Reports"):
//
//   { reportId, webhookId, type, values }
//
//   type INCOMING_MESSAGE | OUTGOING_MESSAGE
//     values: { messageId, subject, mediaItems, text, accountPhone,
//               contactPhone, timestamp, category, referenceType }
//   type DELIVERY_REPORT | NON_DELIVERED_REPORT
//     values: { messageId, category, referenceType, accountPhone,
//               contactPhone, carrier }
//   type UNSUBSCRIBE_REPORT
//     values: { contactId, phone }
//
// Phones arrive as 10-digit US numbers and are stored as E.164.
//
// AUTH: SimpleTexting does not sign webhook requests and has no secret header
// setting, so the registered URL carries a long random ?token= which must match
// SIMPLETEXTING_WEBHOOK_SECRET. An x-webhook-secret header is accepted too, for
// manual testing. Unlike the older Ticket Tailor receiver this fails CLOSED: no
// secret configured means every request is rejected.
//
// This route never sends a text. It only records what SimpleTexting tells it.

function denyIfBadSecret(req) {
  const expected = process.env.SIMPLETEXTING_WEBHOOK_SECRET
  if (!expected) {
    console.error('[simpletexting-webhook] SIMPLETEXTING_WEBHOOK_SECRET not set, rejecting')
    return Response.json({ error: 'webhook_secret_unset' }, { status: 401 })
  }
  const url = new URL(req.url)
  const provided = url.searchParams.get('token') || req.headers.get('x-webhook-secret') || ''
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }
  return null
}

export async function POST(req) {
  const denied = denyIfBadSecret(req)
  if (denied) return denied

  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  // One report per request per the docs; accept an array defensively.
  const reports = Array.isArray(body) ? body : [body]
  const sb = supabaseAdmin()
  const results = []

  try {
    for (const report of reports) {
      results.push(await handleReport(sb, report))
    }
  } catch (err) {
    // 500 so SimpleTexting can retry. Every handler is idempotent on the
    // provider message id, so a retry cannot double-insert.
    console.error('[simpletexting-webhook] failed:', err?.message || err)
    return Response.json({ error: 'processing_failed' }, { status: 500 })
  }

  return Response.json({ ok: true, results })
}

async function handleReport(sb, report) {
  const type = String(report?.type || '').toUpperCase()
  const values = report?.values || {}

  switch (type) {
    case 'INCOMING_MESSAGE':
      return { type, ...(await upsertProviderMessage(sb, values, { direction: 'in', source: 'webhook' })) }

    // Fires for every outbound, including texts typed in SimpleTexting's own
    // inbox (referenceType INB), which the app would otherwise never see.
    case 'OUTGOING_MESSAGE':
      return { type, ...(await upsertProviderMessage(sb, values, { direction: 'out', source: 'webhook' })) }

    case 'DELIVERY_REPORT':
      return { type, ...(await applyDeliveryReport(sb, true, values)) }

    case 'NON_DELIVERED_REPORT':
      return { type, ...(await applyDeliveryReport(sb, false, values)) }

    // STOP texted in, or someone blocked the number in the SimpleTexting UI.
    case 'UNSUBSCRIBE_REPORT': {
      const r = await applyOptOut(sb, values.phone || values.contactPhone, {
        source: 'webhook',
        providerContactId: values.contactId,
      })
      return { type, newlyOptedOut: r.newlyOptedOut, contactsUpdated: r.contactsUpdated, skipped: r.skipped }
    }

    default:
      // OPENING_A_CONVERSATION etc. are not registered; ignore anything else.
      return { type: type || 'unknown', ignored: true }
  }
}
