// Booking confirmation + reminder email templates — HTML + plain-text bodies.
//
// Brand palette: black (#0a0a0b) bg, gold (#d4a333) accent. Inline styles only
// because Gmail/Apple Mail strip <style> blocks aggressively.

import { appUrl } from './stripe'
import { brandFor } from './businessConfig'

const GOLD = '#d4a333'
const INK = '#f5f5f7'

// Footer identity line per business. Marines keeps its "ID required" line
// (handled inline). Brew + Surf show a refund line; only Brew shows its help
// phone (Surf has no shared number yet).
function footerHtml(kind) {
  if (kind === 'marines') return `<p style="margin:0;">The Loop · ID required to ride</p>`
  if (kind === 'surf') {
    return `<p style="margin:0 0 4px;">Refunds available up to 24h before pickup. Reply to this email for help.</p>
      <p style="margin:0;">Surf City Loop · Topsail Island, NC</p>`
  }
  return `<p style="margin:0 0 4px;">Refunds available up to 24h before pickup. Reply or text (636) 266-1801 for help.</p>
      <p style="margin:0;">Jville Brew Loop · Jacksonville, NC</p>`
}
function footerText(kind) {
  if (kind === 'marines') return `The Loop · ID required to ride`
  if (kind === 'surf') return `Refunds available up to 24h before pickup. Reply to this email for help.\nSurf City Loop`
  return `Refunds available up to 24h before pickup. Text (636) 266-1801 for help.\nJville Brew Loop`
}

