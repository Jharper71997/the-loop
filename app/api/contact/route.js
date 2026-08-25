import { sendEmail } from '@/lib/email'
import { CONTACT } from '@/app/(external)/_components/site/nav'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/contact
//   { name, email, phone?, topic, message, company? }
//
// The one inbound form on the marketing site (replaces the Squarespace contact
// block). Emails CONTACT.email via Resend with reply-to set to the sender, so
// hitting reply in the inbox answers the person directly. `company` is a honeypot
// — real browsers leave it empty; bots fill it and we silently 200.

const TOPICS = {
  ride: 'Riding the Loop',
  group: 'Group / private charter',
  sponsor: 'Sponsorship or partner pack',
  bar: 'Becoming a partner bar',
  other: 'Something else',
}

const MAX = { name: 120, email: 200, phone: 40, message: 4000 }

export async function POST(req) {
  let body
  try { body = await req.json() } catch { return Response.json({ error: 'bad json' }, { status: 400 }) }

  // Honeypot: pretend it worked so bots don't retry.
  if (typeof body?.company === 'string' && body.company.trim()) {
    return Response.json({ ok: true })
  }

  const name = str(body?.name, MAX.name)
  const email = str(body?.email, MAX.email)
  const phone = str(body?.phone, MAX.phone)
  const message = str(body?.message, MAX.message)
  const topicKey = TOPICS[body?.topic] ? body.topic : 'other'

  if (!name) return Response.json({ error: 'Add your name so we know who to write back to.' }, { status: 400 })
  if (!isEmail(email)) return Response.json({ error: 'That email address doesn’t look right.' }, { status: 400 })
  if (message.length < 5) return Response.json({ error: 'Tell us a little more so we can actually help.' }, { status: 400 })

  const topic = TOPICS[topicKey]
  const rows = [
    ['Name', name],
    ['Email', email],
    ['Phone', phone || '—'],
    ['Topic', topic],
  ]

  try {
    await sendEmail({
      to: CONTACT.email,
      replyTo: email,
      subject: `Brew Loop site: ${topic} — ${name}`,
      text: `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${message}`,
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#111">
          <p style="margin:0 0 14px"><strong>New message from jvillebrewloop.com</strong></p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;font-size:14px">
            ${rows.map(([k, v]) => `<tr><td style="padding:2px 14px 2px 0;color:#666">${k}</td><td style="padding:2px 0"><strong>${esc(v)}</strong></td></tr>`).join('')}
          </table>
          <div style="white-space:pre-wrap;border-left:3px solid #d4a333;padding:2px 0 2px 14px">${esc(message)}</div>
        </div>
      `,
    })
  } catch (err) {
    console.error('[contact] send failed', err)
    return Response.json(
      { error: `We couldn’t send that. Email ${CONTACT.email} or call ${CONTACT.phoneDisplay} and we’ll pick it up.` },
      { status: 502 },
    )
  }

  return Response.json({ ok: true })
}

function str(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
}

function esc(v) {
  return String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
