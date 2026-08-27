import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendEmail } from '@/lib/email'
import { CONTACT } from '@/app/(external)/_components/site/nav'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/party-request
//   { name, phone, email?, requested_date?, party_size, occasion?, notes?, company? }
//
// A private-outing lead from the public /parties page. Two things happen and
// they are deliberately independent:
//
//   1. The row lands in party_requests. This is the durable copy — it is what
//      /leadership/parties works off, and it is what turns into a party.
//   2. We get an email.
//
// The DB write is the one that must not be lost, so a failed email still
// returns ok. Losing a lead because Resend had a bad minute is the expensive
// failure; a lead sitting unseen in the console for an hour is not.

const MAX = { name: 120, email: 200, phone: 40, occasion: 60, notes: 4000 }

export async function POST(req) {
  let body
  try { body = await req.json() } catch { return Response.json({ error: 'bad json' }, { status: 400 }) }

  // Honeypot: pretend it worked so bots do not retry.
  if (typeof body?.company === 'string' && body.company.trim()) {
    return Response.json({ ok: true })
  }

  const name = str(body?.name, MAX.name)
  const email = str(body?.email, MAX.email)
  const phone = str(body?.phone, MAX.phone)
  const occasion = str(body?.occasion, MAX.occasion)
  const notes = str(body?.notes, MAX.notes)
  const requestedDate = isDate(body?.requested_date) ? body.requested_date : null
  const partySize = toInt(body?.party_size)

  if (!name) return Response.json({ error: 'Add your name so we know who we’re quoting.' }, { status: 400 })
  if (!phone) return Response.json({ error: 'We reply by text, so we need a mobile number.' }, { status: 400 })
  if (email && !isEmail(email)) return Response.json({ error: 'That email address doesn’t look right.' }, { status: 400 })
  if (!partySize || partySize < 1) return Response.json({ error: 'Roughly how many people are riding?' }, { status: 400 })

  let requestId = null
  try {
    const sb = supabaseAdmin()
    const { data, error } = await sb
      .from('party_requests')
      .insert({
        name,
        email: email || null,
        phone,
        requested_date: requestedDate,
        party_size: partySize,
        occasion: occasion || null,
        notes: notes || null,
      })
      .select('id')
      .single()
    if (error) throw error
    requestId = data?.id || null
  } catch (err) {
    console.error('[party-request] insert failed', err)
    // The lead is the product of this endpoint. If it did not persist, say so
    // rather than showing a thank-you for a request nobody will ever read.
    return Response.json(
      { error: `We couldn’t save that. Text ${CONTACT.phoneDisplay} and we’ll sort your night out directly.` },
      { status: 502 },
    )
  }

  const rows = [
    ['Name', name],
    ['Mobile', phone],
    ['Email', email || '—'],
    ['Date', requestedDate || 'not set'],
    ['Party size', String(partySize)],
    ['Occasion', occasion || '—'],
  ]

  try {
    await sendEmail({
      to: CONTACT.email,
      replyTo: email || undefined,
      subject: `Private party request — ${name}, ${partySize} riders${requestedDate ? ` on ${requestedDate}` : ''}`,
      text: `${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${notes || '(no notes)'}\n\nBuild it: /leadership/parties`,
      html: `
        <div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#111">
          <p style="margin:0 0 14px"><strong>Private party request</strong></p>
          <table cellpadding="0" cellspacing="0" style="margin:0 0 16px;font-size:14px">
            ${rows.map(([k, v]) => `<tr><td style="padding:2px 14px 2px 0;color:#666">${k}</td><td style="padding:2px 0"><strong>${esc(v)}</strong></td></tr>`).join('')}
          </table>
          ${notes ? `<div style="white-space:pre-wrap;border-left:3px solid #d4a333;padding:2px 0 2px 14px">${esc(notes)}</div>` : ''}
          <p style="margin:18px 0 0;color:#666;font-size:13px">Quote it and build the link in the console under Parties.</p>
        </div>
      `,
    })
  } catch (err) {
    // Saved but not emailed. The console still has it, so this is a warning.
    console.error('[party-request] email failed (request saved)', requestId, err)
  }

  return Response.json({ ok: true })
}

function str(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}
function toInt(v) {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}
function isDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
}
function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
}
function esc(v) {
  return String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}
