// Surf City Loop — buy a ride. Loads the active day's ON-SALE surf loops and
// their per-stop fares, then hands off to SurfBuyClient. Native checkout (same
// /api/checkout the Brew Loop uses). NO verification gate — Surf is an open
// bar-hop shuttle (unlike Marines). Multiple loops per day are supported: the
// rider picks which loop, then which stop they're boarding at.

import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSurfLoopsForDay } from '@/lib/surfLoop'
import SurfBuyClient from './SurfBuyClient'
import { C, eyebrow, ghostCta } from '../../_theme'

export const metadata = {
  title: 'Get a ride',
  description: 'Hop on the Surf City Loop. Pick your loop and stop, and ride with friends all weekend.',
  alternates: { canonical: '/surfcity/buy' },
}
export const dynamic = 'force-dynamic'

export default async function SurfBuyPage() {
  let dayLoops = []
  try { dayLoops = await getSurfLoopsForDay() } catch {}

  const onSale = dayLoops.filter(l => l.eventId && l.eventStatus === 'on_sale')

  let loops = []
  if (onSale.length) {
    try {
      const sb = supabaseAdmin()
      const eventIds = onSale.map(l => l.eventId)
      const { data: tts } = await sb
        .from('ticket_types')
        .select('id, event_id, name, price_cents, stop_index, sort_order, active')
        .in('event_id', eventIds)
        .eq('active', true)
        .order('stop_index', { ascending: true })
      const byEvent = new Map()
      for (const t of tts || []) {
        if (!byEvent.has(t.event_id)) byEvent.set(t.event_id, [])
        byEvent.get(t.event_id).push({ id: t.id, name: t.name, price_cents: t.price_cents, stop_index: t.stop_index ?? 0 })
      }
      loops = onSale
        .map(l => ({
          eventId: l.eventId,
          name: l.name,
          pickupTime: l.pickupTime,
          eventDate: l.eventDate,
          ticketTypes: byEvent.get(l.eventId) || [],
        }))
        .filter(l => l.ticketTypes.length)
    } catch {}
  }

  if (!loops.length) {
    return (
      <main style={{ padding: '20px 14px 40px' }}>
        <div style={{ maxWidth: 460, margin: '0 auto', display: 'grid', gap: 14 }}>
          <div>
            <div style={eyebrow}>Surf City Loop</div>
            <h1 style={{ color: C.INK, fontSize: 28, fontWeight: 800, margin: '10px 0 6px', lineHeight: 1.08 }}>No rides on sale yet</h1>
            <p style={{ color: C.INK_DIM, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
              This weekend{"'"}s loops aren{"'"}t open for booking yet. Check back soon, or watch the shuttle live once it{"'"}s rolling.
            </p>
          </div>
          <a href="/surfcity/track" style={{ ...ghostCta, display: 'block', textAlign: 'center' }}>See it live</a>
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding: '20px 14px 40px' }}>
      <div style={{ maxWidth: 460, margin: '0 auto', display: 'grid', gap: 14 }}>
        <div>
          <div style={eyebrow}>Surf City Loop</div>
          <h1 style={{ color: C.INK, fontSize: 28, fontWeight: 800, margin: '10px 0 6px', lineHeight: 1.08 }}>Get a ride</h1>
          <p style={{ color: C.INK_DIM, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            Pick your loop, choose where you{"'"}re hopping on, and ride with friends. One ride, every stop.
          </p>
        </div>

        <SurfBuyClient loops={loops} />

        <a href="/surfcity" style={{ ...ghostCta, display: 'block', textAlign: 'center' }}>Back to Surf City Loop</a>
      </div>
    </main>
  )
}
