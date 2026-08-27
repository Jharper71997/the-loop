import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import StatCard from '../../../_components/StatCard'
import StatusBadge from '../../../_components/StatusBadge'
import DataTable from '../../../_components/DataTable'
import { PUBLIC_PARTNER_BARS } from '@/lib/bars'
import { partyUrl, partyPriceCents, mintPartyToken, fmtMoney, fmtTime, fmtEventDate } from '@/lib/parties'
import CopyLink from '../CopyLink'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Party — The Loop' }

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
    redirect(`/leadership/parties/${eventId}?error=no_group`)
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
    console.error('[parties/route] save failed', error)
    redirect(`/leadership/parties/${eventId}?error=route_failed`)
  }

  // The first stop is when the night actually starts, so keep the event's own
  // pickup_time honest with it rather than leaving the rough number we typed
  // when we sold the party.
  const first = schedule.find(s => s.start_time)
  if (first) {
    await sb.from('events').update({ pickup_time: first.start_time }).eq('id', eventId)
    await sb.from('groups').update({ pickup_time: first.start_time }).eq('id', ev.group_id)
  }

  revalidatePath(`/leadership/parties/${eventId}`)
  revalidatePath('/leadership/parties')
  redirect(`/leadership/parties/${eventId}?saved=route`)
}

async function rotateToken(formData) {
  'use server'
  const eventId = String(formData.get('event_id') || '')
  if (!eventId) return
  const sb = supabaseAdmin()
  const { data: ev } = await sb.from('events').select('id, name, is_private').eq('id', eventId).maybeSingle()
  if (!ev?.is_private) redirect('/leadership/parties')

  // Killing a leaked link. The old token stops resolving the moment this
  // writes, which is the entire point — anyone holding it gets the same 404 as
  // a stranger. Only do this before they have paid, or you have just 404'd a
  // customer who is trying to reach their own booking page.
  await sb.from('events').update({ access_token: mintPartyToken(ev.name) }).eq('id', eventId)
  revalidatePath(`/leadership/parties/${eventId}`)
  redirect(`/leadership/parties/${eventId}?saved=token`)
}

async function setStatus(formData) {
  'use server'
  const eventId = String(formData.get('event_id') || '')
  const status = String(formData.get('status') || '')
  if (!eventId || !['on_sale', 'draft'].includes(status)) return
  const sb = supabaseAdmin()
  await sb.from('events').update({ status }).eq('id', eventId).eq('is_private', true)
  revalidatePath(`/leadership/parties/${eventId}`)
  redirect(`/leadership/parties/${eventId}?saved=status`)
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

  const url = event.access_token ? partyUrl(event.access_token) : null
  const saved = typeof sp?.saved === 'string' ? sp.saved : null
  const error = typeof sp?.error === 'string' ? sp.error : null
  const created = sp?.created === '1'

  return (
    <main style={page}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Link href="/leadership/parties" style={backLink}>← All parties</Link>

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
        {saved === 'token' && <Banner tone="ok">New link minted. The old one is dead.</Banner>}
        {saved === 'status' && <Banner tone="ok">Status updated.</Banner>}
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
              This party has no token — it predates the private-party build. Mint one below.
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            <form action={rotateToken}>
              <input type="hidden" name="event_id" value={event.id} />
              <button type="submit" style={smallBtn}>{url ? 'Mint a new link' : 'Mint a link'}</button>
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
        <h2 style={h2}>Their route</h2>
        <p style={sectionSub}>
          Leave a row blank to drop that stop. The first time you enter becomes the
          party&rsquo;s pickup time. This shows up on their page the moment you save.
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
                  placeholder={i === 0 ? 'Pickup (bar or address)' : 'Stop'}
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
      </div>
    </main>
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
const routeCard = { background: '#fff', border: '1px solid #e8ddc8', borderRadius: 8, padding: '16px 18px' }
const stopRow = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }
const stopNum = { color: '#8a7b68', fontSize: 11, fontWeight: 800, width: 14, flex: '0 0 auto', fontFamily: '"JetBrains Mono", ui-monospace, monospace' }
const stopInput = { flex: 1, minWidth: 0, background: '#fff', border: '1px solid #e8ddc8', borderRadius: 6, padding: '9px 11px', fontSize: 13.5, color: '#17130f', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }
const saveBtn = { background: '#17130f', color: '#faf5ea', fontSize: 13.5, fontWeight: 700, padding: '10px 18px', borderRadius: 7, border: 'none', cursor: 'pointer', marginTop: 8, fontFamily: 'inherit' }
