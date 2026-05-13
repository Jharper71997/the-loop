// Capacity audit: for every future on_sale event, count paid + pending
// non-voided order_items at every (event_id, stop_index), split by source
// (native Loop vs Ticket Tailor mirror), and flag any stop that has already
// hit or exceeded its physical 13-seat cap.
//
// Also flags configuration drift:
//   - ticket_types with capacity NULL (uncapped — sale-blocking gap)
//   - ticket_types with capacity != 13 (admin forgot to set the physical cap)
//
// Optionally hits the TT API (if TICKET_TAILOR_API_KEY is set) to pull each
// linked TT event's ticket type quantity_total, so we can surface TT-side
// inventory that exceeds 13 alone.
//
// Usage:
//   set -a && source /c/Users/jacob/.env && set +a
//   node scripts/audit-capacity.js
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY (or
// SUPABASE_SERVICE_ROLE_KEY). TICKET_TAILOR_API_KEY is optional.

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const PHYSICAL_CAP = 13
const PENDING_WINDOW_MIN = 15
const TT_BASE = 'https://api.tickettailor.com/v1'

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_KEY in env')
  }
  return createClient(url, key, { auth: { persistSession: false } })
}

function ttAuth() {
  const apiKey = process.env.TICKET_TAILOR_API_KEY
  if (!apiKey) return null
  return 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64')
}

async function ttGet(p) {
  const auth = ttAuth()
  if (!auth) return null
  const res = await fetch(`${TT_BASE}${p}`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  })
  if (!res.ok) return null
  return res.json()
}

async function fetchFutureEvents(sb) {
  const today = new Date().toISOString().slice(0, 10)
  const { data, error } = await sb
    .from('events')
    .select('id, name, event_date, pickup_time, status, group_id')
    .gte('event_date', today)
    .eq('status', 'on_sale')
    .order('event_date', { ascending: true })
  if (error) throw new Error(`events: ${error.message}`)
  return data || []
}

async function fetchTicketTypes(sb, eventId) {
  const { data, error } = await sb
    .from('ticket_types')
    .select('id, name, price_cents, capacity, stop_index, active, sort_order')
    .eq('event_id', eventId)
    .order('sort_order', { ascending: true })
  if (error) throw new Error(`ticket_types(${eventId}): ${error.message}`)
  return data || []
}

async function fetchGroupTt(sb, groupId) {
  if (!groupId) return null
  const { data } = await sb
    .from('groups')
    .select('id, tt_event_id, schedule')
    .eq('id', groupId)
    .maybeSingle()
  return data || null
}

async function countItemsForStop(sb, { eventId, stopIndex, ticketTypeId }) {
  // Returns { paidNative, paidTt, pendingNative, pendingTt }. Pending only
  // counts items whose order was created within the last 15 minutes — older
  // pendings are treated as abandoned by the checkout path itself.
  const pendingCutoff = new Date(Date.now() - PENDING_WINDOW_MIN * 60 * 1000).toISOString()

  async function countOne({ status, useCutoff, ttSource }) {
    let q = sb
      .from('order_items')
      .select('id, tt_ticket_id, orders!inner(id, event_id, status, created_at)', { count: 'exact', head: true })
      .eq('orders.event_id', eventId)
      .is('voided_at', null)
      .eq('orders.status', status)
    if (useCutoff) q = q.gte('orders.created_at', pendingCutoff)
    if (stopIndex != null) q = q.eq('stop_index', stopIndex)
    else q = q.eq('ticket_type_id', ticketTypeId)
    if (ttSource === 'tt') q = q.not('tt_ticket_id', 'is', null)
    if (ttSource === 'native') q = q.is('tt_ticket_id', null)
    const { count, error } = await q
    if (error) throw new Error(`count(${status},${ttSource}): ${error.message}`)
    return count || 0
  }

  const [paidNative, paidTt, pendingNative, pendingTt] = await Promise.all([
    countOne({ status: 'paid', useCutoff: false, ttSource: 'native' }),
    countOne({ status: 'paid', useCutoff: false, ttSource: 'tt' }),
    countOne({ status: 'pending', useCutoff: true, ttSource: 'native' }),
    countOne({ status: 'pending', useCutoff: true, ttSource: 'tt' }),
  ])
  return { paidNative, paidTt, pendingNative, pendingTt }
}

function flagsFor({ capacity, taken }) {
  const flags = []
  if (capacity == null) flags.push('NO_CAPACITY_SET')
  else if (capacity !== PHYSICAL_CAP) flags.push(`CAPACITY_NOT_${PHYSICAL_CAP}`)
  if (capacity != null && taken > capacity) flags.push('OVERSOLD')
  else if (capacity != null && taken === capacity) flags.push('SOLD_OUT')
  return flags
}

function pad(s, n) {
  s = String(s ?? '')
  if (s.length >= n) return s.slice(0, n)
  return s + ' '.repeat(n - s.length)
}