// ticketLinks now carries optional stopName + stopTime (HH:MM) so each
// ticket card can show "Boards at Angry Ginger at 7:30 PM".
//   ticketLinks: [{ name, url, stopName?, stopTime? }]
export function bookingConfirmationHtml({ buyer, event, ticketLinks = [], waiverLink, hasSignedWaiver, claimLinks = [] }) {
  const dateLabel = formatDate(event?.event_date)
  const time = event?.pickup_time ? ` at ${formatTime(event.pickup_time)}` : ''
  const greet = buyer?.firstName ? `Hi ${escape(buyer.firstName)},` : 'You’re booked!'

  // Per-business branding. The Loop (Marines) reads "The Loop" w/ no bar cues
  // and /marines/* links; Surf City reads "Surf City Loop" w/ /surfcity/* links;
  // Brew is unchanged. Marines also swaps the "what's included" copy below.
  const marines = event?.kind === 'marines'
  const cfg = brandFor(event?.kind)
  const brandLabel = cfg.brand
  const trackPath = cfg.trackPath
  const lookupPath = cfg.myTicketsPath

  const ticketsBlock = ticketLinks.length
    ? `<p style="margin:18px 0 14px;color:${INK};font-size:14px;">Show this QR to the driver when you board:</p>
       ${ticketLinks.map(t => {
         const qrSrc = `${appUrl()}/api/qr-image?size=480&data=${encodeURIComponent(t.url)}`
         const stopLine = t.stopName
           ? `<p style="margin:0 0 4px;color:#0a0a0b;font-size:14px;font-weight:700;">${escape(t.stopName)}${t.stopTime ? ` · ${escape(formatTime(t.stopTime))}` : ''}</p>`
           : ''
         const riderLine = t.name
           ? `<p style="margin:0 0 10px;color:#6c6c72;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;font-weight:700;">${escape(t.name)}</p>`
           : ''
         return `
         <div style="margin:0 0 18px;padding:18px;background:#ffffff;border-radius:14px;text-align:center;">
           ${stopLine}
           ${riderLine}
           <img src="${escape(qrSrc)}" alt="Ticket QR code" width="240" height="240" style="display:block;margin:6px auto 0;width:240px;height:240px;border:0;" />
           <p style="margin:10px 0 0;font-size:11px;color:#6c6c72;word-break:break-all;">
             <a href="${escape(t.url)}" style="color:#6c6c72;text-decoration:underline;">${escape(t.url)}</a>
           </p>
         </div>`
       }).join('')}`
    : ''

  const includedBlock = marines
    ? `
    <div style="margin:24px 0;padding:16px;background:#15151a;border:1px solid #2a2a31;border-radius:10px;">
      <p style="margin:0 0 10px;color:${GOLD};font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">What’s included</p>
      <ul style="margin:0;padding:0 0 0 18px;color:${INK};font-size:14px;line-height:1.6;">
        <li>Your seat on The Loop — board at the gate, ride the red line</li>
        <li>Show this QR to the driver when you board (ID required to ride)</li>
        <li>Hop between stops all over town as the shuttle runs its loop</li>
        <li>Live shuttle tracking so you know when it’s rolling up next</li>
      </ul>
    </div>`
    : `
    <div style="margin:24px 0;padding:16px;background:#15151a;border:1px solid #2a2a31;border-radius:10px;">
      <p style="margin:0 0 10px;color:${GOLD};font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">What’s included</p>
      <ul style="margin:0;padding:0 0 0 18px;color:${INK};font-size:14px;line-height:1.6;">
        <li>One seat on the ${escape(cfg.shortBrand)} shuttle for the night</li>
        <li>Boarding at your selected bar at the time on your QR above</li>
        <li>Ride between bars on the route as the shuttle rotates</li>
        <li>Live shuttle tracking so you know when the bus is rolling up next</li>
      </ul>
    </div>`

  const appBlock = `
    <div style="margin:24px 0;padding:16px;background:#15151a;border:1px solid #2a2a31;border-radius:10px;">
      <p style="margin:0 0 10px;color:${GOLD};font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">Use the app</p>
      <p style="margin:0 0 8px;color:${INK};font-size:14px;line-height:1.5;">
        <strong>Live tracking:</strong> <a href="${appUrl()}${trackPath}" style="color:${GOLD};text-decoration:none;font-weight:600;">${appUrl().replace(/^https?:\/\//, '')}${trackPath}</a> shows where the shuttle is, what stop is next, and how long until it reaches you.
      </p>
      <p style="margin:0 0 8px;color:${INK};font-size:14px;line-height:1.5;">
        <strong>Your tickets:</strong> <a href="${appUrl()}${lookupPath}" style="color:${GOLD};text-decoration:none;font-weight:600;">${appUrl().replace(/^https?:\/\//, '')}${lookupPath}</a> — enter your phone to pull up the QR if you lose this email.
      </p>
      <p style="margin:0;color:${INK};font-size:14px;line-height:1.5;">
        <strong>Heads-up:</strong> we’ll text you about an hour before pickup with a fresh link to your ticket.
      </p>
    </div>`

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
      <p style="margin:0;color:${GOLD};font-size:11px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;">${escape(brandLabel)}</p>
    </div>

    <h1 style="margin:0 0 6px;color:${INK};font-size:22px;font-weight:700;">${greet}</h1>
    <p style="margin:0 0 6px;color:${INK};font-size:16px;">You’re on the shuttle <strong>${escape(dateLabel)}</strong>${escape(time)}.</p>

    ${ticketsBlock}
    ${includedBlock}
    ${appBlock}
    ${waiverBlock}
    ${claimBlock}

    <div style="margin:24px 0;padding-top:16px;border-top:1px solid #2a2a31;">
      <p style="margin:0 0 6px;color:#9c9ca3;font-size:13px;">Lost a link?</p>
      <p style="margin:0;font-size:13px;"><a href="${appUrl()}${lookupPath}" style="color:${GOLD};text-decoration:none;">Find my tickets</a> — just enter your phone.</p>
    </div>

    <div style="margin:24px 0 0;padding-top:16px;border-top:1px solid #2a2a31;color:#6c6c72;font-size:12px;line-height:1.5;">
      ${footerHtml(event?.kind)}
    </div>
  </div>
</body></html>`
}

export function bookingConfirmationText({ buyer, event, ticketLinks = [], waiverLink, hasSignedWaiver, claimLinks = [] }) {
  const dateLabel = formatDate(event?.event_date)
  const time = event?.pickup_time ? ` at ${formatTime(event.pickup_time)}` : ''
  const greet = buyer?.firstName ? `Hi ${buyer.firstName},` : 'You’re booked!'

  const marines = event?.kind === 'marines'
  const cfg = brandFor(event?.kind)
  const trackPath = cfg.trackPath
  const lookupPath = cfg.myTicketsPath

  let body = `${greet}\n\nYou're on ${cfg.rideName} ${dateLabel}${time}.\n\n`

  if (ticketLinks.length) {
    body += 'Show to the driver when you board:\n'
    for (const t of ticketLinks) {
      const stop = t.stopName ? `${t.stopName}${t.stopTime ? ' at ' + formatTime(t.stopTime) : ''}` : ''
      const rider = t.name ? `  ${t.name}` : ''
      if (stop) body += `${stop}${rider ? ' — ' + t.name : ''}: ${t.url}\n`
      else if (rider) body += `${rider}: ${t.url}\n`
      else body += `  ${t.url}\n`
    }
    body += '\n'
  }
  body += 'WHAT’S INCLUDED\n'
  if (marines) {
    body += '- Your seat on The Loop — board at the gate, ride the red line\n'
    body += '- Show your QR to the driver when you board (ID required to ride)\n'
    body += '- Hop between stops all over town as the shuttle runs its loop\n'
    body += '- Live shuttle tracking\n\n'
  } else {
    body += `- One seat on the ${cfg.shortBrand} shuttle for the night\n`
    body += '- Boarding at your selected bar at the time on your ticket\n'
    body += '- Ride between bars on the route as the shuttle rotates\n'
    body += '- Live shuttle tracking\n\n'
  }
  body += 'USE THE APP\n'
  body += `- Live tracking: ${appUrl()}${trackPath}\n`
  body += `- Your tickets: ${appUrl()}${lookupPath} (enter your phone)\n`
  body += `- We'll text you about an hour before pickup with a fresh link.\n\n`

  if (!hasSignedWaiver && waiverLink) {
    body += `SIGN YOUR WAIVER (30s, required): ${waiverLink}\n\n`
  }
  if (claimLinks.length) {
    body += 'Claim links to share with friends (each one signs their own waiver):\n'
    for (const url of claimLinks) body += `  ${url}\n`
    body += '\n'
  }
  body += `Lost a link? Find your tickets: ${appUrl()}${lookupPath}\n\n`
  body += footerText(event?.kind)
  return body
}

