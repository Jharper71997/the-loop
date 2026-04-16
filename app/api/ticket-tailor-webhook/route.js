import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function POST(req) {
  const body = await req.json()

  if (body.event !== 'order.created') {
    return Response.json({ received: true })
  }

  const order = body.payload
  const ticketTypeName = order.tickets?.[0]?.ticket_type_name || ''
  const buyerName = order.buyer_details?.name || ''
  const email = order.buyer_details?.email || ''
  const phone = order.buyer_details?.phone || ''

  const nameParts = buyerName.split(' ')
  const first_name = nameParts[0] || ''
  const last_name = nameParts.slice(1).join(' ') || ''

  const { data: contact } = await supabase
    .from('contacts')
    .insert([{ first_name, last_name, email, phone, ticket_type: ticketTypeName }])
    .select()
    .single()

  if (contact) {
    const { data: group } = await supabase
      .from('groups')
      .select('id')
      .ilike('name', `%${ticketTypeName}%`)
      .single()

    if (group) {
      await supabase.from('group_members').insert([{
        group_id: group.id,
        contact_id: contact.id
      }])
    }
  }

  return Response.json({ received: true })
}