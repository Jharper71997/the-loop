// Surf City Loop door list. Code-gated (Surf admin). Server-rendered roster of
// paid riders for each of today's loops, grouped by boarding stop, so the door
// can eyeball who's coming. Refresh to update. (A live QR scanner is a planned
// follow-up; the roster API at /api/surf-security/roster backs it.)

import { isSurfAdmin } from '@/lib/surfAdmin'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getSurfLoopsForDay } from '@/lib/surfLoop'
import { C, card, eyebrow } from '../../_theme'
import SurfAdminGate from '../admin/SurfAdminGate'

export const dynamic = 'force-dynamic'

function riderName(i) {
  return [i.rider_first_name, i.rider_last_name].filter(Boolean).join(' ') || '(rider)'
}

export default async function SurfDoorPage() {
  if (!(await isSurfAdmin())) return <SurfAdminGate />

  const loops = (await getSurfLoopsForDay()).filter(l => l.eventId)
  const sb = supabaseAdmin()

  // One query for all of today's loops' paid, non-voided riders.
  const eventIds = loops.map(l => l.eventId)
  let itemsByEvent = new Map()
  if (eventIds.length) {
    const { data: items } = await sb
      .from('order_items')
      .select('rider_first_name, rider_last_name, stop_index, pickup_stop_index, voided_at, orders!inner(event_id, status)')
      .in('orders.event_id', eventIds)
      .eq('orders.status', 'paid')
      .is('voided_at', null)
    for (const it of items || []) {
      const eid = it.orders?.event_id
      if (!eid) continue
      if (!itemsByEvent.has(eid)) itemsByEvent.set(eid, [])
      itemsByEvent.get(eid).push(it)
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '24px 16px 64px', display: 'grid', gap: 18 }}>
      <div>
        <div style={eyebrow}>Surf City · Door</div>
        <h1 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 800, color: C.INK }}>Tonight&apos;s riders</h1>
      </div>

      {loops.length === 0 && <p style={{ color: C.INK_DIM }}>No loops posted for today.</p>}

      {loops.map(l => {
        const items = itemsByEvent.get(l.eventId) || []
        // Group riders by effective boarding stop index.
        const byStop = new Map()
        for (const it of items) {
          const idx = Number.isInteger(it.stop_index) ? it.stop_index
            : (Number.isInteger(it.pickup_stop_index) ? it.pickup_stop_index : -1)
          if (!byStop.has(idx)) byStop.set(idx, [])
          byStop.get(idx).push(it)
        }
        return (
          <section key={l.groupId} style={{ ...card, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontWeight: 800, color: C.INK }}>{l.name}</div>
              <div style={{ fontSize: 12, color: C.INK_DIM }}>{items.length} rider{items.length === 1 ? '' : 's'} · {l.eventStatus}</div>
            </div>
            {items.length === 0 ? (
              <p style={{ color: C.INK_DIM, marginTop: 10, fontSize: 14 }}>No paid riders yet.</p>
            ) : (
              <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                {l.stops.map((s, i) => {
                  const riders = byStop.get(i) || []
                  if (!riders.length) return null
                  return (
                    <div key={i}>
                      <div style={{ fontSize: 12, color: C.GOLD, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                        {i + 1}. {s.name}{s.startTime ? ` · ${s.startTime}` : ''} ({riders.length})
                      </div>
                      <ul style={{ margin: '6px 0 0', padding: '0 0 0 16px', color: C.INK, fontSize: 14, lineHeight: 1.6 }}>
                        {riders.map((r, k) => <li key={k}>{riderName(r)}</li>)}
                      </ul>
                    </div>
                  )
                })}
                {(byStop.get(-1) || []).length > 0 && (
                  <div>
                    <div style={{ fontSize: 12, color: C.WARM, fontWeight: 700, textTransform: 'uppercase' }}>No stop set ({byStop.get(-1).length})</div>
                    <ul style={{ margin: '6px 0 0', padding: '0 0 0 16px', color: C.INK, fontSize: 14, lineHeight: 1.6 }}>
                      {byStop.get(-1).map((r, k) => <li key={k}>{riderName(r)}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>
        )
      })}
    </main>
  )
}
