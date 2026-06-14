import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getCurrentWaiverVersion } from '@/lib/waiver'
import BookingForm from './BookingForm'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }) {
  // generateMetadata throwing crashes the entire route to a 500 before the
  // page render has a chance to recover, so swallow everything here. The
  // page-level handler will deal with any real lookup failure.
  try {
    const { eventId } = await params
    const supabase = supabaseAdmin()
    const { data: event } = await supabase
      .from('events')
      .select('name, event_date')
      .eq('id', eventId)
      .maybeSingle()
    return {
      title: event ? `Book ${event.name}` : 'Book',
    }
  } catch (err) {
    console.error('[book/eventId] generateMetadata threw', err)
    return { title: 'Book' }
  }
}

export default async function EventBookingPage({ params }) {
  const { eventId } = await params

  let supabase
  try {
    supabase = supabaseAdmin()
  } catch (err) {
    console.error('[book/eventId] supabaseAdmin init failed', err)
    notFound()
  }

  let event = null
  let eventErr = null
  try {
    const r = await supabase
      .from('events')
      .select('id, name, event_date, pickup_time, description, status, cover_image_url, group_id')
      .eq('id', eventId)
      .maybeSingle()
    event = r.data
    eventErr = r.error
  } catch (err) {
    console.error('[book/eventId] event lookup threw', err)
  }
  if (eventErr) console.error('[book/eventId] event lookup error', eventErr)
  if (!event || event.status !== 'on_sale') notFound()

  // Pull the linked group's schedule so each ticket type can display the
  // bar's actual pickup time at checkout (e.g. "Shirley V's — 7:45 PM — $20").
  // stop_index on the ticket type indexes into schedule[i].start_time.
  let schedule = []
  if (event.group_id) {
    try {
      const r = await supabase
        .from('groups')
        .select('schedule')
        .eq('id', event.group_id)
        .maybeSingle()
      schedule = Array.isArray(r.data?.schedule) ? r.data.schedule : []
    } catch (err) {
      console.error('[book/eventId] schedule lookup threw', err)
    }
  }

  // The night's bars, for the walk-on pickup picker. Index is the position in
  // the schedule (same space ticket_type.stop_index points into), preserved
  // across the name filter so a chosen index still maps to the right bar.
  const stops = schedule
    .map((s, i) => ({ index: i, name: s?.name || null, start_time: s?.start_time || null }))
    .filter(s => s.name)

  let ticketTypes = []
  try {
    const r = await supabase
      .from('ticket_types')
      .select('id, name, price_cents, capacity, stop_index, sort_order')
      .eq('event_id', eventId)
      .eq('active', true)
      .order('sort_order', { ascending: true })
    if (r.error) console.error('[book/eventId] ticket_types error', r.error)
    ticketTypes = (r.data || []).map(t => {
      const stop = Number.isFinite(t.stop_index) ? schedule[t.stop_index] : null
      return { ...t, pickup_time: stop?.start_time || null }
    })
  } catch (err) {
    console.error('[book/eventId] ticket_types threw', err)
  }

  // Compute remaining seats per ticket type, counting BOTH native Loop sales
  // and Ticket Tailor-mirrored sales at the same (event_id, stop_index). Mirrors
  // the server-side capacity check in api/checkout/route.js so what the rider
  // sees on the page matches what the API would let them buy.
  const pendingCutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  ticketTypes = await Promise.all(
    ticketTypes.map(async t => {
      if (t.capacity == null) return { ...t, remaining: null }
      try {
        const baseSelect = 'id, orders!inner(id, event_id, status, created_at)'
        let paidQuery = supabase
          .from('order_items')
          .select(baseSelect, { count: 'exact', head: true })
          .eq('orders.event_id', eventId)
          .is('voided_at', null)
          .eq('orders.status', 'paid')
        let pendingQuery = supabase
          .from('order_items')
          .select(baseSelect, { count: 'exact', head: true })
          .eq('orders.event_id', eventId)
          .is('voided_at', null)
          .eq('orders.status', 'pending')
          .gte('orders.created_at', pendingCutoff)
        if (t.stop_index != null) {
          paidQuery = paidQuery.eq('stop_index', t.stop_index)
          pendingQuery = pendingQuery.eq('stop_index', t.stop_index)
        } else {
          paidQuery = paidQuery.eq('ticket_type_id', t.id)
          pendingQuery = pendingQuery.eq('ticket_type_id', t.id)
        }
        const [{ count: paidCount }, { count: pendingCount }] = await Promise.all([paidQuery, pendingQuery])
        const taken = (paidCount || 0) + (pendingCount || 0)
        return { ...t, remaining: Math.max(0, t.capacity - taken) }
      } catch (err) {
        console.error('[book/eventId] remaining count failed', t.id, err)
        return { ...t, remaining: null }
      }
    }),
  )

  // Active add-ons offered at checkout (global ones + any scoped to this event).
  let addons = []
  try {
    const r = await supabase
      .from('addons')
      .select('id, name, description, price_cents, kind, sort_order')
      .eq('active', true)
      .or(`event_id.is.null,event_id.eq.${eventId}`)
      .order('sort_order', { ascending: true })
    if (r.error) console.error('[book/eventId] addons error', r.error)
    addons = r.data || []
  } catch (err) {
    console.error('[book/eventId] addons threw', err)
  }

  let waiver = null
  try {
    waiver = await getCurrentWaiverVersion(supabase)
  } catch (err) {
    console.error('[book/eventId] waiver lookup threw', err)
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#fff',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    }}>
      <header style={{
        padding: '12px 16px',
        borderBottom: '2px solid #d4a333',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <a href="/book" style={{ color: '#d4a333', textDecoration: 'none', fontSize: 13 }}>← All loops</a>
        <span style={{ color: '#d4a333', fontSize: 14, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Jville Brew Loop
        </span>
        <span style={{ width: 70 }} />
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '20px 16px' }}>
        {event.cover_image_url && (
          <div style={{
            position: 'relative',
            aspectRatio: '16/9',
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 16,
            border: '1px solid rgba(255,255,255,0.08)',
            background: `url(${event.cover_image_url}) center/cover`,
          }} />
        )}
        <div style={{ color: '#d4a333', fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {formatDate(event.event_date)}{event.pickup_time ? ` · ${formatTime(event.pickup_time)}` : ''}
        </div>
        <h1 style={{ fontSize: 26, margin: '4px 0 8px' }}>{event.name}</h1>
        {event.description && (
          <p style={{ color: '#bbb', fontSize: 14, margin: '0 0 18px' }}>{event.description}</p>
        )}

        <BookingForm
          eventId={event.id}
          eventName={event.name}
          ticketTypes={ticketTypes || []}
          addons={addons}
          stops={stops}
          waiver={waiver}
        />
      </div>
    </main>
  )
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
  const [h, m] = String(hhmm).split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}
