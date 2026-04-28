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
      .select('id, name, event_date, pickup_time, description, status, cover_image_url')
      .eq('id', eventId)
      .maybeSingle()
    event = r.data
    eventErr = r.error
  } catch (err) {
    console.error('[book/eventId] event lookup threw', err)
  }
  if (eventErr) console.error('[book/eventId] event lookup error', eventErr)
  if (!event || event.status !== 'on_sale') notFound()

  let ticketTypes = []
  try {
    const r = await supabase
      .from('ticket_types')
      .select('id, name, price_cents, capacity, stop_index, sort_order')
      .eq('event_id', eventId)
      .eq('active', true)
      .order('sort_order', { ascending: true })
    if (r.error) console.error('[book/eventId] ticket_types error', r.error)
    ticketTypes = r.data || []
  } catch (err) {
    console.error('[book/eventId] ticket_types threw', err)
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
