import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import EventShell from './EventShell'
import WaiversPanel from './WaiversPanel'
import SmsBroadcast from '../../../_components/SmsBroadcast'

export const dynamic = 'force-dynamic'

export default async function ManageLoopPage({ params }) {
  const { id } = await params
  const supabase = supabaseAdmin()

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, event_date, pickup_time, schedule')
    .eq('id', id)
    .maybeSingle()
  if (!group) notFound()

  const { data: event } = await supabase
    .from('events')
    .select('id, name, event_date, pickup_time, description, capacity, status, group_id, cover_image_url')
    .eq('group_id', id)
    .maybeSingle()

  const { data: members } = await supabase
    .from('group_members')
    .select('id, current_stop_index, contacts(id, first_name, last_name, phone, has_signed_waiver, waiver_sms_sent_at, waiver_sms_count)')
    .eq('group_id', id)

  let orders = []
  let ticketTypes = []
  let orderItems = []
  if (event?.id) {
    const [oRes, ttRes, oiRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, buyer_name, buyer_phone, total_cents, status, party_size, created_at, paid_at, contact_id, metadata')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('ticket_types')
        .select('id, name, price_cents, stop_index, capacity, active, sort_order')
        .eq('event_id', event.id)
        .order('sort_order', { ascending: true }),
      // Per-ticket-type counts AND the Roster tab both feed off this. Pull
      // every order_item (including voided so the roster can show audit
      // trail). Joined with the contact for waiver status + the order for
      // status/payment_intent.
      supabase
        .from('order_items')
        .select(`
          id, ticket_type_id, contact_id, rider_first_name, rider_last_name,
          rider_phone, rider_email, voided_at, voided_by, void_reason,
          checked_in_at, created_at,
          contact:contacts ( id, first_name, last_name, phone, email, has_signed_waiver ),
          order:orders!inner ( id, event_id, status, stripe_payment_intent_id )
        `)
        .eq('order.event_id', event.id),
    ])
    orders = oRes.data || []
    ticketTypes = ttRes.data || []
    orderItems = oiRes.data || []
  }

  const memberIds = (members || []).map(m => m.contacts?.id).filter(Boolean)
  let waiverSigs = []
  if (memberIds.length) {
    const { data } = await supabase
      .from('waiver_signatures')
      .select('contact_id, full_name_typed, signed_at, waiver_versions(version)')
      .in('contact_id', memberIds)
      .order('signed_at', { ascending: false })
    waiverSigs = data || []
  }

  const flatMembers = (members || []).map(m => ({
    id: m.contacts?.id,
    first_name: m.contacts?.first_name || '',
    last_name: m.contacts?.last_name || '',
    phone: m.contacts?.phone || null,
    has_signed_waiver: !!m.contacts?.has_signed_waiver,
    waiver_sms_sent_at: m.contacts?.waiver_sms_sent_at || null,
  }))

  return (
    <div>
      <EventShell
        group={group}
        event={event || null}
        ticketTypes={ticketTypes}
        members={members || []}
        orders={orders}
        orderItems={orderItems}
        waiverSigs={waiverSigs}
      />

      {(members || []).length > 0 && (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 40px', display: 'grid', gap: 14 }}>
          <WaiversPanel groupId={group.id} members={flatMembers} />
          <SmsBroadcast
            recipients={(members || []).map(m => ({
              id: m.contacts?.id,
              first_name: m.contacts?.first_name || '',
              last_name: m.contacts?.last_name || '',
              phone: m.contacts?.phone || null,
              current_stop_index: m.current_stop_index,
            }))}
            stops={Array.isArray(group.schedule) ? group.schedule : null}
            title="Text the riders on this Loop"
          />
        </div>
      )}
    </div>
  )
}
