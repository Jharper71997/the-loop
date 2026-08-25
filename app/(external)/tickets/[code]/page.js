import { notFound, redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { contactHasSignedCurrent } from '@/lib/waiver'
import { appUrl } from '@/lib/stripe'
import { brandFor, prefixLink } from '@/lib/businessConfig'
import { getBar, getBarByName } from '@/lib/bars'
import TicketView from './TicketView'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function TicketPage({ params }) {
  const { code } = await params
  if (!code) notFound()

  const supabase = supabaseAdmin()

  const { data: qr } = await supabase
    .from('qr_codes')
    .select('id, code, kind, order_item_id')
    .eq('code', code)
    .maybeSingle()

  if (!qr || qr.kind !== 'checkin' || !qr.order_item_id) notFound()

  const { data: item } = await supabase
    .from('order_items')
    .select(`
      id,
      rider_first_name,
      rider_last_name,
      contact_id,
      stop_index,
      pickup_stop_index,
      checked_in_at,
      voided_at,
      claim_token,
      claimed_at,
      order:orders ( id, status, event:events ( id, name, event_date, pickup_time, kind, group:groups ( id, schedule ) ) )
    `)
    .eq('id', qr.order_item_id)
    .maybeSingle()

  if (!item) notFound()

  // Unclaimed claim-link seat: a friend the buyer paid for hasn't filled in
  // their info or signed the waiver yet. The boarding pass at this URL has no
  // rider name and no signable waiver, so the friend has no path forward.
  // Bounce them into the claim flow — same URL works once they finish.
  if (item.claim_token && !item.claimed_at && !item.voided_at) {
    redirect(`/c/${item.claim_token}`)
  }

  const event = item.order?.event || null
  const isPaid = item.order?.status === 'paid'
  const isVoided = !!item.voided_at

  // Branding is data-driven from the loaded event's kind, so a Surf ticket reads
  // "Surf City" whether opened at /tickets/<code> or /surfcity/tickets/<code>.
  const cfg = brandFor(event?.kind)

  // The rider's OWN pickup, not the route's first stop. This page used to
  // hardcode schedule[0], so every rider who chose any bar other than the
  // first was handed a pass naming the wrong bar at the wrong time — while
  // checkout, /api/claim, the approach alert and the confirmation SMS all
  // resolved it correctly. Same rule they use: a per-bar ticket's stop_index
  // wins, else a walk-on's chosen pickup_stop_index.
  const schedule = event?.group?.schedule || []
  const pickupIndex = Number.isInteger(item.stop_index) ? item.stop_index
    : (Number.isInteger(item.pickup_stop_index) ? item.pickup_stop_index : null)
  // Legacy passes carry neither index. Falling back to stop 0 is what this
  // page has always done and is still the only available guess for them.
  const effectivePickupIndex = pickupIndex != null && schedule[pickupIndex] ? pickupIndex : 0
  const firstStop = schedule[effectivePickupIndex] || null
  const pickupSpot = firstStop?.name || null
  const pickupTimeFromStop = firstStop?.start_time || null
  // Only this rider's OWN stop time goes on the pass. On older events every
  // stop except the first carries an empty start_time, and the old fallback to
  // event.pickup_time therefore handed a Hideaway rider the 7:30 that belongs
  // to Angry Ginger. The event-wide time is only true for stop 0, so anyone
  // else gets no time rather than a wrong one — TicketView already renders the
  // pickup bar without a time when this is null.
  const pickupTime = pickupTimeFromStop
    || (effectivePickupIndex === 0 ? (event?.pickup_time || null) : null)

  // The whole route, not just the first stop. We were already loading
  // groups.schedule to find the pickup and then throwing the rest away, so a
  // rider holding a boarding pass could not see which bars the night actually
  // visits — the one thing they most want to know once the seat is bought.
  //
  // Stop names come from the schedule (which Ticket Tailor sync matches on and
  // must not be renamed), so resolve them through getBar for display only: the
  // same bar was reading as two different places depending on the page. Surf
  // and Marines schedules aren't in the Brew bar directory, so an unresolved
  // stop keeps its schedule name rather than disappearing.
  const isBrew = !event?.kind || event.kind === 'brew'
  const stops = (event?.group?.schedule || [])
    .filter(st => st && (st.name || st.slug))
    .map((st, i) => {
      // Only Brew stops resolve — getBar reads the Brew directory, and a Surf
      // or Marines bar sharing a name must never link to a Brew bar page.
      const bar = isBrew ? ((st.slug && getBar(st.slug)) || getBarByName(st.name)) : null
      return {
        order: i,
        name: bar?.name || st.name,
        slug: bar?.slug || null,
        time: st.start_time || null,
        isPickup: i === effectivePickupIndex,
      }
    })

  // Waiver status — show the rider whether they still need to sign before
  // pickup. We render a deep link to /waiver/<contactId> right on the ticket.
  let waiverSigned = false
  if (item.contact_id) {
    waiverSigned = await contactHasSignedCurrent(supabase, item.contact_id)
  }

  // Server-render the QR as a data URL so the page is instant offline-cached
  // and doesn't depend on the qrcode.ai third-party for every page load.
  const qrTargetUrl = `${appUrl()}/r/${code}`
  const qrDataUrl = await QRCode.toDataURL(qrTargetUrl, {
    margin: 1,
    width: 600,
    color: { dark: '#0a0a0b', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })

  const riderName = [item.rider_first_name, item.rider_last_name]
    .filter(Boolean)
    .join(' ') || 'Guest'

  const ticketUrl = `${appUrl()}/tickets/${code}`

  return (
    <TicketView
      code={code}
      qrDataUrl={qrDataUrl}
      ticketUrl={ticketUrl}
      riderName={riderName}
      eventName={event?.name || cfg.brand}
      brand={cfg.shortBrand}
      eventsHref={prefixLink('/events', event?.kind)}
      eventDate={event?.event_date || null}
      pickupTime={pickupTime}
      pickupSpot={pickupSpot}
      stops={stops}
      barsHref={prefixLink('/bars', event?.kind)}
      trackHref={cfg.trackPath}
      isPaid={isPaid}
      isVoided={isVoided}
      waiverSigned={waiverSigned}
      contactId={item.contact_id || null}
      checkedInAt={item.checked_in_at || null}
      supportPhone={cfg.contactPhone}
      supportPhoneDisplay={cfg.contactPhoneDisplay}
    />
  )
}
