import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import EventShell from '@/app/(admin)/admin/groups/[id]/EventShell'
import WaiversPanel from '@/app/(admin)/admin/groups/[id]/WaiversPanel'
import SmsBroadcast from '@/app/(admin)/_components/SmsBroadcast'
import { generateStopsForEvent } from '@/lib/routeStopLogs'

export const dynamic = 'force-dynamic'

async function generateRouteStopsAction(eventId, groupId) {
  'use server'
  if (!eventId) return
  await generateStopsForEvent(supabaseAdmin(), eventId)
  revalidatePath(`/leadership/loops/${groupId}`)
}

export default async function ManageLoopDetailPage({ params }) {
  const { id } = await params
  const supabase = supabaseAdmin()

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, event_date, pickup_time, schedule')
    .eq('id', id)
    .maybeSingle()
  if (!group) notFound()

  const { data: groupEvents } = await supabase
    .from('events')
    .select('id, name, event_date, pickup_time, description, capacity, status, group_id, cover_image_url, created_at')
    .eq('group_id', id)
    .order('created_at', { ascending: false })
  const event = groupEvents?.[0] || null
  const extraEvents = (groupEvents || []).slice(1).map(e => ({
    id: e.id, name: e.name, status: e.status, created_at: e.created_at,
  }))

  const { data: members } = await supabase
    .from('group_members')
    .select('id, current_stop_index, contacts(id, first_name, last_name, phone, has_signed_waiver, waiver_sms_sent_at, waiver_sms_count)')
    .eq('group_id', id)

  let orders = []
  let ticketTypes = []
  let orderItems = []
  let routeLogStats = { total: 0, logged: 0 }
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

    const { data: rsl } = await supabase
      .from('route_stop_logs')
      .select('actual_arrival_at')
      .eq('event_id', event.id)
    if (Array.isArray(rsl)) {
      routeLogStats = {
        total: rsl.length,
        logged: rsl.filter(r => r.actual_arrival_at).length,
      }
    }
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
        extraEvents={extraEvents}
        ticketTypes={ticketTypes}
        members={members || []}
        orders={orders}
        orderItems={orderItems}
        waiverSigs={waiverSigs}
        canEdit={true}
        basePath="/leadership/loops"
      />

      {event?.id && (
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px 14px' }}>
          <RouteLogPanel
            eventId={event.id}
            groupId={group.id}
            stats={routeLogStats}
            scheduleHasStops={Array.isArray(group.schedule) && group.schedule.length > 0}
            action={generateRouteStopsAction.bind(null, event.id, group.id)}
          />
        </div>
      )}

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

function RouteLogPanel({ eventId, groupId, stats, scheduleHasStops, action }) {
  const has = stats.total > 0
  return (
    <div style={{
      background: '#121216',
      border: '1px solid #2a2a31',
      borderRadius: 8,
      padding: '16px 18px',
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 14,
    }}>
      <div style={{ flex: '1 1 220px' }}>
        <div style={{ color: '#9c9ca3', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Route log
        </div>
        <div style={{ color: '#e8e8ea', fontSize: 15, fontWeight: 600, marginTop: 4 }}>
          {has ? `${stats.logged} / ${stats.total} stops logged` : 'Not generated'}
        </div>
        <div style={{ color: '#6f6f76', fontSize: 12, marginTop: 4 }}>
          {scheduleHasStops
            ? 'Generates 25 slots (5 bars × 5 cycles) from the schedule. Re-running keeps driver-filled rows.'
            : 'Add a schedule to this Loop first, then generate.'}
        </div>
      </div>
      <form action={action} style={{ display: 'flex', gap: 8 }}>
        <button
          type="submit"
          disabled={!scheduleHasStops}
          style={{
            background: scheduleHasStops ? '#d4a333' : '#2a2a31',
            color: scheduleHasStops ? '#0a0a0b' : '#6f6f76',
            fontSize: 13,
            fontWeight: 600,
            padding: '8px 14px',
            borderRadius: 6,
            border: 'none',
            cursor: scheduleHasStops ? 'pointer' : 'not-allowed',
          }}
        >
          {has ? 'Regenerate' : 'Generate route log'}
        </button>
        {has && (
          <a
            href={`/leadership/drivers/route-log/${eventId}`}
            style={{
              background: 'transparent',
              color: '#e8e8ea',
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 14px',
              borderRadius: 6,
              border: '1px solid #2a2a31',
              textDecoration: 'none',
            }}
          >
            View →
          </a>
        )}
      </form>
    </div>
  )
}
