import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import FormShell, { Field, Textarea, SubmitButton } from '@/app/(leadership)/_components/FormShell'
import { mintPartyToken, ORGANIZER_FARE, GUEST_FARE } from '@/lib/parties'

export const dynamic = 'force-dynamic'

// Build a party = mint the link you are about to text somebody.
//
// Three rows go in, in this order, and the order matters: a group to hold the
// ROUTE, an event that points at it, and the two fares. The rest of the route
// is left for later on purpose — we sell the night first and plan it after, so
// this stays six fields instead of an itinerary editor nobody has the answers
// for yet. /admin/parties/[id] is where the rest of the route gets built.

async function createParty(formData) {
  'use server'

  const name = str(formData.get('name'))
  const eventDate = str(formData.get('event_date'))
  const priceRaw = Number.parseFloat(formData.get('price'))

  if (!name) redirect('/admin/parties/new?error=name_required')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) redirect('/admin/parties/new?error=date_required')
  if (!Number.isFinite(priceRaw) || priceRaw <= 0) redirect('/admin/parties/new?error=price_required')

  const priceCents = Math.round(priceRaw * 100)
  const pickupTime = str(formData.get('pickup_time')) || null
  const pickupPlace = str(formData.get('pickup_place'))
  const capacityRaw = Number.parseInt(formData.get('capacity'), 10)
  const capacity = Number.isInteger(capacityRaw) && capacityRaw > 0 ? capacityRaw : null
  const description = str(formData.get('description')) || null

  // The pickup becomes the route's first stop. A private party is collected
  // from wherever they are — a house, an Airbnb, a hotel lobby — so this is
  // free text, not a partner bar. The remaining stops get added later.
  const schedule = pickupPlace
    ? [pickupTime ? { name: pickupPlace, start_time: pickupTime } : { name: pickupPlace }]
    : []

  const sb = supabaseAdmin()

  const { data: group, error: gErr } = await sb
    .from('groups')
    .insert({ name, event_date: eventDate, pickup_time: pickupTime, kind: 'brew', schedule })
    .select('id')
    .single()
  if (gErr) {
    console.error('[parties/new] group insert failed', gErr)
    redirect('/admin/parties/new?error=group_failed')
  }

  // status must be 'on_sale' — that is what makes it bookable. is_private is
  // what stops it being advertised. Those are two different questions and this
  // is the row where they finally stopped being the same one.
  const { data: event, error: eErr } = await sb
    .from('events')
    .insert({
      name,
      event_date: eventDate,
      pickup_time: pickupTime,
      status: 'on_sale',
      kind: 'brew',
      is_private: true,
      access_token: mintPartyToken(name),
      capacity,
      description,
      group_id: group.id,
    })
    .select('id')
    .single()
  if (eErr) {
    console.error('[parties/new] event insert failed', eErr)
    redirect('/admin/parties/new?error=event_failed')
  }

  // The two fares. stop_index stays NULL on both, and that is load-bearing:
  // lib/capacity.js caps any ticket type that HAS a stop_index at the
  // shuttle's 13 physical seats, which would silently block a 14-person party
  // from buying its own bus. Null means uncapped, which is what a charter is —
  // the organizer self-limits against events.capacity.
  const { error: fErr } = await sb.from('ticket_types').insert([
    { event_id: event.id, name: ORGANIZER_FARE, price_cents: priceCents, stop_index: null, capacity: null, sort_order: 0, active: true },
    { event_id: event.id, name: GUEST_FARE, price_cents: 0, stop_index: null, capacity: null, sort_order: 1, active: true },
  ])
  if (fErr) {
    console.error('[parties/new] ticket_types insert failed', fErr)
    redirect(`/admin/parties/${event.id}?error=fares_failed`)
  }

  revalidatePath('/admin/parties')
  redirect(`/admin/parties/${event.id}?created=1`)
}

const ERRORS = {
  name_required: 'Give the party a name — the organizer sees it on their page.',
  date_required: 'Pick the date of the night.',
  price_required: 'Enter the flat price you quoted for the whole shuttle.',
  group_failed: 'Could not create the route holder. Try again.',
  event_failed: 'Could not create the party. Try again.',
}

export default async function NewPartyPage({ searchParams }) {
  const sp = await searchParams
  const error = typeof sp?.error === 'string' ? ERRORS[sp.error] || 'Something went wrong.' : null

  return (
    <FormShell
      title="Build a party"
      subtitle="Creates the private booking link. Nothing about this party appears anywhere on the site."
      backTo="/admin/parties"
    >
      {error && <div style={errBox} role="alert">{error}</div>}

      <form action={createParty}>
        <Field
          label="Party name"
          name="name"
          placeholder="Kelsey’s bachelorette"
          required
          autoFocus
          hint="The organizer sees this at the top of their page."
        />
        <Field label="Date" name="event_date" type="date" required />
        <Field
          label="Pickup — where"
          name="pickup_place"
          placeholder="1420 Gum Branch Rd (her house)"
          hint="Anywhere they want: a house, an Airbnb, a hotel lobby, a bar. Becomes the first stop on their route."
        />
        <Field
          label="Pickup — when"
          name="pickup_time"
          type="time"
          hint="Rough is fine. Editing the route later updates it."
        />
        <Field
          label="Flat price for the whole shuttle"
          name="price"
          type="number"
          step="1"
          min="1"
          placeholder="500"
          required
          hint="Dollars. This is what the organizer pays, once. Guests ride free on their own seats."
        />
        <Field
          label="Max riders"
          name="capacity"
          type="number"
          step="1"
          min="1"
          hint="Shown on their page. Informational — a party is not capped by the 13-seat per-stop limit."
        />
        <Textarea
          label="Note on their page"
          name="description"
          rows={3}
          placeholder="We’ll grab you at the house, and there’s a food stop at Clovehitch."
        />

        <SubmitButton>Build it and mint the link</SubmitButton>
      </form>
    </FormShell>
  )
}

function str(v) {
  return typeof v === 'string' ? v.trim() : (v == null ? '' : String(v).trim())
}

const errBox = {
  background: 'rgba(196,74,58,0.10)',
  border: '1px solid rgba(196,74,58,0.35)',
  color: '#b3311f',
  fontSize: 13,
  padding: '10px 12px',
  borderRadius: 6,
  marginBottom: 16,
}
