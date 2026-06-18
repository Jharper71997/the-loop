import { notFound, redirect } from 'next/navigation'
import QRCode from 'qrcode'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { appUrl } from '@/lib/stripe'
import LoopTicketView from './LoopTicketView'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// The Loop (Marines) boarding pass. A fork of (external)/tickets/[code] with
// the Brew Loop chrome stripped: red theme, no waiver, no security chat. Same
// qr_codes(kind='checkin') -> order_item lookup, so the SAME code the door
// scanner reads is what shows here. Scoped to kind='marines' events — a Brew
// code 404s here (it belongs on /tickets/<code>).
export default async function LoopTicketPage({ params }) {
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
      checked_in_at,
      voided_at,
      claim_token,
      claimed_at,
      ticket_type:ticket_types ( name ),
      order:orders ( id, status, event:events ( id, name, event_date, pickup_time, kind, group:groups ( id, schedule ) ) )
    `)
    .eq('id', qr.order_item_id)
    .maybeSingle()

  if (!item) notFound()

  const event = item.order?.event || null
  if (event?.kind !== 'marines') notFound()

  // Unclaimed claim-link seat — bounce to the claim flow (same as Brew).
  if (item.claim_token && !item.claimed_at && !item.voided_at) {
    redirect(`/c/${item.claim_token}`)
  }

  const isPaid = item.order?.status === 'paid'
  const isVoided = !!item.voided_at

  // First stop on the route is the on-base gate pickup.
  const firstStop = event?.group?.schedule?.[0] || null
  const pickupSpot = firstStop?.name || null
  const pickupTimeFromStop = firstStop?.start_time || null

  const qrTargetUrl = `${appUrl()}/r/${code}`
  const qrDataUrl = await QRCode.toDataURL(qrTargetUrl, {
    margin: 1,
    width: 600,
    color: { dark: '#0a0a0b', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })

  const riderName = [item.rider_first_name, item.rider_last_name]
    .filter(Boolean)
    .join(' ') || 'Rider'

  const ticketUrl = `${appUrl()}/marines/tickets/${code}`

  return (
    <LoopTicketView
      code={code}
      qrDataUrl={qrDataUrl}
      ticketUrl={ticketUrl}
      riderName={riderName}
      passType={item.ticket_type?.name || null}
      eventName={event?.name || 'The Loop'}
      eventDate={event?.event_date || null}
      pickupTime={pickupTimeFromStop || event?.pickup_time || null}
      pickupSpot={pickupSpot}
      isPaid={isPaid}
      isVoided={isVoided}
      checkedInAt={item.checked_in_at || null}
    />
  )
}
