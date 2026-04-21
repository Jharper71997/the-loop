import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import EventForm from '../EventForm'
import SmsBroadcast from '../../components/SmsBroadcast'
import SmsButton from '../../components/SmsButton'
import WaiversPanel from './WaiversPanel'

export const dynamic = 'force-dynamic'

const ACCENT = '#d4a333'
const SURFACE = '#15151a'
const BORDER = '#2a2a31'

export default async function ManageLoopPage({ params }) {
  const { id } = await params
  const supabase = supabaseAdmin()

  const { data: group } = await supabase
    .from('groups')
    .select('id, name, event_date, pickup_time, schedule')
    .eq('id', id)
    .maybeSingle()
  if (!group) notFound()

  const [{ data: event }, { data: orders }, { data: members }] = await Promise.all([
    supabase
      .from('events')
      .select('id, name, event_date, pickup_time, description, capacity, status, group_id')
      .eq('group_id', id)
      .maybeSingle(),
    supabase
      .from('orders')
      .select('id, buyer_name, buyer_phone, total_cents, status, party_size, created_at, paid_at, contact_id')
      .eq('event_id', null)
      .limit(0), // placeholder; we'll re-query below if event exists
    supabase
      .from('group_members')
      .select('id, current_stop_index, contacts(id, first_name, last_name, phone, has_signed_waiver, waiver_sms_sent_at, waiver_sms_count)')
      .eq('group_id', id),
  ])

  let realOrders = []
  let ticketTypes = []
  if (event?.id) {
    const [oRes, ttRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, buyer_name, buyer_phone, total_cents, status, party_size, created_at, paid_at, contact_id')
        .eq('event_id', event.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('ticket_types')
        .select('id, name, price_cents, stop_index, capacity, active, sort_order')
        .eq('event_id', event.id)
        .order('sort_order', { ascending: true }),
    ])
    realOrders = oRes.data || []
    ticketTypes = ttRes.data || []
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
  const sigByContact = new Map()
  for (const s of waiverSigs) if (!sigByContact.has(s.contact_id)) sigByContact.set(s.contact_id, s)

  const paidOrders = realOrders.filter(o => o.status === 'paid')
  const revenue = paidOrders.reduce((s, o) => s + (o.total_cents || 0), 0)
  const ticketsSold = paidOrders.reduce((s, o) => s + (o.party_size || 0), 0)
  const waiverCount = (members || []).filter(m => m.contacts?.has_signed_waiver).length

  return (
    <main style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 16px', minHeight: '100vh', color: '#fff' }}>
      <a href="/groups" style={{ color: ACCENT, fontSize: 13, textDecoration: 'none' }}>← All Loops</a>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>{group.name}</h1>
        {event && (
          <a href={`/book/${event.id}`} target="_blank" rel="noreferrer" style={ghostBtn}>Public booking page →</a>
        )}
      </div>
      <p style={{ color: '#9c9ca3', fontSize: 13, margin: '4px 0 16px' }}>
        {group.event_date}{group.pickup_time ? ` · ${group.pickup_time}` : ''}
        {event ? ` · ${event.status}` : ' · no sales event linked'}
      </p>

      <Stats3>
        <Stat label="Tickets sold" value={ticketsSold} />
        <Stat label="Revenue" value={`$${(revenue / 100).toFixed(2)}`} />
        <Stat label="Waivers signed" value={`${waiverCount} / ${members?.length || 0}`} />
      </Stats3>

      {(members || []).length > 0 && (
        <WaiversPanel
          groupId={group.id}
          members={(members || []).map(m => ({
            id: m.contacts?.id,
            first_name: m.contacts?.first_name || '',
            last_name: m.contacts?.last_name || '',
            phone: m.contacts?.phone || null,
            has_signed_waiver: !!m.contacts?.has_signed_waiver,
            waiver_sms_sent_at: m.contacts?.waiver_sms_sent_at || null,
          }))}
        />
      )}

      {(members || []).length > 0 && (
        <div style={{ marginTop: 8 }}>
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

      {!event && (
        <Section title="Sales not enabled">
          <p style={{ color: '#9c9ca3', fontSize: 13, margin: 0 }}>
            This Loop has no sales event yet. To sell tickets through The Loop, create one with the form below.
          </p>
          <EventForm mode="create" />
        </Section>
      )}

      {event && (
        <Section title="Edit Loop & ticket types">
          <EventForm mode="edit" initialEvent={event} initialTicketTypes={ticketTypes} />
        </Section>
      )}

      <Section title={`Riders (${members?.length || 0})`}>
        {(members || []).length === 0 && <Empty>No riders yet.</Empty>}
        <div style={{ display: 'grid', gap: 6 }}>
          {(members || []).map(m => {
            const c = m.contacts || {}
            const sig = sigByContact.get(c.id)
            return (
              <div key={m.id} style={listRow}>
                <div>
                  <strong>{c.first_name} {c.last_name}</strong>
                  {c.phone && <span style={{ color: '#9c9ca3', fontSize: 12, marginLeft: 6 }}>{c.phone}</span>}
                  <div style={{ fontSize: 11, color: '#9c9ca3' }}>
                    Stop {m.current_stop_index != null ? m.current_stop_index + 1 : '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11 }}>
                    {sig ? (
                      <span style={{ color: '#10b981' }}>✓ waiver v{sig.waiver_versions?.version}</span>
                    ) : (
                      <span style={{ color: '#facc15' }}>waiver not signed</span>
                    )}
                  </span>
                  <SmsButton contact={c} />
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title={`Orders (${realOrders.length})`}>
        {realOrders.length === 0 && <Empty>No native orders yet.</Empty>}
        <div style={{ display: 'grid', gap: 6 }}>
          {realOrders.map(o => (
            <div key={o.id} style={listRow}>
              <div>
                <strong>{o.buyer_name || '(no name)'}</strong>
                {o.buyer_phone && <span style={{ color: '#9c9ca3', fontSize: 12, marginLeft: 6 }}>{o.buyer_phone}</span>}
                <div style={{ fontSize: 11, color: '#9c9ca3' }}>
                  {o.party_size} ticket{o.party_size === 1 ? '' : 's'} · {new Date(o.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: ACCENT, fontWeight: 700 }}>${(o.total_cents / 100).toFixed(2)}</div>
                <div style={{ fontSize: 11, color: '#9c9ca3' }}>{o.status}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title={`Waivers (${waiverSigs.length})`}>
        {waiverSigs.length === 0 && <Empty>No signatures yet.</Empty>}
        <div style={{ display: 'grid', gap: 6 }}>
          {waiverSigs.map(s => {
            const member = (members || []).find(m => m.contacts?.id === s.contact_id)
            const c = member?.contacts || {}
            return (
              <div key={s.contact_id} style={listRow}>
                <div>
                  <strong>{c.first_name} {c.last_name}</strong>
                  <div style={{ fontSize: 11, color: '#9c9ca3' }}>v{s.waiver_versions?.version} · {new Date(s.signed_at).toLocaleString()}</div>
                </div>
                <div style={{ fontSize: 12, color: ACCENT }}>{s.full_name_typed}</div>
              </div>
            )
          })}
        </div>
      </Section>
    </main>
  )
}

function Section({ title, children }) {
  return (
    <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, display: 'grid', gap: 10, marginTop: 14 }}>
      <h2 style={{ fontSize: 12, color: ACCENT, margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</h2>
      {children}
    </section>
  )
}
function Stats3({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, margin: '0 0 8px' }}>{children}</div>
}
function Stat({ label, value }) {
  return (
    <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 11, color: '#9c9ca3', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: ACCENT, marginTop: 2 }}>{value}</div>
    </div>
  )
}
function Empty({ children }) {
  return <div style={{ color: '#9c9ca3', fontSize: 13 }}>{children}</div>
}
const listRow = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: 10, background: '#0e0e12', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13,
}
const ghostBtn = {
  background: 'transparent', border: `1px solid ${ACCENT}`, color: ACCENT,
  padding: '6px 12px', borderRadius: 8, fontSize: 13, textDecoration: 'none',
}
