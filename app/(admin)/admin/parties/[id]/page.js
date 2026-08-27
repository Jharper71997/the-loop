import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import StatCard from '@/app/(leadership)/_components/StatCard'
import StatusBadge from '@/app/(leadership)/_components/StatusBadge'
import DataTable from '@/app/(leadership)/_components/DataTable'
import { PUBLIC_PARTNER_BARS } from '@/lib/bars'
import {
  partyUrl, partyPriceCents, mintPartyToken, isPerPerson, fmtMoney, fmtTime, fmtEventDate,
  ORGANIZER_FARE, GUEST_FARE, SEAT_FARE, PRICING_FLAT, PRICING_PER_PERSON,
} from '@/lib/parties'
import CopyLink from '../CopyLink'
import SmsBroadcast from '@/app/(admin)/_components/SmsBroadcast'
import DeleteForm from '@/app/(leadership)/_components/DeleteForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Party' }

// How many stop rows the route builder offers. Eight covers the whole partner
// list plus a start and a finish; empty rows are dropped on save, so an
// unused row costs nothing.
const STOP_ROWS = 8

/* ------------------------------- actions -------------------------------- */

async function saveRoute(formData) {
  'use server'
  const eventId = String(formData.get('event_id') || '')
  if (!eventId) return

  const sb = supabaseAdmin()
  const { data: ev } = await sb.from('events').select('id, group_id, is_private').eq('id', eventId).maybeSingle()
  if (!ev?.group_id || !ev.is_private) {
    redirect(`/admin/parties/${eventId}?error=no_group`)
  }

  // Empty rows are how a route gets shortened: someone clears stop 4 and
  // saves. Filtering on the NAME (not the time) is what makes that work — a
  // stop with a time and no name is not a stop.
  const schedule = []
  for (let i = 0; i < STOP_ROWS; i++) {
    const name = String(formData.get(`stop_name_${i}`) || '').trim()
    if (!name) continue
    const time = String(formData.get(`stop_time_${i}`) || '').trim()
    schedule.push(time ? { name, start_time: time } : { name })
  }

  const { error } = await sb.from('groups').update({ schedule }).eq('id', ev.group_id)
  if (error) {
    console.error('[admin/parties/route] save failed', error)
    redirect(`/admin/parties/${eventId}?error=route_failed`)
  }

  // The first stop is when the night actually starts, so keep the event's own
  // pickup_time honest with it rather than leaving the rough number we typed
  // when we sold the party.
  const first = schedule.find(s => s.start_time)
  if (first) {
    await sb.from('events').update({ pickup_time: first.start_time }).eq('id', eventId)
    await sb.from('groups').update({ pickup_time: first.start_time }).eq('id', ev.group_id)
  }

  revalidatePath(`/admin/parties/${eventId}`)
  revalidatePath('/admin/parties')
  redirect(`/admin/parties/${eventId}?saved=route`)
}

async function rotateToken(formData) {
  'use server'
  const eventId = String(formData.get('event_id') || '')
  if (!eventId) return
  const sb = supabaseAdmin()
  const { data: ev } = await sb.from('events').select('id, name, is_private').eq('id', eventId).maybeSingle()
  if (!ev?.is_private) redirect('/admin/parties')

  // Killing a leaked link. The old token stops resolving the moment this
  // writes, which is the entire point — anyone holding it gets the same 404 as
  // a stranger. Only do this before they have paid, or you have just 404'd a
  // customer who is trying to reach their own booking page.
  await sb.from('events').update({ access_token: mintPartyToken(ev.name) }).eq('id', eventId)
  revalidatePath(`/admin/parties/${eventId}`)
  redirect(`/admin/parties/${eventId}?saved=token`)
}

