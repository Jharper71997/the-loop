// The Loop — buy a ride. Loads the active Marines loop, its two fares
// (Single Ride $10 / Day Pass $20) and the red-line stops, then hands off to
// BuyClient. The actual gate (must be verified) is enforced server-side in
// /api/checkout; BuyClient soft-checks first so the rider isn't surprised.

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getActiveMarinesLoop } from '@/lib/marinesLoop'
import BuyClient from './BuyClient'
import { C, card, eyebrow, ghostCta } from '../../_theme'

export const metadata = {
  title: 'Get a ride',
  description: 'Buy a single ride or a day pass on The Loop.',
  alternates: { canonical: '/marines/buy' },
}
export const dynamic = 'force-dynamic'

export default async function BuyPage() {
  let loop = null
  try { loop = await getActiveMarinesLoop() } catch {}

  const onSale = loop && loop.eventId && loop.eventStatus === 'on_sale'

  let ticketTypes = []
  if (onSale) {
    try {
      const sb = supabaseAdmin()
      const { data } = await sb
        .from('ticket_types')
        .select('id, name, price_cents, stop_index, sort_order, active')
        .eq('event_id', loop.eventId)
        .eq('active', true)
        .order('price_cents', { ascending: true })
      ticketTypes = (data || []).map(t => ({ id: t.id, name: t.name, price_cents: t.price_cents }))
    } catch {}
  }

  if (!onSale || !ticketTypes.length) {
    return (
      <main style={{ padding: '16px 14px 28px' }}>
        <div style={{ maxWidth: 460, margin: '0 auto', display: 'grid', gap: 14 }}>
          <div>
            <div style={eyebrow}>The Loop</div>
            <h1 style={{ color: C.INK, fontSize: 26, fontWeight: 800, margin: '8px 0 6px', letterSpacing: '-0.01em' }}>No rides on sale yet</h1>
            <p style={{ color: C.INK_DIM, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
              This weekend{"'"}s red line isn{"'"}t open for booking yet. Verify your ID now so you{"'"}re ready, and check the live map when the shuttle is rolling.
            </p>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <a href="/marines/verify" style={{ ...ghostCta, display: 'block', textAlign: 'center' }}>Verify to ride</a>
            <a href="/marines/track" style={{ ...ghostCta, display: 'block', textAlign: 'center' }}>See it live</a>
          </div>
        </div>
      </main>
    )
  }

  // Stops the rider can board at — exclude any without a usable name.
  const stops = (loop.stops || []).map(s => ({
    index: s.index,
    name: s.name,
    onBase: !!s.onBase,
    startTime: s.startTime || null,
  }))

  return (
    <main style={{ padding: '16px 14px 28px' }}>
      <div style={{ maxWidth: 460, margin: '0 auto', display: 'grid', gap: 14 }}>
        <div>
          <div style={eyebrow}>The Loop · {loop.name}</div>
          <h1 style={{ color: C.INK, fontSize: 26, fontWeight: 800, margin: '8px 0 6px', letterSpacing: '-0.01em' }}>Get a ride</h1>
          <p style={{ color: C.INK_DIM, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            Pick a single ride or a day pass, choose where you{"'"}re boarding, and you{"'"}re set. Have your ID ready at the door.
          </p>
        </div>

        <BuyClient eventId={loop.eventId} ticketTypes={ticketTypes} stops={stops} />

        <a href="/marines" style={{ ...ghostCta, display: 'block', textAlign: 'center' }}>Back to The Loop</a>
      </div>
    </main>
  )
}
