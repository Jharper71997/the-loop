import { sendSms } from '@/lib/sms'
import { denyIfNotAdmin, sessionEmail } from '@/lib/routeAuth'
import { isLeadership } from '@/lib/roles'
import { rateLimit } from '@/lib/rateLimit'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { normalizePhone } from '@/lib/phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// SimpleTexting splits on length (mode AUTO), so an unbounded body is an
// unbounded bill: 1,600 characters is ~11 segments in a single request. Three
// segments is plenty for "the shuttle is 5 minutes out".
const MAX_BODY_CHARS = 480

// Per-account ceilings. A broadcast is N separate single-recipient POSTs from
// the browser, so the server never sees "a broadcast" — these are what actually
// bound one. Sized to clear a full-contacts blast to a few hundred riders while
// still stopping a runaway loop.
const PER_MINUTE = 60
const PER_DAY = 600

async function logSms(sb, row) {
  try {
    await sb.from('sms_log').insert(row)
  } catch (err) {
    // Never fail a send because the audit insert failed.
    console.error('[send-sms] audit log failed:', err?.message || err)
  }
}

// Manual SMS route used by the broadcast composers (Loops/Groups, Contacts,
// per-rider Text button). Open to any provisioned admin-tier role (leadership,
// security, drivers) so the people actually running the night can text riders
// without first being added to the leadership allowlist.
//
// Hardened because "any admin-tier role" includes seasonal 1099 crew, and the
// route previously took an arbitrary destination and an arbitrary body with no
// cap and no audit trail — an open SMS relay billed to Brew Loop, reachable
// from any device left signed in. Now: the body is length-capped, non-
// leadership callers may only text a number already on file, every account has
// a burst and daily ceiling, and every attempt is written to sms_log.
export async function POST(req) {
  const denied = await denyIfNotAdmin()
  if (denied) return denied

  const actor = await sessionEmail()
  const sb = supabaseAdmin()

  let body
  try { body = await req.json() } catch {
    return Response.json({ success: false, error: 'bad_json' }, { status: 400 })
  }

  const message = typeof body?.message === 'string' ? body.message : ''
  const to = normalizePhone(body?.to)

  if (!to) {
    return Response.json({ success: false, error: 'bad_recipient' }, { status: 400 })
  }
  if (!message.trim()) {
    return Response.json({ success: false, error: 'empty_message' }, { status: 400 })
  }
  if (message.length > MAX_BODY_CHARS) {
    return Response.json({
      success: false,
      error: 'message_too_long',
      detail: `Keep it under ${MAX_BODY_CHARS} characters (this was ${message.length}).`,
    }, { status: 400 })
  }

  const withinBurst = await rateLimit('send_sms_min', actor || 'unknown', PER_MINUTE, 60)
  const withinDay = await rateLimit('send_sms_day', actor || 'unknown', PER_DAY, 86400)
  if (!withinBurst || !withinDay) {
    await logSms(sb, {
      actor_email: actor, to_phone: to, body_excerpt: message.slice(0, 160),
      body_length: message.length, outcome: 'failed', detail: 'rate_limited',
    })
    return Response.json({
      success: false,
      error: 'rate_limited',
      detail: 'Too many messages from this account. Give it a minute.',
    }, { status: 429 })
  }

  // Leadership can text a number that isn't on file yet (a new bar contact, a
  // charter lead). Everyone else may only reach someone already in the system,
  // which is what turns this from a relay back into a tool.
  if (!isLeadership(actor)) {
    const [{ data: contact }, { data: bartender }] = await Promise.all([
      sb.from('contacts').select('id').eq('phone', to).maybeSingle(),
      sb.from('bartenders').select('slug').eq('phone', to).maybeSingle(),
    ])
    if (!contact && !bartender) {
      await logSms(sb, {
        actor_email: actor, to_phone: to, body_excerpt: message.slice(0, 160),
        body_length: message.length, outcome: 'failed', detail: 'recipient_not_on_file',
      })
      return Response.json({
        success: false,
        error: 'recipient_not_on_file',
        detail: 'That number is not a rider or bartender on file. Ask Jacob or Richard to send it.',
      }, { status: 403 })
    }
  }

  try {
    const result = await sendSms(to, message)
    // Recipient-level dead end (number flagged undeliverable, or opted out).
    // Not an error — reported separately so one bad number reads as "1
    // unreachable" instead of a failed send with a raw API blob attached.
    if (result?.skipped) {
      const optedOut = result.reason !== 'INVALID_CONTACT'
      await logSms(sb, {
        actor_email: actor, to_phone: to, body_excerpt: message.slice(0, 160),
        body_length: message.length, outcome: 'skipped', detail: result.reason || null,
      })
      return Response.json({
        success: false,
        unreachable: true,
        error: 'unreachable',
        optedOut,
        detail: optedOut
          ? 'This number is unsubscribed from Brew Loop texts'
          : 'This number is marked undeliverable by the carrier',
      })
    }
    await logSms(sb, {
      actor_email: actor, to_phone: to, body_excerpt: message.slice(0, 160),
      body_length: message.length, outcome: 'sent', detail: null,
    })
    return Response.json({ success: true })
  } catch (error) {
    // Log the SimpleTexting failure body so Vercel runtime logs surface the
    // real reason on the next outage; the UI only sees `send_failed`.
    console.error('[send-sms] failed:', error?.message || error)
    await logSms(sb, {
      actor_email: actor, to_phone: to, body_excerpt: message.slice(0, 160),
      body_length: message.length, outcome: 'failed',
      detail: String(error?.message || error || '').slice(0, 300),
    })
    return Response.json({
      success: false,
      error: 'send_failed',
      detail: String(error?.message || error || '').slice(0, 300),
    }, { status: 500 })
  }
}
