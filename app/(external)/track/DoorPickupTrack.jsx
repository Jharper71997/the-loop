import { brandFor } from '@/lib/businessConfig'

// /track?event=<door pickup event>: the Oktoberfest ride. It is not a bar
// loop, so there is no route, no bar list and no live map (the pickup bus
// does not report under its own event, so any map here could show the Brew
// Loop bus instead). What a rider needs is when, how, and where to.

const GOLD = '#d4a333'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const SURFACE = '#15151a'
const LINE = 'rgba(255,255,255,0.08)'

const DROP = {
  name: 'Jacksonville Oktoberfest',
  place: 'Downtown Jacksonville, Riverwalk Crossing Park',
  maps: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Riverwalk Crossing Park, Jacksonville, NC'),
}

export default function DoorPickupTrack({ event, zones = [] }) {
  const cfg = brandFor('brew')
  return (
    <main style={{ padding: '12px 12px 28px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', display: 'grid', gap: 14 }}>
        <header style={{ padding: '4px 4px 0' }}>
          <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
            Oktoberfest ride
          </div>
          <h1 style={{ color: INK, fontSize: 22, fontWeight: 800, margin: '4px 0 0', lineHeight: 1.15 }}>
            {event.name}
          </h1>
          <div style={{ color: INK_DIM, fontSize: 13, marginTop: 2 }}>{formatDate(event.event_date)}</div>
        </header>

        <Card label="How pickup works">
          <ul style={{ margin: 0, padding: '0 0 0 18px', color: INK, fontSize: 15, lineHeight: 1.6 }}>
            <li><strong>We pick you up at your address sometime within your hour</strong>, not exactly on the hour.</li>
            <li><strong>Your driver texts you when they are on the way.</strong> Be ready out front with your group.</li>
            <li>Show your QR to the driver when you board. Everyone needs their own.</li>
          </ul>
        </Card>

        <Card label="Where we take you">
          <div style={{ color: INK, fontSize: 16, fontWeight: 700 }}>{DROP.name}</div>
          <div style={{ color: INK_DIM, fontSize: 14, margin: '2px 0 10px' }}>{DROP.place}</div>
          <a href={DROP.maps} style={{ color: GOLD, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Open in Maps &rarr;</a>
        </Card>

        {zones.length > 0 && (
          <Card label="Pickup hours">
            <div style={{ display: 'grid', gap: 10 }}>
              {zones.map(z => (
                <div key={z.zone}>
                  <div style={{ color: INK, fontSize: 14, fontWeight: 700 }}>Zone {z.zone}{z.label ? ` · ${z.label}` : ''}</div>
                  <div style={{ color: INK_DIM, fontSize: 14 }}>{z.hours.join(', ')}</div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <p style={{ color: INK_DIM, fontSize: 14, textAlign: 'center', margin: '4px 0 0' }}>
          Questions? Text <a href={`sms:${cfg.contactPhone}`} style={{ color: GOLD, textDecoration: 'none', fontWeight: 700 }}>{cfg.contactPhoneDisplay}</a>
        </p>
      </div>
    </main>
  )
}

function Card({ label, children }) {
  return (
    <section style={{ background: SURFACE, border: `1px solid ${LINE}`, borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>
        {label}
      </div>
      {children}
    </section>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(`${iso}T12:00:00-05:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