// Everything about a party except its route and its link. A quote moves —
// the date slips, the group grows, they talk you up or down — and before this
// the only way to change any of it was to build a second party and send a
// second link.
async function saveDetails(formData) {
  'use server'
  const eventId = String(formData.get('event_id') || '')
  if (!eventId) return
  const back = `/admin/parties/${eventId}`

  const sb = supabaseAdmin()
  const { data: ev } = await sb
    .from('events')
    .select('id, group_id, is_private, party_pricing, ticket_types(id, name, price_cents, active)')
    .eq('id', eventId)
    .maybeSingle()
  if (!ev?.is_private) redirect('/admin/parties')

  const name = String(formData.get('name') || '').trim()
  const eventDate = String(formData.get('event_date') || '').trim()
  const priceRaw = Number.parseFloat(formData.get('price'))
  const capRaw = Number.parseInt(formData.get('capacity'), 10)
  const capacity = Number.isInteger(capRaw) && capRaw > 0 ? capRaw : null
  const description = String(formData.get('description') || '').trim() || null

  if (!name) redirect(`${back}?error=name_required`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) redirect(`${back}?error=date_required`)
  if (!Number.isFinite(priceRaw) || priceRaw <= 0) redirect(`${back}?error=price_required`)
  const priceCents = Math.round(priceRaw * 100)

  // Changing how the money is split rebuilds the fares, so it is only offered
  // while nothing has been bought. Once an order_item points at a fare, that
  // fare is part of somebody's ticket and their boarding pass.
  const { count: soldItems } = await sb
    .from('order_items')
    .select('id, orders!inner(id, event_id)', { count: 'exact', head: true })
    .eq('orders.event_id', eventId)
  const locked = (soldItems || 0) > 0

  const wanted = String(formData.get('pricing') || '') === PRICING_PER_PERSON ? PRICING_PER_PERSON : PRICING_FLAT
  const pricing = locked ? (ev.party_pricing || PRICING_FLAT) : wanted

  if (pricing === PRICING_PER_PERSON && !capacity) {
    redirect(`${back}?error=capacity_required`)
  }

  const evUpdate = {
    name, event_date: eventDate, capacity, description, party_pricing: pricing,
  }
  const { error: eErr } = await sb.from('events').update(evUpdate).eq('id', eventId)
  if (eErr) {
    console.error('[admin/parties/details] event update failed', eErr)
    redirect(`${back}?error=save_failed`)
  }
  if (ev.group_id) {
    await sb.from('groups').update({ name, event_date: eventDate }).eq('id', ev.group_id)
  }

  const active = (ev.ticket_types || []).filter(t => t.active)
  const modeChanged = pricing !== (ev.party_pricing || PRICING_FLAT)

  if (modeChanged && !locked) {
    // Safe: nothing points at these rows yet.
    await sb.from('ticket_types').delete().eq('event_id', eventId)
    const fares = pricing === PRICING_PER_PERSON
      ? [{ event_id: eventId, name: SEAT_FARE, price_cents: priceCents, stop_index: null, capacity, sort_order: 0, active: true }]
      : [
          { event_id: eventId, name: ORGANIZER_FARE, price_cents: priceCents, stop_index: null, capacity: null, sort_order: 0, active: true },
          { event_id: eventId, name: GUEST_FARE, price_cents: 0, stop_index: null, capacity: null, sort_order: 1, active: true },
        ]
    const { error } = await sb.from('ticket_types').insert(fares)
    if (error) {
      console.error('[admin/parties/details] fare rebuild failed', error)
      redirect(`${back}?error=save_failed`)
    }
  } else if (pricing === PRICING_PER_PERSON) {
    // The seat carries both the price AND the hard cap on a per-person party.
    const seat = active.find(t => t.name === SEAT_FARE) || active.find(t => t.price_cents > 0)
    if (seat) await sb.from('ticket_types').update({ price_cents: priceCents, capacity }).eq('id', seat.id)
  } else {
    const organizer = active.find(t => t.name === ORGANIZER_FARE) || active.find(t => t.price_cents > 0)
    if (organizer) await sb.from('ticket_types').update({ price_cents: priceCents }).eq('id', organizer.id)
  }

  revalidatePath(back)
  revalidatePath('/admin/parties')
  redirect(`${back}?saved=details`)
}

// Deleting a party is only ever safe before money moves. orders.event_id is ON
// DELETE SET NULL, so removing a paid party would not remove its orders — it
// would quietly orphan real revenue from the night it belongs to, and the
// finance pages would never account for it again. So a paid party cannot be
// deleted here at all; close its link instead, and refund in Stripe if that is
// what you actually mean.
async function deleteParty(eventId) {
  'use server'
  if (!eventId) return
  const sb = supabaseAdmin()

  const { data: ev } = await sb
    .from('events').select('id, group_id, is_private').eq('id', eventId).maybeSingle()
  if (!ev?.is_private) redirect('/admin/parties')

  const { data: paid } = await sb
    .from('orders').select('id').eq('event_id', eventId).eq('status', 'paid').limit(1)
  if ((paid || []).length) {
    redirect(`/admin/parties/${eventId}?error=paid_cannot_delete`)
  }

  // Abandoned checkouts can go with it. order_items cascade from orders.
  await sb.from('orders').delete().eq('event_id', eventId)
  await sb.from('ticket_types').delete().eq('event_id', eventId)
  const { error } = await sb.from('events').delete().eq('id', eventId)
  if (error) {
    console.error('[admin/parties/delete] event delete failed', error)
    redirect(`/admin/parties/${eventId}?error=delete_failed`)
  }
  if (ev.group_id) await sb.from('groups').delete().eq('id', ev.group_id)

  revalidatePath('/admin/parties')
  redirect('/admin/parties?saved=deleted')
}

