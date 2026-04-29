// Booking confirmation email — HTML + plain-text bodies.
//
// Brand palette: black (#0a0a0b) bg, gold (#d4a333) accent. Inline styles only
// because Gmail/Apple Mail strip <style> blocks aggressively.

import { appUrl } from './stripe'

const GOLD = '#d4a333'
const INK = '#f5f5f7'

export function bookingConfirmationHtml({ buyer, event, ticketLinks = [], waiverLink, hasSignedWaiver, claimLinks = [] }) {
  const dateLabel = formatDate(event?.event_date)
  const time = event?.pickup_time ? ` at ${formatTime(event.pickup_time)}` : ''
  const greet = buyer?.firstName ? `Hi ${escape(buyer.firstName)},` : 'You’re booked!'

  const ticketsBlock = ticketLinks.length
    ? `<p style="margin:0 0 8px;color:${INK};font-size:14px;">Show this to the driver when you board:</p>
       ${ticketLinks.map(t => `
         <p style="margin:0 0 6px;font-size:14px;">
           ${t.name ? `<span style="color:#9c9ca3;">${escape(t.name)}: </span>` : ''}
           <a href="${escape(t.url)}" style="color:${GOLD};text-decoration:none;font-weight:600;">${escape(t.url)}</a>
         </p>`).join('')}`
    : ''

  const waiverBlock = !hasSignedWaiver && waiverLink
    ? `<div style="margin:24px 0;padding:16px;background:#15151a;border:1px solid #2a2a31;border-radius:10px;">
         <p style="margin:0 0 8px;color:${GOLD};font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">Sign your waiver</p>
         <p style="margin:0 0 12px;color:${INK};font-size:14px;">30 seconds. Required before pickup.</p>
         <a href="${escape(waiverLink)}" style="display:inline-block;padding:10px 20px;background:${GOLD};color:#0a0a0b;text-decoration:none;font-weight:700;font-size:14px;border-radius:8px;">Sign waiver</a>
       </div>`
    : ''

  const claimBlock = claimLinks.length
    ? `<div style="margin:24px 0;padding:16px;background:#15151a;border:1px solid #2a2a31;border-radius:10px;">
         <p style="margin:0 0 8px;color:${GOLD};font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">Claim links to share</p>
         <p style="margin:0 0 12px;color:${INK};font-size:14px;">Forward one of these to each friend so they can sign their own waiver:</p>
         ${claimLinks.map(url => `
           <p style="margin:0 0 6px;font-size:14px;">
             <a href="${escape(url)}" style="color:${GOLD};text-decoration:none;">${escape(url)}</a>
           </p>`).join('')}
       </div>`
    : ''

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${INK};">
  <div style="max-width:540px;margin:0 auto;padding:24px 20px;">
    <div style="text-align:center;margin-bottom:24px;">
      <p style="margin:0;color:${GOLD};font-size:11px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;">Jville Brew Loop</p>
    </div>

    <h1 style="margin:0 0 6px;color:${INK};font-size:22px;font-weight:700;">${greet}</h1>
    <p style="margin:0 0 20px;color:${INK};font-size:16px;">You’re on the shuttle <strong>${escape(dateLabel)}</strong>${escape(time)}.</p>

    ${ticketsBlock}
    ${waiverBlock}
    ${claimBlock}

    <div style="margin:24px 0;padding-top:16px;border-top:1px solid #2a2a31;">
      <p style="margin:0 0 6px;color:#9c9ca3;font-size:13px;">Lost a link?</p>
      <p style="margin:0;font-size:13px;"><a href="${appUrl()}/my-tickets" style="color:${GOLD};text-decoration:none;">Find my tickets</a> — just enter your phone.</p>
    </div>

    <div style="margin:24px 0 0;padding-top:16px;border-top:1px solid #2a2a31;color:#6c6c72;font-size:12px;line-height:1.5;">
      <p style="margin:0 0 4px;">Refunds available up to 24h before pickup. Reply or text (636) 266-1801 for help.</p>
      <p style="margin:0;">Jville Brew Loop · Jacksonville, NC</p>
    </div>
  </div>
</body></html>`
}

export function bookingConfirmationText({ buyer, event, ticketLinks = [], waiverLink, hasSignedWaiver, claimLinks = [] }) {
  const dateLabel = formatDate(event?.event_date)
  const time = event?.pickup_time ? ` at ${formatTime(event.pickup_time)}` : ''
  const greet = buyer?.firstName ? `Hi ${buyer.firstName},` : 'You’re booked!'

  let body = `${greet}\n\nYou're on the Brew Loop ${dateLabel}${time}.\n\n`

  if (ticketLinks.length) {
    body += 'Show to the driver when you board:\n'
    for (const t of ticketLinks) {
      body += t.name ? `  ${t.name}: ${t.url}\n` : `  ${t.url}\n`
    }
    body += '\n'
  }
  if (!hasSignedWaiver && waiverLink) {
    body += `Sign your waiver (30s, required): ${waiverLink}\n\n`
  }
  if (claimLinks.length) {
    body += 'Claim links to share with friends (each one signs their own waiver):\n'
    for (const url of claimLinks) body += `  ${url}\n`
    body += '\n'
  }
  body += `Lost a link? Find your tickets: ${appUrl()}/my-tickets\n\n`
  body += `Refunds available up to 24h before pickup. Text (636) 266-1801 for help.\n`
  body += `Jville Brew Loop`
  return body
}

function escape(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return iso }
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr); const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}
