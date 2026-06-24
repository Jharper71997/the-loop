import QRCode from 'qrcode'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { normalizePhone } from '@/lib/phone'
import { appUrl } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/surf/my-tickets
//   body: { phone }
// Returns the most recent paid + pending orders for any rider whose phone
// matches (buyer_phone OR any order_items.rider_phone), SCOPED TO Surf City
// Loop events only — events.kind = 'surf'. A fork of /api/marines/my-tickets
// with the same response shape: no waiver, no referral, no security chat.
// Boarding-pass links point at /surfcity/tickets/<code>.
//
// Privacy: the response only includes first names, no last names, no emails.
// Rate-limit at the edge with simple in-memory counters per IP (best-effort).

const RATE_LIMIT_PER_MINUTE = 10
const ipHits = new Map()

function rateLimited(ip) {
  if (!ip) return false
  const now = Date.now()
  const bucket = ipHits.get(ip) || []
  const recent = bucket.filter(ts => now - ts < 60_000)
  if (recent.length >= RATE_LIMIT_PER_MINUTE) {
    ipHits.set(ip, recent)
    return true
  }
  recent.push(now)
  ipHits.set(ip, recent)
  return false
}

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || req.headers.get('x-real-ip')
            || null
  if (rateLimited(ip)) {
    return Response.json({ error: 'rate_limited', retry_after_seconds: 60 }, { status: 429 })
  }

  const normPhone = normalizePhone(body?.phone)
  if (!normPhone) return Response.json({ orders: [] })

  const sb = supabaseAdmin()

  // Two queries: orders where the buyer's phone matches, OR orders that have
  // any order_item with this rider phone. Union client-side by id. We join
  // events (incl. kind + the first stop on the route for the pickup spot) and
  // each item's ticket_type so we can label the pass.
  const orderSelect = `
    id, status, buyer_phone, buyer_name, party_size, created_at,
    event:events ( id, name, event_date, pickup_time, kind, group:groups ( id, schedule ) ),
    order_items ( id, rider_first_name, rider_last_name, rider_phone, voided_at, claim_token, claimed_at, ticket_type:ticket_types ( name ) )
  `
  const [{ data: byBuyer }, { data: byRider }] = await Promise.all([
    sb.from('orders')
      .select(orderSelect)
      .eq('buyer_phone', normPhone)
      .in('status', ['paid', 'pending'])
      .order('created_at', { ascending: false })
      .limit(20),
    sb.from('order_items')
      .select('order_id')
      .eq('rider_phone', normPhone)
      .is('voided_at', null)
      .limit(40),
  ])

  const orderIds = new Set((byBuyer || []).map(o => o.id))
  const extraIds = (byRider || []).map(r => r.order_id).filter(id => !orderIds.has(id))

  let extraOrders = []
  if (extraIds.length) {
    const { data } = await sb
      .from('orders')
      .select(orderSelect)
      .in('id', extraIds)
      .in('status', ['paid', 'pending'])
    extraOrders = data || []
  }

  // Key difference from Brew: scope to Surf City Loop events only. Drop any
  // order whose event isn't a surf event so Brew/Marines passes never surface
  // here.
  const all = [...(byBuyer || []), ...extraOrders]
    .filter(o => o.event?.kind === 'surf')
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

  // One per-rider QR-code lookup so we can deep-link each rider to their
  // boarding pass at /surfcity/tickets/<code>. Pending orders won't have any
  // (QRs are minted after the Stripe webhook fires).
  const activeItemIds = all.flatMap(o =>
    (o.order_items || []).filter(i => !i.voided_at).map(i => i.id)
  )
  const codeByItem = {}
  if (activeItemIds.length) {
    const { data: qrs } = await sb
      .from('qr_codes')
      .select('order_item_id, code')
      .eq('kind', 'checkin')
      .in('order_item_id', activeItemIds)
    for (const q of qrs || []) codeByItem[q.order_item_id] = q.code
  }

  // Server-render each QR as a data URL so the client renders inline without a
  // JS QR library. The QR ENCODES the scanner target /r/<code> (what the door
  // scanner's extractCode expects), same as the full pass — so the thumbnail is
  // itself scannable. The clickable ticket_url below still opens the human pass.
  const qrByItem = {}
  const codeEntries = Object.entries(codeByItem)
  if (codeEntries.length) {
    const base = appUrl()
    await Promise.all(codeEntries.map(async ([itemId, code]) => {
      try {
        qrByItem[itemId] = await QRCode.toDataURL(`${base}/r/${code}`, {
          margin: 1,
          width: 360,
          color: { dark: '#0a0a0b', light: '#ffffff' },
          errorCorrectionLevel: 'M',
        })
      } catch {
        // Don't fail the whole response if one QR fails to render — the client
        // still has ticket_code and the "open full pass" deep-link.
      }
    }))
  }

  const base = appUrl()
  const result = all.map(o => {
    const activeItems = (o.order_items || []).filter(i => !i.voided_at)
    const firstStop = o.event?.group?.schedule?.[0] || null
    return {
      id: o.id,
      status: o.status,
      event: o.event ? {
        name: o.event.name,
        event_date: o.event.event_date,
        pickup_time: firstStop?.start_time || o.event.pickup_time,
      } : null,
      riders: activeItems.map(i => {
        const unclaimed = !!(i.claim_token && !i.claimed_at)
        const code = unclaimed ? null : (codeByItem[i.id] || null)
        return {
          name: i.rider_first_name || null,
          pass_type: i.ticket_type?.name || null,
          // Suppress the boarding pass for unclaimed claim-link seats — they
          // resolve to the claim flow, not a real pass.
          ticket_code: code,
          ticket_qr_data_url: unclaimed ? null : (qrByItem[i.id] || null),
          ticket_url: code ? `${base}/surfcity/tickets/${code}` : null,
        }
      }),
    }
  })

  return Response.json({ orders: result })
}