async function setStatus(formData) {
  'use server'
  const eventId = String(formData.get('event_id') || '')
  const status = String(formData.get('status') || '')
  if (!eventId || !['on_sale', 'draft'].includes(status)) return
  const sb = supabaseAdmin()
  await sb.from('events').update({ status }).eq('id', eventId).eq('is_private', true)
  revalidatePath(`/admin/parties/${eventId}`)
  redirect(`/admin/parties/${eventId}?saved=status`)
}

/* --------------------------------- page --------------------------------- */

export default async function PartyDetailPage({ params, searchParams }) {
  const { id } = await params
  const sp = await searchParams
  const sb = supabaseAdmin()

  const { data: event } = await sb
    .from('events')
    .select('id, name, event_date, pickup_time, description, status, capacity, access_token, is_private, group_id, ticket_types(id, name, price_cents, active), groups(schedule)')
    .eq('id', id)
    .maybeSingle()

  if (!event || !event.is_private) notFound()

  const schedule = Array.isArray(event.groups?.schedule) ? event.groups.schedule : []
  const fares = (event.ticket_types || []).filter(t => t.active)
  const quoted = partyPriceCents(fares)

  const { data: orders } = await sb
    .from('orders')
    .select('id, buyer_name, buyer_email, buyer_phone, total_cents, party_size, status, paid_at')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false })

  const paidOrders = (orders || []).filter(o => o.status === 'paid')
  const collected = paidOrders.reduce((s, o) => s + (o.total_cents || 0), 0)
  const riders = paidOrders.reduce((s, o) => s + (o.party_size || 0), 0)

  // Who is actually on the bus, and whether each of them has signed. This is
  // the list the driver needs and the one the organizer keeps asking about.
  const { data: items } = await sb
    .from('order_items')
    .select('id, rider_first_name, rider_last_name, rider_phone, claim_token, claimed_at, voided_at, unit_price_cents, order:orders!inner(id, event_id, status)')
    .eq('orders.event_id', event.id)
    .is('voided_at', null)
    .limit(200)

  const seats = (items || []).filter(i => i.order?.status === 'paid')
  const unclaimed = seats.filter(s => s.claim_token && !s.claimed_at).length

  const perPerson = isPerPerson(event)
  // Any order_item at all pins the fare structure — see saveDetails.
  const locked = (items || []).length > 0
  const hasPaid = paidOrders.length > 0

  // Who to text. Riders first, then the buyer, because on a flat party the
  // organizer often does not put themselves on a seat. Deduped by phone so one
  // person who bought and also rides is not texted twice.
  const recipients = []
  const seenPhones = new Set()
  for (const it of seats) {
    const phone = it.rider_phone
    if (!phone || seenPhones.has(phone)) continue
    seenPhones.add(phone)
    recipients.push({
      id: it.id,
      first_name: it.rider_first_name || '',
      last_name: it.rider_last_name || '',
      phone,
    })
  }
  for (const o of paidOrders) {
    if (!o.buyer_phone || seenPhones.has(o.buyer_phone)) continue
    seenPhones.add(o.buyer_phone)
    const [first, ...rest] = String(o.buyer_name || '').trim().split(/\s+/)
    recipients.push({ id: o.id, first_name: first || '', last_name: rest.join(' '), phone: o.buyer_phone })
  }

  const url = event.access_token ? partyUrl(event.access_token) : null
  const saved = typeof sp?.saved === 'string' ? sp.saved : null
  const error = typeof sp?.error === 'string' ? sp.error : null
  const created = sp?.created === '1'

  return (
    <main style={page}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Link href="/admin/parties" style={backLink}>← All parties</Link>

        <h1 style={h1}>{event.name}</h1>
        <p style={sub}>
          {fmtEventDate(event.event_date)}
          {event.pickup_time ? ` · pickup ${fmtTime(event.pickup_time)}` : ''}
          {event.capacity ? ` · up to ${event.capacity} riders` : ''}
          {' · '}
          <StatusBadge label={event.status === 'on_sale' ? 'link live' : 'link closed'} tone={event.status === 'on_sale' ? 'green' : 'grey'} />
        </p>

        {created && <Banner tone="ok">Party built. Send them the link below.</Banner>}
        {saved === 'route' && <Banner tone="ok">Route saved. It is on their page now.</Banner>}
        {saved === 'token' && <Banner tone="ok">New link created. The old one stopped working immediately.</Banner>}
        {saved === 'status' && <Banner tone="ok">Status updated.</Banner>}
        {saved === 'details' && <Banner tone="ok">Saved. Their page is updated.</Banner>}
        {error && <Banner tone="err">{ERRORS[error] || 'Something went wrong.'}</Banner>}

        {/* The link. This is the product of the whole feature — everything
            else on the page is about the night it sells. */}
        <section style={linkCard}>
          <div style={{ color: '#6e6154', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>
            The link you send
          </div>
          {url ? (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <code style={urlCode}>{url}</code>
                <CopyLink url={url} label="Copy" />
                <a href={`/party/${event.access_token}`} target="_blank" rel="noreferrer" style={ghostBtn}>Open</a>
              </div>
              <p style={{ color: '#8a7b68', fontSize: 12, lineHeight: 1.55, margin: '10px 0 0' }}>
                Not listed anywhere, not in the sitemap, noindexed. Anyone with the
                link can book it, so treat it like a key.
              </p>
            </>
          ) : (
            <p style={{ color: '#b3311f', fontSize: 13, margin: 0 }}>
              This party has no link yet. Create one below and it becomes reachable.
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <form action={rotateToken}>
              <input type="hidden" name="event_id" value={event.id} />
              <button type="submit" style={url ? dangerBtn : smallBtn}>
                {url ? 'Replace link (kills the old one)' : 'Create the link'}
              </button>
            </form>
            <form action={setStatus}>
              <input type="hidden" name="event_id" value={event.id} />
              <input type="hidden" name="status" value={event.status === 'on_sale' ? 'draft' : 'on_sale'} />
              <button type="submit" style={smallBtn}>
                {event.status === 'on_sale' ? 'Close the link' : 'Reopen the link'}
              </button>
            </form>
          </div>
        </section>

        <div style={statRow}>
          <StatCard label="Quoted" value={fmtMoney(quoted)} hint="whole shuttle" />
          <StatCard label="Collected" value={fmtMoney(collected)} tone={collected > 0 ? 'ok' : 'dim'} hint={collected > 0 ? 'paid' : 'not paid yet'} />
          <StatCard label="Riders" value={String(riders)} hint="seats bought" />
          <StatCard label="Unsigned" value={String(unclaimed)} tone={unclaimed > 0 ? 'gold' : 'ink'} hint={unclaimed > 0 ? 'guests yet to claim' : 'everyone signed'} />
        </div>

        {/* The route. This is the thing we promised to build for them. */}
        <h2 style={h2}>Details</h2>
        <p style={sectionSub}>
          Change anything here and their page updates immediately. The price only
          affects purchases made from now on &mdash; it does not re-charge or refund
          anyone who has already paid.
        </p>

        <form action={saveDetails} style={routeCard}>
          <input type="hidden" name="event_id" value={event.id} />

          <FieldRow label="Party name">
            <input name="name" defaultValue={event.name || ''} required style={stopInput} />
          </FieldRow>
          <FieldRow label="Date">
            <input name="event_date" type="date" defaultValue={event.event_date || ''} required style={stopInput} />
          </FieldRow>

          <FieldRow
            label="How they pay"
            hint={locked
              ? 'Locked: seats have been bought against the current fares, and those fares are part of somebody’s ticket.'
              : 'Whole shuttle: one organizer pays the lot, guests ride on $0 seats. Per person: everyone buys their own seat.'}
          >
            <select
              name="pricing"
              defaultValue={perPerson ? PRICING_PER_PERSON : PRICING_FLAT}
              disabled={locked}
              style={{ ...stopInput, opacity: locked ? 0.6 : 1 }}
            >
              <option value={PRICING_FLAT}>One person buys the whole shuttle</option>
              <option value={PRICING_PER_PERSON}>Everyone pays per person</option>
            </select>
          </FieldRow>

          <FieldRow label={perPerson ? 'Price per person' : 'Flat price for the whole shuttle'}>
            <input name="price" type="number" step="1" min="1" defaultValue={quoted ? quoted / 100 : ''} required style={stopInput} />
          </FieldRow>
          <FieldRow
            label="Max riders"
            hint={perPerson ? 'Required. This is the hard cap that stops independent buyers overselling the bus.' : 'Shown on their page.'}
          >
            <input name="capacity" type="number" step="1" min="1" defaultValue={event.capacity || ''} style={stopInput} />
          </FieldRow>
          <FieldRow label="Note on their page">
            <textarea name="description" rows={3} defaultValue={event.description || ''} style={{ ...stopInput, resize: 'vertical', fontFamily: 'inherit' }} />
          </FieldRow>

          <button type="submit" style={saveBtn}>Save details</button>
        </form>

        <h2 style={h2}>Their route</h2>
        <p style={sectionSub}>
          Stop 1 is the pickup and can be anywhere they want — a house, an Airbnb, a
          hotel lobby — so type a real address, not just a bar. Partner bars
          autocomplete, but nothing here is limited to them. Leave a row blank to drop
          that stop. The first time you enter becomes the party&rsquo;s pickup time.
          This shows up on their page the moment you save.
        </p>

        <form action={saveRoute} style={routeCard}>
          <input type="hidden" name="event_id" value={event.id} />
          <datalist id="party-bars">
            {PUBLIC_PARTNER_BARS.map(b => <option key={b.slug} value={b.name} />)}
          </datalist>

          {Array.from({ length: STOP_ROWS }, (_, i) => {
            const stop = schedule[i] || {}
            return (
              <div key={i} style={stopRow}>
                <span style={stopNum}>{i + 1}</span>
                <input
                  name={`stop_name_${i}`}
                  list="party-bars"
                  defaultValue={stop.name || ''}
                  placeholder={i === 0 ? 'Pickup — any address they want' : 'Stop'}
                  style={stopInput}
                />
                <input
                  name={`stop_time_${i}`}
                  type="time"
                  defaultValue={stop.start_time || ''}
                  style={{ ...stopInput, maxWidth: 130, flex: '0 0 auto' }}
                />
              </div>
            )
          })}

          <button type="submit" style={saveBtn}>Save the route</button>
        </form>

        {/* Who is on it. */}
        <h2 style={h2}>Who is riding</h2>
        <DataTable
          columns={[
            { key: 'name', header: 'Rider', primary: true, render: r => (
              [r.rider_first_name, r.rider_last_name].filter(Boolean).join(' ') || '(unnamed seat)'
            ) },
            { key: 'phone', header: 'Phone', render: r => r.rider_phone || '—' },
            { key: 'price', header: 'Paid', mono: true, render: r => fmtMoney(r.unit_price_cents) },
            { key: 'signed', header: 'Waiver', render: r => r.claimed_at
              ? <StatusBadge label="signed" tone="green" />
              : r.claim_token
                ? <StatusBadge label="link sent, unsigned" tone="gold" />
                : <StatusBadge label="signed at checkout" tone="green" /> },
          ]}
          rows={seats}
          rowKey={r => r.id}
          empty={<div style={{ color: '#6e6154', fontSize: 13, padding: '16px 2px' }}>Nobody has booked yet. They will show up here the moment the organizer pays.</div>}
        />

        {orders && orders.some(o => o.status !== 'paid') && (
          <p style={{ color: '#8a7b68', fontSize: 12.5, marginTop: -12 }}>
            {orders.filter(o => o.status !== 'paid').length} unpaid or abandoned checkout attempt(s) not shown.
          </p>
        )}

        {/* Texting the party. SmsBroadcast sends one message per person rather
            than a group thread — a group MMS on this shuttle turns every reply
            into everyone's problem, so the Loop never sends one. */}
        <h2 style={h2}>Text this party</h2>
        <p style={sectionSub}>
          Goes to everyone on a paid seat, plus whoever paid. Each person gets
          their own message, never a group thread.
        </p>
        {recipients.length ? (
          <div style={routeCard}>
            <SmsBroadcast
              recipients={recipients}
              title={`Text this party (${recipients.length})`}
              defaultMessage={`Hey {first_name}, it's Jville Brew Loop. `}
            />
          </div>
        ) : (
          <div style={{ ...routeCard, color: '#6e6154', fontSize: 13 }}>
            Nobody to text yet. Riders appear here once the party is paid for.
          </div>
        )}

        {/* Deleting. Always confirmed, and refused outright once money has
            moved — see deleteParty for why an orphaned paid order is worse
            than a party you did not want. */}
        <h2 style={h2}>Delete this party</h2>
        <p style={sectionSub}>
          {hasPaid
            ? 'This party has been paid for, so it cannot be deleted — removing it would strand real revenue with no night attached to it. Close the link instead, and refund in Stripe if that is what you mean.'
            : 'Removes the party, its fares, its route and any abandoned checkouts. The link dies with it. This cannot be undone.'}
        </p>
        <div style={routeCard}>
          {hasPaid ? (
            <span style={{ color: '#8a7b68', fontSize: 13 }}>Deleting is disabled while this party has paid riders.</span>
          ) : (
            <DeleteForm
              action={deleteParty.bind(null, event.id)}
              label="Delete this party"
              confirmMessage={`Delete "${event.name}"? The link stops working immediately and this cannot be undone.`}
            />
          )}
        </div>
      </div>
    </main>
  )
}

// One labelled row in the details form. The page is not a FormShell (it is a
// detail view, not a form page), so it carries its own small field shape.
function FieldRow({ label, hint, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{ color: '#6e6154', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      {children}
      {hint && <div style={{ color: '#7d7060', fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>{hint}</div>}
    </label>
  )
}

function Banner({ tone, children }) {
  const ok = tone === 'ok'
  return (
    <div style={{
      background: ok ? 'rgba(63,178,127,0.12)' : 'rgba(196,74,58,0.10)',
      border: `1px solid ${ok ? 'rgba(63,178,127,0.4)' : 'rgba(196,74,58,0.35)'}`,
      color: ok ? '#0f7a4e' : '#b3311f',
      fontSize: 13, fontWeight: 600, padding: '10px 12px', borderRadius: 6, margin: '14px 0 0',
    }}>
      {children}
    </div>
  )
}

const ERRORS = {
  name_required: 'The party needs a name.',
  date_required: 'Pick a valid date.',
  price_required: 'Enter a price above zero.',
  capacity_required: 'A per-person party needs a max rider count, or it can oversell the bus.',
  save_failed: 'Could not save those details. Try again.',
  paid_cannot_delete: 'This party has been paid for and cannot be deleted. Close the link instead.',
  delete_failed: 'Could not delete the party. Try again.',
  no_group: 'This party has no route holder attached, so there is nothing to save the route onto.',
  route_failed: 'Could not save the route. Try again.',
  fares_failed: 'The party was created but its fares were not. It cannot be booked until that is fixed.',
}

const page = { minHeight: '100vh', background: '#faf5ea', color: '#17130f', padding: '24px 16px 64px', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif' }
const backLink = { color: '#6e6154', fontSize: 13, fontWeight: 500, textDecoration: 'none' }
const h1 = { fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', margin: '10px 0 4px' }
const h2 = { fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', margin: '34px 0 4px' }
const sub = { color: '#6e6154', fontSize: 13.5, margin: 0 }
const sectionSub = { color: '#8a7b68', fontSize: 12.5, lineHeight: 1.55, margin: '0 0 12px', maxWidth: 620 }
const statRow = { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginTop: 20 }
const linkCard = { background: 'linear-gradient(180deg, #ffffff, #fdfaf3)', border: '1px solid #e8ddc8', borderRadius: 8, padding: '16px 18px', marginTop: 20 }
const urlCode = { fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 12.5, background: '#efe6d4', padding: '7px 10px', borderRadius: 6, wordBreak: 'break-all' }
const ghostBtn = { background: '#fff', border: '1px solid #e8ddc8', color: '#3b322a', fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 6, textDecoration: 'none' }
const smallBtn = { background: '#fff', border: '1px solid #e8ddc8', color: '#6e6154', fontSize: 12, fontWeight: 600, padding: '6px 11px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }
const dangerBtn = { ...smallBtn, color: '#b3311f', border: '1px solid rgba(196,74,58,0.4)' }
const routeCard = { background: '#fff', border: '1px solid #e8ddc8', borderRadius: 8, padding: '16px 18px' }
const stopRow = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }
const stopNum = { color: '#8a7b68', fontSize: 11, fontWeight: 800, width: 14, flex: '0 0 auto', fontFamily: '"JetBrains Mono", ui-monospace, monospace' }
const stopInput = { flex: 1, minWidth: 0, background: '#fff', border: '1px solid #e8ddc8', borderRadius: 6, padding: '9px 11px', fontSize: 13.5, color: '#17130f', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }
const saveBtn = { background: '#17130f', color: '#faf5ea', fontSize: 13.5, fontWeight: 700, padding: '10px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', marginTop: 8, fontFamily: 'inherit' }