// 1-hour-before reminder. Smaller than the confirmation: just the QR, the
// stop, the time, and the live track link.
export function ticketReminderHtml({ rider, event, ticketUrl, stopName, stopTime }) {
  const greet = rider?.firstName ? `Hi ${escape(rider.firstName)},` : 'Heads-up,'
  const dateLabel = formatDate(event?.event_date)
  const stopLine = stopName ? `${escape(stopName)}${stopTime ? ` at ${escape(formatTime(stopTime))}` : ''}` : ''
  const qrSrc = `${appUrl()}/api/qr-image?size=480&data=${encodeURIComponent(ticketUrl)}`
  const cfg = brandFor(event?.kind)

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${INK};">
  <div style="max-width:540px;margin:0 auto;padding:24px 20px;">
    <div style="text-align:center;margin-bottom:18px;">
      <p style="margin:0;color:${GOLD};font-size:11px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;">${escape(cfg.brand)} · 1 hour out</p>
    </div>

    <h1 style="margin:0 0 6px;color:${INK};font-size:22px;font-weight:700;">${greet}</h1>
    <p style="margin:0 0 6px;color:${INK};font-size:16px;">Pickup is about an hour away. <strong>${stopLine || escape(dateLabel)}</strong>.</p>
    <p style="margin:0 0 14px;color:#9c9ca3;font-size:13px;">Show this QR to the driver when you board.</p>

    <div style="margin:0 0 18px;padding:18px;background:#ffffff;border-radius:14px;text-align:center;">
      ${stopLine ? `<p style="margin:0 0 8px;color:#0a0a0b;font-size:14px;font-weight:700;">${stopLine}</p>` : ''}
      <img src="${escape(qrSrc)}" alt="Ticket QR code" width="240" height="240" style="display:block;margin:6px auto 0;width:240px;height:240px;border:0;" />
      <p style="margin:10px 0 0;font-size:11px;color:#6c6c72;word-break:break-all;">
        <a href="${escape(ticketUrl)}" style="color:#6c6c72;text-decoration:underline;">${escape(ticketUrl)}</a>
      </p>
    </div>

    <div style="margin:18px 0;padding:14px;background:#15151a;border:1px solid #2a2a31;border-radius:10px;">
      <p style="margin:0 0 8px;color:${GOLD};font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">Track the shuttle</p>
      <p style="margin:0;color:${INK};font-size:14px;line-height:1.5;">
        <a href="${appUrl()}${cfg.trackPath}" style="color:${GOLD};text-decoration:none;font-weight:600;">${appUrl().replace(/^https?:\/\//, '')}${cfg.trackPath}</a> — see where the bus is, what bar is next, and your live arrival.
      </p>
    </div>

    <div style="margin:24px 0 0;padding-top:16px;border-top:1px solid #2a2a31;color:#6c6c72;font-size:12px;line-height:1.5;">
      ${footerHtml(event?.kind)}
    </div>
  </div>
</body></html>`
}

export function ticketReminderText({ rider, event, ticketUrl, stopName, stopTime }) {
  const greet = rider?.firstName ? `Hi ${rider.firstName},` : 'Heads-up,'
  const stopLine = stopName ? `${stopName}${stopTime ? ' at ' + formatTime(stopTime) : ''}` : formatDate(event?.event_date)
  const cfg = brandFor(event?.kind)

  let body = `${greet}\n\nPickup is about an hour away. ${stopLine}.\n\n`
  body += `Your ticket: ${ticketUrl}\n`
  body += `Track the shuttle: ${appUrl()}${cfg.trackPath}\n\n`
  body += cfg.brand
  return body
}

// Morning-after feedback survey. Deliberately the plainest email we send —
// one line and one button. Every extra block competes with the only action
// that matters, which is the tap through to /feedback/<token>.
export function rideFeedbackHtml({ rider, event, feedbackUrl }) {
  const greet = rider?.firstName ? `Hi ${escape(rider.firstName)},` : 'Hey,'
  const dateLabel = formatDate(event?.event_date)
  const cfg = brandFor(event?.kind)

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${INK};">
  <div style="max-width:540px;margin:0 auto;padding:24px 20px;">
    <div style="text-align:center;margin-bottom:18px;">
      <p style="margin:0;color:${GOLD};font-size:11px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;">${escape(cfg.brand)}</p>
    </div>

    <h1 style="margin:0 0 10px;color:${INK};font-size:22px;font-weight:700;">${greet}</h1>
    <p style="margin:0 0 6px;color:${INK};font-size:16px;line-height:1.5;">
      Thanks for riding with us${dateLabel ? ` on ${escape(dateLabel)}` : ''}. How did we do?
    </p>
    <p style="margin:0 0 20px;color:#9c9ca3;font-size:14px;line-height:1.5;">
      Three taps, about 30 seconds. We read every one of these and it decides which bars we keep on the route.
    </p>

    <div style="text-align:center;margin:0 0 22px;">
      <a href="${escape(feedbackUrl)}" style="display:inline-block;padding:14px 30px;background:${GOLD};color:#0a0a0b;border-radius:10px;font-size:16px;font-weight:700;text-decoration:none;">
        Rate your ride
      </a>
    </div>

    <p style="margin:0;text-align:center;font-size:11px;color:#6c6c72;word-break:break-all;">
      <a href="${escape(feedbackUrl)}" style="color:#6c6c72;text-decoration:underline;">${escape(feedbackUrl)}</a>
    </p>

    <div style="margin:24px 0 0;padding-top:16px;border-top:1px solid #2a2a31;color:#6c6c72;font-size:12px;line-height:1.5;">
      ${footerHtml(event?.kind)}
    </div>
  </div>
</body></html>`
}

export function rideFeedbackText({ rider, event, feedbackUrl }) {
  const greet = rider?.firstName ? `Hi ${rider.firstName},` : 'Hey,'
  const dateLabel = formatDate(event?.event_date)
  const cfg = brandFor(event?.kind)

  let body = `${greet}\n\nThanks for riding with us${dateLabel ? ` on ${dateLabel}` : ''}. How did we do?\n\n`
  body += `Three taps, about 30 seconds: ${feedbackUrl}\n\n`
  body += `We read every one of these and it decides which bars we keep on the route.\n\n`
  body += cfg.brand
  return body
}

// Merch order confirmation. /merch/success tells the buyer "we emailed your
// receipt", so this is what makes that true — Stripe's own receipt only fires
// if receipts are switched on in the dashboard, and it says nothing about how
// they're getting the order. The shipping method is the point: "on the shuttle"
// means they have to come find us, and that has to be in writing.
//
//   items: [{ name, unit_price_cents, quantity }]
export function merchOrderHtml({ order, items = [] }) {
  const rows = items.map(it => `
    <tr>
      <td style="padding:8px 0;color:${INK};font-size:14px;">${escape(it.name)}${it.quantity > 1 ? ` <span style="color:#9c9ca3;">&times; ${it.quantity}</span>` : ''}</td>
      <td style="padding:8px 0;color:${INK};font-size:14px;font-weight:700;text-align:right;white-space:nowrap;">${money(it.unit_price_cents * it.quantity)}</td>
    </tr>`).join('')

  const shipping = order?.shipping_method || null
  const onShuttle = /shuttle/i.test(shipping || '')
  const addr = order?.shipping_address || null
  const addrBlock = (!onShuttle && addr)
    ? `
      <div style="margin:22px 0 0;padding-top:16px;border-top:1px solid #2a2a31;">
        <p style="margin:0 0 8px;color:${GOLD};font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">Shipping to</p>
        <p style="margin:0;color:${INK};font-size:14px;line-height:1.55;">
          ${[order?.buyer_name, addr.line1, addr.line2, [addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')]
            .filter(Boolean).map(l => escape(String(l))).join('<br />')}
        </p>
      </div>`
    : ''

  const handoffBlock = onShuttle
    ? `
      <div style="margin:22px 0 0;padding:16px 18px;background:#15151a;border-radius:12px;border:1px solid #2a2a31;">
        <p style="margin:0 0 6px;color:${GOLD};font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">Grabbing it on the shuttle</p>
        <p style="margin:0;color:${INK};font-size:14px;line-height:1.55;">We&rsquo;ll have it on board with your name on it. Just tell the driver when you get on &mdash; no need to bring this email.</p>
      </div>`
    : ''

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${INK};">
  <div style="max-width:540px;margin:0 auto;padding:24px 20px;">
    <div style="text-align:center;margin-bottom:24px;">
      <p style="margin:0;color:${GOLD};font-size:11px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;">Jville Brew Loop</p>
    </div>

    <h1 style="margin:0 0 6px;color:${INK};font-size:22px;font-weight:700;">${order?.buyer_name ? `Thanks, ${escape(String(order.buyer_name).split(' ')[0])}.` : 'Thanks for the order.'}</h1>
    <p style="margin:0 0 20px;color:#9c9ca3;font-size:15px;">Your order is confirmed.</p>

    <table style="width:100%;border-collapse:collapse;">
      ${rows}
      <tr><td colspan="2" style="padding:6px 0 0;border-top:1px solid #2a2a31;"></td></tr>
      ${order?.shipping_cents != null ? `
      <tr>
        <td style="padding:8px 0 0;color:#9c9ca3;font-size:13px;">${escape(shipping || 'Shipping')}</td>
        <td style="padding:8px 0 0;color:#9c9ca3;font-size:13px;text-align:right;">${order.shipping_cents === 0 ? 'Free' : money(order.shipping_cents)}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:8px 0 0;color:${INK};font-size:15px;font-weight:700;">Total</td>
        <td style="padding:8px 0 0;color:${INK};font-size:15px;font-weight:700;text-align:right;">${money(order?.total_cents ?? order?.subtotal_cents)}</td>
      </tr>
    </table>

    ${handoffBlock}
    ${addrBlock}

    <div style="margin:24px 0 0;padding-top:16px;border-top:1px solid #2a2a31;color:#6c6c72;font-size:12px;line-height:1.5;">
      <p style="margin:0 0 4px;">Questions about this order? Just reply to this email.</p>
      <p style="margin:0;">Jville Brew Loop &middot; Jacksonville, NC</p>
    </div>
  </div>
</body></html>`
}

export function merchOrderText({ order, items = [] }) {
  const lines = items.map(it =>
    `- ${it.name}${it.quantity > 1 ? ` x${it.quantity}` : ''}  ${money(it.unit_price_cents * it.quantity)}`)
  const shipping = order?.shipping_method || null
  const onShuttle = /shuttle/i.test(shipping || '')
  const addr = order?.shipping_address || null

  const parts = [
    order?.buyer_name ? `Thanks, ${String(order.buyer_name).split(' ')[0]}.` : 'Thanks for the order.',
    'Your order is confirmed.',
    '',
    ...lines,
  ]
  if (order?.shipping_cents != null) {
    parts.push(`${shipping || 'Shipping'}: ${order.shipping_cents === 0 ? 'Free' : money(order.shipping_cents)}`)
  }
  parts.push(`Total: ${money(order?.total_cents ?? order?.subtotal_cents)}`, '')

  if (onShuttle) {
    parts.push("Grabbing it on the shuttle: we'll have it on board with your name on it. Just tell the driver when you get on.", '')
  } else if (addr) {
    parts.push('Shipping to:', [order?.buyer_name, addr.line1, addr.line2,
      [addr.city, addr.state, addr.postal_code].filter(Boolean).join(', ')].filter(Boolean).join('\n'), '')
  }

  parts.push('Questions about this order? Just reply to this email.', 'Jville Brew Loop')
  return parts.join('\n')
}

function money(cents) {
  const n = (cents || 0) / 100
  return `$${n.toFixed(n % 1 === 0 ? 0 : 2)}`
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

// Survey reward: the 50%-off code paid out for finishing /feedback.
//
// Deliberately says nothing about Google reviews. The reward is for the
// feedback, and putting the two in one message is what turns a customer
// research incentive into an incentivised review (see sql/053_survey_reward.sql
// and the header on bl-review-email.js). Keep them apart.
//
//   { firstName, code, bookUrl, expiresLabel }
export function surveyRewardHtml({ firstName, code, bookUrl, expiresLabel }) {
  const greet = firstName ? `Thanks, ${escape(firstName)}.` : 'Thanks.'
  const cfg = brandFor('brew')

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${INK};">
  <div style="max-width:540px;margin:0 auto;padding:24px 20px;">
    <div style="text-align:center;margin-bottom:18px;">
      <p style="margin:0;color:${GOLD};font-size:11px;letter-spacing:0.22em;text-transform:uppercase;font-weight:700;">${escape(cfg.brand)}</p>
    </div>

    <h1 style="margin:0 0 10px;color:${INK};font-size:22px;font-weight:700;">${greet}</h1>
    <p style="margin:0 0 22px;color:${INK};font-size:16px;line-height:1.5;">
      That is genuinely useful. Here is the 50% off we promised you, good for your next ride.
    </p>

    <div style="margin:0 0 22px;padding:22px;background:#15151a;border:1px solid #2a2a31;border-radius:12px;text-align:center;">
      <p style="margin:0 0 10px;color:#9c9ca3;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;">Your code</p>
      <p style="margin:0;color:${GOLD};font-size:30px;font-weight:800;letter-spacing:0.1em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escape(code)}</p>
    </div>

    <p style="margin:0 0 20px;color:#9c9ca3;font-size:14px;line-height:1.5;">
      Type it into the discount box at checkout. One ride, ${escape(expiresLabel)}.
    </p>

    <div style="text-align:center;margin:0 0 22px;">
      <a href="${escape(bookUrl)}" style="display:inline-block;padding:14px 30px;background:${GOLD};color:#0a0a0b;border-radius:10px;font-size:16px;font-weight:700;text-decoration:none;">
        Pick your night
      </a>
    </div>

    <p style="margin:0;text-align:center;font-size:11px;color:#6c6c72;word-break:break-all;">
      <a href="${escape(bookUrl)}" style="color:#6c6c72;text-decoration:underline;">${escape(bookUrl)}</a>
    </p>

    <div style="margin:24px 0 0;padding-top:16px;border-top:1px solid #2a2a31;color:#6c6c72;font-size:12px;line-height:1.5;">
      ${footerHtml('brew')}
    </div>
  </div>
</body></html>`
}

export function surveyRewardText({ firstName, code, bookUrl, expiresLabel }) {
  const greet = firstName ? `Thanks, ${firstName}.` : 'Thanks.'
  let body = `${greet}\n\nThat is genuinely useful. Here is the 50% off we promised you, good for your next ride.\n\n`
  body += `YOUR CODE: ${code}\n\n`
  body += `Type it into the discount box at checkout. One ride, ${expiresLabel}.\n\n`
  body += `Pick your night: ${bookUrl}\n\n`
  body += footerText('brew')
  return body
}
