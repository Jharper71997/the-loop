import { sendSms } from '@/lib/sms'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { denyIfNotLeadership, currentUserEmail } from '@/lib/routeAuth'
import { toE164, isOptedOut, applyOptOut } from '@/lib/smsStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/admin/sms/reply  { phone, body }
//
// A staff member answering one thread in /admin/messages. One recipient, one
// message, typed by a person: this is not a broadcast and nothing here runs
// on a timer. Blocked outright when the number has texted STOP.
//
// Leadership only (the /api/admin prefix is leadership-gated in middleware as
// well, this is the second lock).

const MAX_LEN = 640

export async function POST(req) {
  const denied = await denyIfNotLeadership()
  if (denied) return denied

  let payload
  try {
    payload = await req.json()
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const phone = toE164(payload?.phone)
  const body = String(payload?.body || '').trim()
  if (!phone) return Response.json({ error: 'bad_phone' }, { status: 400 })
  if (!body) return Response.json({ error: 'empty' }, { status: 400 })
  if (body.length > MAX_LEN) {
    return Response.json({ error: 'too_long', detail: `Keep it under ${MAX_LEN} characters.` }, { status: 400 })
  }

  const sb = supabaseAdmin()
  if (await isOptedOut(sb, phone)) {
    return Response.json({
      error: 'opted_out',
      detail: 'This number texted STOP. You cannot text them until they text START.',
    }, { status: 409 })
  }

  const sentBy = await currentUserEmail()
  try {
    const result = await sendSms(phone, body, { sentBy })
    if (result?.skipped) {
      // SimpleTexting knows something we did not (STOP we never heard about,
      // or a dead number). Record the opt-out so the box locks next time.
      const optedOut = result.reason && result.reason !== 'INVALID_CONTACT'
      if (optedOut) {
        try { await applyOptOut(sb, phone, { source: 'reply_blocked' }) } catch {}
      }
      return Response.json({
        ok: false,
        error: optedOut ? 'opted_out' : 'unreachable',
        detail: optedOut
          ? 'SimpleTexting says this number is unsubscribed. Not sent.'
          : 'The carrier has marked this number undeliverable. Not sent.',
      }, { status: 409 })
    }
    return Response.json({ ok: true, id: result?.id || null })
  } catch (err) {
    console.error('[admin/sms/reply] failed:', err?.message || err)
    return Response.json({ ok: false, error: 'send_failed', detail: 'SimpleTexting rejected the send. Try again in a minute.' }, { status: 502 })
  }
}
