import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

export async function POST(req) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const { customer_details, metadata } = session

    const name = customer_details?.name?.split(' ') || ['', '']
    const first_name = name[0]
    const last_name = name.slice(1).join(' ')
    const email = customer_details?.email
    const phone = customer_details?.phone
    const group_id = metadata?.group_id

    const { data: contact } = await supabase
      .from('contacts')
      .insert([{ first_name, last_name, email, phone }])
      .select()
      .single()

    if (contact && group_id) {
      await supabase.from('group_members').insert([{
        group_id,
        contact_id: contact.id
      }])
    }
  }

  return Response.json({ received: true })
}