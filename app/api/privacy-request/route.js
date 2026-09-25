import { sendEmail } from '@/lib/email'
import { LEGAL } from '@/lib/legal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/privacy-request
//   { name, email, phone?, type, details?, company? }
//
// Public data request form (/privacy/request). Emails the request to the
// published privacy contact with reply-to set to the requester, so the whole
// process (verify, act, confirm) runs from one email thread. It deliberately
// does NOT touch the database: deleting a rider is done by a person after
// verifying the request. See docs/privacy-requests.md for the runbook.
// `company` is a honeypot, same as /api/contact.

const TYPES = {
  delete: 'Delete my data',
  access: 'Send me a copy of my data',
  correct: 'Correct my data',
  sms_optout: 'Stop all texts',
  other: 'Other privacy question',
}

const MAX = { name: 120, email: 200, phone: 40, details: 4000 }

export async function POST(req) {
  let body
  try { body = await req.json() } catch { return Response.json({ error: 'bad json' }, { status: 400 }) }

  if (typeof body?.company === 'string' && body.company.trim()) {
    return Response.json({ ok: true })
  }

  const name = str(body?.name, MAX.name)
  const email = str(body?.email, MAX.email)
  const phone = str(body?.phone, MAX.phone)
  const details = str(body?.details, MAX.details)
  const typeKey = TYPES[body?.type] ? body.type : 'other'

  if (!name) return Response.json({ error: 'Add your name so we can find your records.' }, { status: 400 })
  if (!isEmail(email)) return Response.json({ error: 'Add an email we can reply to.' }, { status: 400 })

  const type = TYPES[typeKey]
  const received = new Date().toISOString()
  const rows = [
    ['Request', type],
    ['Name', name],
    ['Email', email],
    ['Phone', phone || 'not given'],
    ['Received', received],
  ]

  const checklist = [
    'Reply within 10 days to confirm you received it.',
    'Verify: the requester must control the email or phone on file (reply from it, or confirm a code texted to it).',
    'Act within 30 days of receipt (see docs/privacy-requests.md).',
    'Reply to confirm what was done and what was kept (and why).',
  ]

  try {
    await sendEmail({
      to: LEGAL.email,
      replyTo: email,
      subject: `Privacy request: ${type} from ${name}`,
      text: `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${details || '(no details)'}\n\nNext steps:\n${checklist.map((c, i) => `${i + 1}. ${c}`).join('\n')}`,
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#111">
          <p style="margin:0 0 14px"><strong>New privacy request from ${esc(LEGAL.site)}</strong></p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;font-size:14px">
            ${rows.map(([k, v]) => `<tr><td style="padding:2px 14px 2px 0;color:#555">${k}</td><td style="padding:2px 0"><strong>${esc(v)}</strong></td></tr>`).join('')}
          </table>
          <div style="white-space:pre-wrap;border-left:3px solid #d4a333;padding:2px 0 2px 14px;margin:0 0 16px">${esc(details || '(no details)')}</div>
          <p style="margin:0 0 6px"><strong>Next steps</strong></p>
          <ol style="margin:0;padding-left:20px">${checklist.map(c => `<li>${esc(c)}</li>`).join('')}</ol>
        </div>
      `,
    })
  } catch (err) {
    console.error('[privacy-request] send failed', err)
    return Response.json(
      { error: `We could not send that. Email ${LEGAL.email} directly and we will handle it from there.` },
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
