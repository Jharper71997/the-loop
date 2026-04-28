// Outbound email via Resend (https://resend.com).
//
// Sender: tickets@jvillebrewloop.com once SPF/DKIM are verified; until then
// Resend allows onboarding@resend.dev. Set EMAIL_FROM to override.
//
// Mirrors lib/sms.js shape — single sendEmail({...}) entry. No-op + warn if
// RESEND_API_KEY is unset so dev without the key doesn't crash routes.

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export async function sendEmail({ to, subject, html, text, replyTo }) {
  if (!to) return { skipped: 'no_to' }
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.warn('[email] RESEND_API_KEY missing — skipping send')
    return { skipped: 'no_key' }
  }

  const from = process.env.EMAIL_FROM || 'Brew Loop <onboarding@resend.dev>'
  const payload = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject: subject || 'Brew Loop',
    html: html || undefined,
    text: text || undefined,
  }
  if (replyTo) payload.reply_to = replyTo

  const res = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`resend ${res.status}: ${txt.slice(0, 300)}`)
  }
  return res.json().catch(() => ({}))
}
