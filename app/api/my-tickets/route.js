import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { contactHasSignedCurrent } from '@/lib/waiver'
import { normalizePhone } from '@/lib/phone'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/my-tickets
//   body: { phone }
// Returns the most recent paid + pending orders for any rider whose phone
// matches (buyer_phone OR any order_items.rider_phone). One field, one tap —
// optimized for tipsy riders trying to recover a lost SMS link.
//
// Privacy: the response only includes first names, no last names, no emails.
// Anyone with the phone could already retrieve the original SMS deep links
// from the carrier, so the real risk surface is small. Rate-limit at the
// edge with simple in-memory counters per IP (best-effort; KV/Supabase if
// abuse becomes a problem).

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
  // any order_item with this rider phone. Union client-side by id.
  const [{ data: byBuyer }, { data: byRider }] = await Promise.all([
    sb.from('orders')
      .select(`
        id, status, total_cents, buyer_phone, buyer_name, party_size,
        paid_at, created_at, contact_id,
        event:events ( id, name, event_date, pickup_time, status ),
        order_items ( id, rider_first_name, rider_last_name, contact_id, rider_phone, voided_at, claim_token, claimed_at )
      `)
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
      .select(`
        id, status, total_cents, buyer_phone, buyer_name, party_size,
        paid_at, created_at, contact_id,
        event:events ( id, name, event_date, pickup_time, status ),
        order_items ( id, rider_first_name, rider_last_name, contact_id, rider_phone, voided_at, claim_token, claimed_at )
      `)
      .in('id', extraIds)
      .in('status', ['paid', 'pending'])
    extraOrders = data || []
  }

  const all = [...(byBuyer || []), ...extraOrders]
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

  // Resolve waiver status per distinct contact (across buyer + active items).
  const contactIds = Array.from(new Set(
    all.flatMap(o => [
      o.contact_id,
      ...(o.order_items || [])
        .filter(i => !i.voided_at)
        .map(i => i.contact_id),
    ]).filter(Boolean)
  ))
  const waiverByContact = {}
  for (const cid of contactIds) {
    waiverByContact[cid] = await contactHasSignedCurrent(sb, cid)
  }

  const result = all.map(o => {
    const activeItems = (o.order_items || []).filter(i => !i.voided_at)
    return {
      id: o.id,
      status: o.status,
      total_cents: o.total_cents,
      party_size: activeItems.length || o.party_size,
      buyer_first_name: splitFirst(o.buyer_name),
      paid_at: o.paid_at,
      created_at: o.created_at,
      event: o.event,
      contact_id: o.contact_id,
      waiver_signed: o.contact_id ? !!waiverByContact[o.contact_id] : false,
      riders: activeItems.map(i => ({
        name: i.rider_first_name || null,
        contact_id: i.contact_id,
        waiver_signed: i.contact_id ? !!waiverByContact[i.contact_id] : false,
        unclaimed: !!(i.claim_token && !i.claimed_at),
      })),
    }
  })

  return Response.json({ orders: result })
}

function splitFirst(name) {
  if (!name) return null
  return String(name).trim().split(/\s+/)[0] || null
}
