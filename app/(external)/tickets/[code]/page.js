import { notFound } from 'next/navigation'
import QRCode from 'qrcode'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { contactHasSignedCurrent } from '@/lib/waiver'
import { appUrl } from '@/lib/stripe'
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
      checked_in_at,
      order:orders ( id, status, event:events ( id, name, event_date, pickup_time ) )
    `)
    .eq('id', qr.order_item_id)
    .maybeSingle()

  if (!item) notFound()

  const event = item.order?.event || null
  const isPaid = item.order?.status === 'paid'

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
      eventName={event?.name || 'Brew Loop'}
      eventDate={event?.event_date || null}
      pickupTime={event?.pickup_time || null}
      isPaid={isPaid}
      waiverSigned={waiverSigned}
      contactId={item.contact_id || null}
      checkedInAt={item.checked_in_at || null}
    />
  )
}
