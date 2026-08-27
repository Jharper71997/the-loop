import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import FormShell, { Field, Select, Textarea, SubmitButton } from '@/app/(leadership)/_components/FormShell'
import {
  mintPartyToken, ORGANIZER_FARE, GUEST_FARE, SEAT_FARE,
  PRICING_FLAT, PRICING_PER_PERSON,
} from '@/lib/parties'

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

  const pricing = str(formData.get('pricing')) === PRICING_PER_PERSON ? PRICING_PER_PERSON : PRICING_FLAT
  const priceCents = Math.round(priceRaw * 100)
  const pickupTime = str(formData.get('pickup_time')) || null
  const pickupPlace = str(formData.get('pickup_place'))
  const capacityRaw = Number.parseInt(formData.get('capacity'), 10)
  const capacity = Number.isInteger(capacityRaw) && capacityRaw > 0 ? capacityRaw : null

  // Max riders is optional on a flat party (one organizer buys everything and
  // self-limits) but MANDATORY per person, where strangers to each other book
  // independently against the same link. Without a cap there, nothing stops
  // the twentieth person buying a seat on a shuttle that holds fourteen.
  if (pricing === PRICING_PER_PERSON && !capacity) {
    redirect('/admin/parties/new?error=capacity_required')
  }
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
      party_pricing: pricing,
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

  // The fares. stop_index stays NULL on every one of them, and that is
  // load-bearing: lib/capacity.js caps any ticket type that HAS a stop_index at
  // the shuttle's 13 physical seats, which would silently block a 14-person
  // party from buying its own bus.
  //
  // Capacity then differs by mode, and the difference matters:
  //   flat        null (uncapped). One organizer buys the lot in a single
  //               order and self-limits against events.capacity.
  //   per_person  the real cap. Independent buyers cannot see each other's
  //               orders, so this ticket type is the ONLY thing standing
  //               between them and an oversold bus. Checkout counts sold seats
  //               by ticket_type_id for null-stop fares, so this is enforced.
  const fares = pricing === PRICING_PER_PERSON
    ? [{ event_id: event.id, name: SEAT_FARE, price_cents: priceCents, stop_index: null, capacity, sort_order: 0, active: true }]
    : [
        { event_id: event.id, name: ORGANIZER_FARE, price_cents: priceCents, stop_index: null, capacity: null, sort_order: 0, active: true },
        { event_id: event.id, name: GUEST_FARE, price_cents: 0, stop_index: null, capacity: null, sort_order: 1, active: true },
      ]
  const { error: fErr } = await sb.from('ticket_types').insert(fares)
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
  price_required: 'Enter the price.',
  capacity_required: 'A per-person party needs a max rider count, or it can oversell the bus.',
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
        <Select
          label="How they pay"
          name="pricing"
          defaultValue={PRICING_FLAT}
          options={[
            { value: PRICING_FLAT, label: 'One person buys the whole shuttle' },
            { value: PRICING_PER_PERSON, label: 'Everyone pays per person' },
          ]}
          hint="Whole shuttle: the organizer pays one flat number and guests ride free on their own waiver links. Per person: the link works like a normal loop, so riders buy their own seat or one person buys several and signs for them."
        />
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
          label="Price"
          name="price"
          type="number"
          step="1"
          min="1"
          placeholder="500"
          required
          hint="Dollars. Whole shuttle: the one flat number the organizer pays. Per person: what each seat costs."
        />
        <Field
          label="Max riders"
          name="capacity"
          type="number"
          step="1"
          min="1"
          hint="Required for a per-person party — it is the hard cap that stops independent buyers overselling the bus. Optional on a whole-shuttle party, where it is just shown on their page."
        />
        <Textarea
          label="Note on their page"
          name="description"
          rows={3}
          placeholder="We’ll grab you at the house, and there’s a food stop at Clovehitch."
        />

        <SubmitButton>Build it and create the link</SubmitButton>
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
