import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { contactHasSignedCurrent } from '@/lib/waiver'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req) {
  let body
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'bad json' }, { status: 400 })
  }

  const email = String(body?.email || '').trim().toLowerCase()
  const phone4Raw = String(body?.phone4 || '').replace(/\D/g, '')

  if (!email || !email.includes('@') || phone4Raw.length < 4) {
    return Response.json({ orders: [] })
  }
  const phone4 = phone4Raw.slice(-4)

  const sb = supabaseAdmin()

  // Find any paid orders where the email matches and the phone ends in phone4.
  // Use ilike for email (case-insensitive), and a server-side ends-with on phone.
  const { data: orders, error } = await sb
    .from('orders')
    .select(`
      id,
      status,
      total_cents,
      buyer_email,
      buyer_phone,
      buyer_name,
      party_size,
      paid_at,
      created_at,
      contact_id,
      event:events ( id, name, event_date, pickup_time, status ),
      order_items ( id, rider_first_name, rider_last_name, unit_price_cents, contact_id )
    `)
    .ilike('buyer_email', email)
    .in('status', ['paid', 'pending'])
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const matched = (orders || []).filter(o => {
    const digits = String(o.buyer_phone || '').replace(/\D/g, '')
    return digits.endsWith(phone4)
  })

  // Resolve waiver status per distinct contact.
  const contactIds = Array.from(new Set(
    matched.flatMap(o => [o.contact_id, ...(o.order_items || []).map(i => i.contact_id)]).filter(Boolean)
  ))
  const waiverByContact = {}
  for (const cid of contactIds) {
    waiverByContact[cid] = await contactHasSignedCurrent(sb, cid)
  }

  const result = matched.map(o => ({
    id: o.id,
    status: o.status,
    total_cents: o.total_cents,
    party_size: o.party_size,
    buyer_name: o.buyer_name,
    paid_at: o.paid_at,
    created_at: o.created_at,
    event: o.event,
    contact_id: o.contact_id,
    waiver_signed: o.contact_id ? !!waiverByContact[o.contact_id] : false,
    riders: (o.order_items || []).map(i => ({
      name: [i.rider_first_name, i.rider_last_name].filter(Boolean).join(' ').trim() || null,
      contact_id: i.contact_id,
      waiver_signed: i.contact_id ? !!waiverByContact[i.contact_id] : false,
    })),
  }))

  return Response.json({ orders: result })
}
