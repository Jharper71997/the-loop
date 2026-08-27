import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import FormShell, { Field, Textarea, SubmitButton } from '../../../_components/FormShell'
import { mintPartyToken, ORGANIZER_FARE, GUEST_FARE, fmtEventDate } from '@/lib/parties'

export const dynamic = 'force-dynamic'

// Build a party = mint the link you are about to text somebody.
//
// Three rows go in, in this order, and the order matters: a group to hold the
// ROUTE, an event that points at it, and the two fares. The route itself is
// left empty here on purpose — we sell the night first and plan it after, so
// the builder stays four fields instead of an itinerary editor nobody has the
// answers for yet. /leadership/parties/[id] is where the route gets built.

async function createParty(formData) {
  'use server'

  const name = str(formData.get('name'))
  const eventDate = str(formData.get('event_date'))
  const priceRaw = Number.parseFloat(formData.get('price'))
  const requestId = str(formData.get('request_id')) || null

  const back = `/leadership/parties/new${requestId ? `?request=${requestId}` : ''}`
  if (!name) redirect(`${back}${requestId ? '&' : '?'}error=name_required`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) redirect(`${back}${requestId ? '&' : '?'}error=date_required`)
  if (!Number.isFinite(priceRaw) || priceRaw <= 0) redirect(`${back}${requestId ? '&' : '?'}error=price_required`)

  const priceCents = Math.round(priceRaw * 100)
  const pickupTime = str(formData.get('pickup_time')) || null
  const capacityRaw = Number.parseInt(formData.get('capacity'), 10)
  const capacity = Number.isInteger(capacityRaw) && capacityRaw > 0 ? capacityRaw : null
  const description = str(formData.get('description')) || null

  const sb = supabaseAdmin()

  // The group carries the route. It is created empty — schedule stays null
  // until we build the itinerary — but it has to exist now so the event has
  // something to hang the route on later without a second migration path.
  const { data: group, error: gErr } = await sb
    .from('groups')
    .insert({ name, event_date: eventDate, pickup_time: pickupTime, kind: 'brew' })
    .select('id')
    .single()
  if (gErr) {
    console.error('[parties/new] group insert failed', gErr)
    redirect(`${back}${requestId ? '&' : '?'}error=group_failed`)
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
    .select('id, access_token')
    .single()
  if (eErr) {
    console.error('[parties/new] event insert failed', eErr)
    redirect(`${back}${requestId ? '&' : '?'}error=event_failed`)
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
    redirect(`/leadership/parties/${event.id}?error=fares_failed`)
  }

  // Close the loop on the request that started it, so the desk stops showing
  // it as work and we can see which requests actually converted.
  if (requestId) {
    const { error: rErr } = await sb
      .from('party_requests')
      .update({ status: 'booked', event_id: event.id })
      .eq('id', requestId)
    if (rErr) console.error('[parties/new] request link failed', rErr)
  }

  revalidatePath('/leadership/parties')
  redirect(`/leadership/parties/${event.id}?created=1`)
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
  const requestId = typeof sp?.request === 'string' ? sp.request : null
  const error = typeof sp?.error === 'string' ? ERRORS[sp.error] || 'Something went wrong.' : null

  // Prefill from the request that prompted this, so quoting a night is one
  // number typed rather than a re-keying exercise against another tab.
  let request = null
  if (requestId) {
    const sb = supabaseAdmin()
    const { data } = await sb
      .from('party_requests')
      .select('id, name, requested_date, party_size, occasion, notes, phone, email')
      .eq('id', requestId)
      .maybeSingle()
    request = data || null
  }

  const suggestedName = request
    ? `${request.name}${request.occasion && request.occasion !== 'Something else' ? ` — ${request.occasion}` : ''}`
    : ''

  return (
    <FormShell
      title="Build a party"
      subtitle="Creates the private booking link. Nothing about this party appears on /events."
      backTo="/leadership/parties"
    >
      {error && (
        <div style={errBox} role="alert">{error}</div>
      )}

      {request && (
        <div style={noteBox}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>From {request.name}’s request</div>
          <div style={{ fontSize: 12.5, marginTop: 4, lineHeight: 1.55 }}>
            {request.party_size} riders
            {request.requested_date ? ` · wants ${fmtEventDate(request.requested_date, { weekday: 'short', month: 'short', day: 'numeric' })}` : ' · date flexible'}
            {request.phone ? ` · ${request.phone}` : ''}
          </div>
          {request.notes && (
            <p style={{ fontSize: 12.5, margin: '8px 0 0', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{request.notes}</p>
          )}
        </div>
      )}

      <form action={createParty}>
        {requestId && <input type="hidden" name="request_id" value={requestId} />}

        <Field
          label="Party name"
          name="name"
          defaultValue={suggestedName}
          placeholder="Kelsey’s bachelorette"
          required
          autoFocus
          hint="The organizer sees this at the top of their page."
        />
        <Field
          label="Date"
          name="event_date"
          type="date"
          defaultValue={request?.requested_date || ''}
          required
        />
        <Field
          label="Pickup time"
          name="pickup_time"
          type="time"
          hint="Rough is fine — the route you build later overrides it."
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
          defaultValue={request?.party_size || ''}
          hint="Shown on their page. Informational — a party is not capped by the 13-seat per-stop limit."
        />
        <Textarea
          label="Note on their page"
          name="description"
          rows={3}
          placeholder="Pickup at Voodoo, back by 6. Food stop at Clovehitch."
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

const noteBox = {
  background: '#fdfaf3',
  border: '1px solid #e8ddc8',
  borderRadius: 7,
  padding: '12px 14px',
  marginBottom: 18,
  color: '#3b322a',
}
