import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import StatCard from '@/app/(leadership)/_components/StatCard'
import StatusBadge from '@/app/(leadership)/_components/StatusBadge'
import DataTable from '@/app/(leadership)/_components/DataTable'
import { partyUrl, partyPriceCents, hasRoute, isPerPerson, fmtMoney, fmtEventDate, ORGANIZER_FARE } from '@/lib/parties'
import CopyLink from './CopyLink'

export const metadata = { title: 'Private parties' }
export const dynamic = 'force-dynamic'

// The private-party desk. Two questions, in the order they cost money:
//
//   1. Who asked for a night and has not been quoted yet? A request that sits
//      for two days is a booking somebody else got.
//   2. Which sold parties still have no route built? They have paid us and are
//      looking at a page that says "we build the route around you".
//
// Everything else on this page is reference.

export default async function PartiesPage() {
  const sb = supabaseAdmin()

  const partiesRes = await sb
    .from('events')
    .select('id, name, event_date, capacity, access_token, status, created_at, group_id, party_pricing, ticket_types(name, price_cents, active), groups(schedule)')
    .eq('is_private', true)
    .order('event_date', { ascending: false })
    .limit(200)

  if (partiesRes.error) console.error('[admin/parties] parties', partiesRes.error)

  const parties = partiesRes.data || []

  // Paid money per party. A party's order is one Stripe charge on the
  // organizer's seat, so summing paid orders is the real collected number —
  // not the quoted price, which is only what we asked for.
  const partyIds = parties.map(p => p.id)
  let paidByEvent = new Map()
  if (partyIds.length) {
    const { data: orders } = await sb
      .from('orders')
      .select('event_id, total_cents, party_size, status')
      .in('event_id', partyIds)
      .eq('status', 'paid')
    for (const o of orders || []) {
      const cur = paidByEvent.get(o.event_id) || { cents: 0, riders: 0 }
      cur.cents += o.total_cents || 0
      cur.riders += o.party_size || 0
      paidByEvent.set(o.event_id, cur)
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  const partyRows = parties.map(p => {
    const fares = (p.ticket_types || []).filter(t => t.active)
    const paid = paidByEvent.get(p.id) || { cents: 0, riders: 0 }
    return {
      id: p.id,
      name: p.name,
      date: p.event_date,
      upcoming: !!p.event_date && p.event_date >= today,
      quoted: partyPriceCents(fares),
      perPerson: isPerPerson(p),
      collected: paid.cents,
      riders: paid.riders,
      token: p.access_token,
      routeBuilt: hasRoute(p.groups?.schedule),
      status: p.status,
    }
  })

  const upcoming = partyRows.filter(p => p.upcoming)
  const needRoute = upcoming.filter(p => p.collected > 0 && !p.routeBuilt)
  const bookedCents = upcoming.reduce((s, p) => s + p.collected, 0)

  return (
    <main style={page}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Link href="/admin" style={backLink}>← Console</Link>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-end', justifyContent: 'space-between', margin: '10px 0 6px' }}>
          <div>
            <h1 style={h1}>Private parties</h1>
            <p style={sub}>
              Somebody buys the whole shuttle for their own night, picked up wherever
              they want. Nothing here is advertised anywhere on the site — you build
              the party, you send the link, that is the only way in.
            </p>
          </div>
          <Link href="/admin/parties/new" style={primaryBtn}>Build a party</Link>
        </div>

        <div style={statRow}>
          <StatCard label="Upcoming parties" value={String(upcoming.length)} hint="sold and on the calendar" />
          <StatCard label="Booked money" value={fmtMoney(bookedCents)} hint="collected, upcoming nights" />
          <StatCard label="Routes to build" value={String(needRoute.length)} hint={needRoute.length ? 'they have paid and are waiting' : 'none outstanding'} tone={needRoute.length ? 'err' : 'ink'} />
        </div>

        {/* The parties themselves. The link column is the whole point of the
            page: it is what gets pasted into a text message. */}
        <Section title="Parties" hint={`${partyRows.length} built`}>
          <DataTable
            columns={[
              { key: 'name', header: 'Party', primary: true, render: r => (
                <Link href={`/admin/parties/${r.id}`} style={rowLink}>{r.name}</Link>
              ) },
              { key: 'date', header: 'Date', render: r => fmtEventDate(r.date, { weekday: 'short', month: 'short', day: 'numeric' }) },
              { key: 'quoted', header: 'Price', mono: true, render: r => (
                <span>
                  {fmtMoney(r.quoted)}
                  <br />
                  <span style={{ fontSize: 10.5, color: '#8a7b68', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {r.perPerson ? 'per person' : 'whole shuttle'}
                  </span>
                </span>
              ) },
              { key: 'collected', header: 'Collected', mono: true, render: r => r.collected > 0
                ? <span style={{ color: '#0f7a4e', fontWeight: 700 }}>{fmtMoney(r.collected)}</span>
                : <StatusBadge label={r.perPerson ? 'no seats sold' : 'unpaid'} tone="grey" /> },
              { key: 'riders', header: 'Riders', mono: true, render: r => r.riders || '—' },
              { key: 'route', header: 'Route', render: r => r.routeBuilt
                ? <StatusBadge label="built" tone="green" />
                : <StatusBadge label="not built" tone={r.collected > 0 ? 'red' : 'grey'} /> },
              { key: 'link', header: 'Link', render: r => r.token
                ? <CopyLink url={partyUrl(r.token)} />
                : <StatusBadge label="no link" tone="red" title="This party has no link yet. Open it and create one." /> },
            ]}
            rows={partyRows}
            rowKey={r => r.id}
            empty="No parties yet. Build one and you get a link to send."
          />
        </Section>

        <p style={footNote}>
          A party is an ordinary event with <code style={code}>is_private</code> set, so it
          rides the same checkout, waiver, claim links and boarding passes as a Friday
          loop — it is simply never listed. <strong>Whole shuttle</strong>: the organizer
          buys the &ldquo;{ORGANIZER_FARE}&rdquo; seat at the flat price you quoted and
          every guest rides on a $0 seat with their own waiver link.{' '}
          <strong>Per person</strong>: one priced seat the group buys as many times as
          they need, individually or several at a time — capped at the max riders you
          set, because independent buyers cannot see each other&rsquo;s orders.
        </p>
      </div>
    </main>
  )
}

function Section({ title, hint, children }) {
  return (
    <section style={{ marginTop: 34 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <h2 style={h2}>{title}</h2>
        {hint && <span style={{ color: '#8a7b68', fontSize: 12.5 }}>{hint}</span>}
      </div>
      {children}
    </section>
  )
}

const page = { minHeight: '100vh', background: '#faf5ea', color: '#17130f', padding: '24px 16px 64px', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif' }
const backLink = { color: '#6e6154', fontSize: 13, fontWeight: 500, textDecoration: 'none' }
const h1 = { fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', margin: '0 0 4px' }
const h2 = { fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }
const sub = { color: '#6e6154', fontSize: 13.5, lineHeight: 1.55, margin: 0, maxWidth: 560 }
const statRow = { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginTop: 22 }
const primaryBtn = { background: '#17130f', color: '#faf5ea', fontSize: 13.5, fontWeight: 700, padding: '11px 18px', borderRadius: 7, textDecoration: 'none', whiteSpace: 'nowrap' }
const rowLink = { color: '#8a5f0a', fontWeight: 700, textDecoration: 'none', fontSize: 13.5 }
const footNote = { color: '#8a7b68', fontSize: 12.5, lineHeight: 1.6, marginTop: 34, maxWidth: 720 }
const code = { background: '#efe6d4', padding: '1px 5px', borderRadius: 4, fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 12 }