function padNum(n, w) {
  return String(n ?? 0).padStart(w, ' ')
}

async function main() {
  const sb = supabase()
  const events = await fetchFutureEvents(sb)
  if (!events.length) {
    console.log('No future on_sale events found.')
    return
  }

  const rows = []
  const headerCols = ['DATE', 'EVENT', 'STOP', 'TICKET', 'CAP', 'NATIVE', 'TT', 'PEND', 'TOTAL', 'FLAGS']
  console.log(
    pad(headerCols[0], 12) +
      pad(headerCols[1], 24) +
      pad(headerCols[2], 6) +
      pad(headerCols[3], 24) +
      pad(headerCols[4], 5) +
      pad(headerCols[5], 7) +
      pad(headerCols[6], 5) +
      pad(headerCols[7], 6) +
      pad(headerCols[8], 7) +
      headerCols[9],
  )
  console.log('-'.repeat(110))

  for (const ev of events) {
    const ticketTypes = await fetchTicketTypes(sb, ev.id)
    const group = await fetchGroupTt(sb, ev.group_id)

    let ttInventory = null
    if (group?.tt_event_id) {
      const ttEvent = await ttGet(`/events/${group.tt_event_id}`)
      if (ttEvent?.ticket_types) {
        ttInventory = ttEvent.ticket_types.map(t => ({
          name: t.name || t.description,
          quantity_total: t.quantity_total,
          quantity_held: t.quantity_held,
          quantity_issued: t.quantity_issued,
        }))
      }
    }

    for (const tt of ticketTypes) {
      const counts = await countItemsForStop(sb, {
        eventId: ev.id,
        stopIndex: tt.stop_index,
        ticketTypeId: tt.id,
      })
      const pending = counts.pendingNative + counts.pendingTt
      const taken = counts.paidNative + counts.paidTt + pending
      const flags = flagsFor({ capacity: tt.capacity, taken })

      rows.push({
        event_id: ev.id,
        event_date: ev.event_date,
        event_name: ev.name,
        stop_index: tt.stop_index,
        ticket_type: tt.name,
        ticket_type_id: tt.id,
        capacity: tt.capacity,
        paid_native: counts.paidNative,
        paid_tt: counts.paidTt,
        pending_native: counts.pendingNative,
        pending_tt: counts.pendingTt,
        taken,
        flags,
        tt_inventory: ttInventory,
      })

      console.log(
        pad(ev.event_date, 12) +
          pad(ev.name, 24) +
          pad(tt.stop_index != null ? `#${tt.stop_index}` : '-', 6) +
          pad(tt.name, 24) +
          padNum(tt.capacity, 5) +
          padNum(counts.paidNative, 7) +
          padNum(counts.paidTt, 5) +
          padNum(pending, 6) +
          padNum(taken, 7) +
          ' ' +
          flags.join(','),
      )
    }
  }

  // TT-side inventory summary: for any future event linked to a TT event,
  // report each TT ticket type's quantity_total. If TT alone allows > 13 on
  // any single stop, that's a TT-side oversell risk independent of Loop.
  if (ttAuth()) {
    console.log('')
    console.log('--- TT-side ticket type inventory (future events) ---')
    const seen = new Set()
    for (const row of rows) {
      if (!row.tt_inventory) continue
      if (seen.has(row.event_id)) continue
      seen.add(row.event_id)
      console.log(`\n${row.event_date}  ${row.event_name}`)
      for (const t of row.tt_inventory) {
        const overTt = Number.isFinite(t.quantity_total) && t.quantity_total > PHYSICAL_CAP
        console.log(`  ${pad(t.name, 30)} total=${padNum(t.quantity_total, 3)} held=${padNum(t.quantity_held, 3)} issued=${padNum(t.quantity_issued, 3)}${overTt ? '  <-- TT_OVER_13' : ''}`)
      }
    }
  } else {
    console.log('\n(Skipping TT inventory pull — set TICKET_TAILOR_API_KEY to include it.)')
  }

  const outDir = 'C:/Users/jacob/OneDrive/Desktop'
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const outPath = path.join(outDir, `capacity-audit-${stamp}.json`)
  try {
    fs.writeFileSync(outPath, JSON.stringify(rows, null, 2))
    console.log(`\nWrote ${rows.length} rows to ${outPath}`)
  } catch (err) {
    console.error(`(Could not write JSON to ${outPath}: ${err.message})`)
  }

  const problems = rows.filter(r => r.flags.length)
  if (problems.length) {
    console.log(`\nProblems found: ${problems.length}`)
    for (const p of problems) {
      console.log(`  ${p.event_date} ${p.event_name} stop=${p.stop_index ?? '-'} ${p.ticket_type}: ${p.flags.join(',')}`)
    }
  } else {
    console.log('\nNo capacity problems found.')
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
