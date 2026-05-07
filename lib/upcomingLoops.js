import { supabaseAdmin } from './supabaseAdmin'
import { lookupBarsByNames } from './barsServer'

// Returns the list of upcoming rider-visible loops.
//
// Public /events should ONLY show events that the admin has explicitly put
// on sale (events.status = 'on_sale'). Anything in draft or orphan group
// rows stay admin-only, so admin can stage future dates without leaking
// them to riders.
//
// stops is the per-event pickup-bar list, derived from active ticket_types
// (each ticket type IS a pickup bar). Order follows ticket_types.sort_order;
// startTime is pulled from groups.schedule[stop_index] when available.
// Each entry: { name, slug, startTime }. slug is null when the ticket-type
// name doesn't match a known partner bar.
//
//   { kind: 'event', id, groupId, name, eventDate, pickupTime, coverImageUrl, fromPriceCents, stops }
export async function getUpcomingLoops({ limit = 12 } = {}) {
  let sb
  try {
    sb = supabaseAdmin()
  } catch (err) {
    console.error('[upcomingLoops] supabaseAdmin init failed', err)
    return []
  }
  const today = new Date().toISOString().slice(0, 10)

  let eventsRes
  try {
    eventsRes = await sb
      .from('events')
      .select('id, group_id, name, event_date, pickup_time, cover_image_url, status, ticket_types(name, price_cents, active, stop_index, sort_order), groups(schedule)')
      .eq('status', 'on_sale')
      .gte('event_date', today)
      .order('event_date', { ascending: true })
  } catch (err) {
    console.error('[upcomingLoops] queries threw', err)
    return []
  }

  if (eventsRes?.error) console.error('[upcomingLoops] events error', eventsRes.error)

  const events = eventsRes?.data || []

  // Strip "pickup" / parenthetical suffixes etc from ticket-type names so
  // "The Angry Ginger pickup" displays as "The Angry Ginger" on chips.
  const cleanBarName = raw => String(raw || '')
    .replace(/\s*[—–-]\s*\$?\d.*$/i, '')          // trim "— $20" tails
    .replace(/\s*\(.*?\)\s*/g, ' ')                // drop parentheticals
    .replace(/\s+pick[\s-]?up\s*$/i, '')           // drop trailing "pickup"
    .replace(/\s+stop\s*$/i, '')                   // drop trailing "stop"
    .replace(/\s+/g, ' ')
    .trim()

  // One bar lookup for every distinct ticket-type name across all upcoming
  // events, so chips can resolve to a known partner bar slug.
  const allNames = new Set()
  for (const e of events) {
    const types = Array.isArray(e.ticket_types) ? e.ticket_types : []
    for (const t of types) {
      if (!t?.active) continue
      const cleaned = cleanBarName(t.name)
      if (cleaned) allNames.add(cleaned)
    }
  }
  let barLookup = new Map()
  if (allNames.size) {
    try {
      barLookup = await lookupBarsByNames(sb, [...allNames])
    } catch (err) {
      console.error('[upcomingLoops] bar lookup failed', err)
    }
  }

  return events
    .map(e => {
      const activeTypes = (e.ticket_types || []).filter(t => t.active)
      const prices = activeTypes
        .map(t => t.price_cents)
        .sort((a, b) => a - b)
      const sched = Array.isArray(e.groups?.schedule) ? e.groups.schedule : []
      const stops = activeTypes
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(t => {
          const cleaned = cleanBarName(t.name)
          const sIdx = Number.isFinite(t.stop_index) ? t.stop_index : null
          return {
            name: cleaned || t.name,
            slug: cleaned ? barLookup.get(cleaned)?.slug ?? null : null,
            startTime: sIdx != null ? sched[sIdx]?.start_time || null : null,
          }
        })
        .filter(s => s.name)
      return {
        kind: 'event',
        id: e.id,
        groupId: e.group_id,
        name: e.name,
        eventDate: e.event_date,
        pickupTime: e.pickup_time,
        coverImageUrl: e.cover_image_url,
        fromPriceCents: prices[0] ?? null,
        stops,
      }
    })
    .sort((a, b) => (a.eventDate || '').localeCompare(b.eventDate || ''))
    .slice(0, limit)
}
