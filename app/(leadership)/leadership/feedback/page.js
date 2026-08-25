import { supabaseAdmin } from '@/lib/supabaseAdmin'
import StatCard from '../../_components/StatCard'
import DataTable from '../../_components/DataTable'

export const metadata = { title: 'Rider Feedback — The Loop' }
export const dynamic = 'force-dynamic'

// Read surface for the morning-after survey (/feedback/<token>, sent by
// /api/cron/ride-feedback). Four questions get answered here:
//   1. Are we good? — overall average, and driver / bars / timing split out so
//      a soft week points at the thing that actually caused it.
//   2. Which bars are carrying the route? — favorite-stop counts, which is the
//      number that belongs in a partner's retention conversation.
//   3. Who is riding and where did they come from? — group mix and source mix.
//   4. Who raised a hand? — riders who ticked charter / company / merch, with
//      contact info. That is a follow-up list, not a chart.
//
// Review clicks are taps through to the Google listing, not confirmed reviews.
// Google gives us no way to tie a review back to a rider, so this is intent.

const GOLD = '#d4a333'
const GOLD_TXT = '#8a5f0a'
const INK_DIM = '#6e6154'
const WINDOW_DAYS = 90

const RIDE_AGAIN_LABEL = { yes: 'Definitely', maybe: 'Maybe', no: 'Probably not' }

export default async function FeedbackPage() {
  const sb = supabaseAdmin()
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data: feedback, error: fbErr } = await sb
    .from('ride_feedback')
    .select('id, rating, driver_rating, bars_rating, timing_rating, favorite_bar, ride_again, comment, group_type, heard_about, interests, email, marketing_opt_in, review_clicked_at, created_at, event_id, contact_id')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(2000)

  // 42P01 = relation does not exist. This tab ships in the console nav before
  // sql/047 has necessarily been run, and a 500 on a nav tab reads as "the admin
  // is broken" rather than "one migration is pending". Same treatment as the
  // automations page.
  if (fbErr?.code === '42P01') return <MigrationPending />

  const rows = feedback || []

  // Send volume over the same window, so the response rate is honest about how
  // many riders were actually asked rather than how many answered.
  const { count: askedCount } = await sb
    .from('order_items')
    .select('id', { count: 'exact', head: true })
    .gte('feedback_sent_at', since)

  const eventIds = [...new Set(rows.map(r => r.event_id).filter(Boolean))]
  const { data: events } = eventIds.length
    ? await sb.from('events').select('id, event_date').in('id', eventIds)
    : { data: [] }
  const eventById = new Map((events || []).map(e => [e.id, e]))

  const contactIds = [...new Set(rows.map(r => r.contact_id).filter(Boolean))]
  const { data: contacts } = contactIds.length
    ? await sb.from('contacts').select('id, first_name, last_name, phone, email').in('id', contactIds)
    : { data: [] }
  const contactById = new Map((contacts || []).map(c => [c.id, c]))

  const rated = rows.filter(r => r.rating != null)
  const promoters = rated.filter(r => r.rating >= 4).length
  const detractors = rated.filter(r => r.rating <= 3).length
  const reviewClicks = rows.filter(r => r.review_clicked_at).length
  const responseRate = askedCount ? Math.round((rows.length / askedCount) * 100) : null
  const wouldRideAgain = rows.filter(r => r.ride_again === 'yes').length
  const answeredRideAgain = rows.filter(r => r.ride_again).length

  const aspects = [
    { key: 'rating', label: 'Overall' },
    { key: 'driver_rating', label: 'Driver' },
    { key: 'bars_rating', label: 'Bar lineup' },
    { key: 'timing_rating', label: 'Timing and waits' },
  ].map(a => {
    const vals = rows.map(r => r[a.key]).filter(v => v != null)
    return {
      key: a.key,
      label: a.label,
      avg: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null,
      n: vals.length,
    }
  })
  const overall = aspects[0]

  const barRows = tally(rows, r => r.favorite_bar).map(([bar, votes]) => ({ key: bar, bar, votes }))
  const topBarVotes = barRows[0]?.votes || 0
  const heardRows = tally(rows, r => r.heard_about).map(([source, votes]) => ({ key: source, source, votes }))
  const groupRows = tally(rows, r => r.group_type).map(([group, votes]) => ({ key: group, group, votes }))

  // Interests are multi-select, so they tally per selection, not per response.
  const interestCounts = new Map()
  for (const r of rows) {
    for (const i of r.interests || []) {
      interestCounts.set(i, (interestCounts.get(i) || 0) + 1)
    }
  }
  const interestRows = [...interestCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([interest, votes]) => ({ key: interest, interest, votes }))

  // The follow-up list. Anyone who ticked something worth a phone call.
  const handRaisers = rows
    .filter(r => (r.interests || []).length > 0)
    .slice(0, 100)
    .map(r => {
      const c = contactById.get(r.contact_id) || {}
      return {
        key: r.id,
        name: [c.first_name, c.last_name].filter(Boolean).join(' ') || '(unknown rider)',
        contact: c.phone || r.email || c.email || '—',
        wants: (r.interests || []).join(', '),
        rating: r.rating ?? '—',
      }
    })

  const commentRows = rows
    .filter(r => r.comment)
    .slice(0, 100)
    .map(r => ({
      key: r.id,
      when: eventById.get(r.event_id)?.event_date || r.created_at.slice(0, 10),
      rating: r.rating ?? '—',
      again: RIDE_AGAIN_LABEL[r.ride_again] || '—',
      comment: r.comment,
      low: r.rating != null && r.rating <= 3,
    }))

  return (
    <main style={mainStyle}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={headerRow}>
          <h1 style={h1Style}>Rider feedback</h1>
        </div>

        <p style={introStyle}>
          Last {WINDOW_DAYS} days. Sent the morning after each Loop to everyone who boarded — toggle it at{' '}
          <a href="/leadership/automations" style={{ color: GOLD_TXT, textDecoration: 'none' }}>Automations</a>.
          Ratings of 3 or below raise an{' '}
          <a href="/leadership/alerts" style={{ color: GOLD_TXT, textDecoration: 'none' }}>alert</a> the moment they land.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 22 }}>
          <StatCard label="Avg rating" value={overall.avg == null ? '—' : overall.avg.toFixed(2)} tone="gold" />
          <StatCard label="Responses" value={rows.length} />
          <StatCard label="Response rate" value={responseRate == null ? '—' : `${responseRate}%`} />
          <StatCard label="4-5 star" value={promoters} tone="ok" />
          <StatCard label="3 or below" value={detractors} tone={detractors > 0 ? 'err' : 'ok'} />
          <StatCard
            label="Would ride again"
            value={answeredRideAgain ? `${Math.round((wouldRideAgain / answeredRideAgain) * 100)}%` : '—'}
            tone="ok"
          />
          <StatCard label="Review clicks" value={reviewClicks} tone="gold" />
        </div>

        <Section title="Where the score comes from">
          <DataTable
            columns={[
              { key: 'label', header: 'Aspect', primary: true },
              { key: 'avg', header: 'Avg', mono: true, align: 'right', render: r => r.avg == null ? '—' : r.avg.toFixed(2) },
              { key: 'n', header: 'Answers', mono: true, align: 'right', hideOnMobile: true },
              { key: 'bar', header: '', hideOnMobile: true, render: r => <Meter pct={r.avg ? (r.avg / 5) * 100 : 0} /> },
            ]}
            rows={aspects}
            rowKey={r => r.key}
            empty={<Empty>No ratings yet.</Empty>}
          />
        </Section>

        <Section title="Favorite stop">
          <DataTable
            columns={[
              { key: 'bar', header: 'Bar', primary: true },
              { key: 'votes', header: 'Votes', mono: true, align: 'right' },
              { key: 'share', header: '', hideOnMobile: true, render: r => <Meter pct={topBarVotes ? (r.votes / topBarVotes) * 100 : 0} /> },
            ]}
            rows={barRows}
            rowKey={r => r.key}
            empty={<Empty>No favorite-stop answers yet.</Empty>}
          />
        </Section>

        <Section title="Who is riding">
          <DataTable
            columns={[
              { key: 'group', header: 'Rode with', primary: true },
              { key: 'votes', header: 'Riders', mono: true, align: 'right' },
            ]}
            rows={groupRows}
            rowKey={r => r.key}
            empty={<Empty>No answers yet.</Empty>}
          />
        </Section>

        <Section title="How they heard about us">
          <DataTable
            columns={[
              { key: 'source', header: 'Source', primary: true },
              { key: 'votes', header: 'Riders', mono: true, align: 'right' },
            ]}
            rows={heardRows}
            rowKey={r => r.key}
            empty={<Empty>No answers yet.</Empty>}
          />
        </Section>

        <Section title="Hands raised — worth a call">
          <DataTable
            columns={[
              { key: 'name', header: 'Rider', primary: true },
              { key: 'contact', header: 'Reach them', mono: true },
              { key: 'wants', header: 'Asked about' },
              { key: 'rating', header: '★', mono: true, align: 'right', hideOnMobile: true },
            ]}
            rows={handRaisers}
            rowKey={r => r.key}
            empty={<Empty>Nobody has ticked an interest yet.</Empty>}
          />
          {interestRows.length > 0 && (
            <p style={{ ...introStyle, margin: '-12px 0 0' }}>
              Totals: {interestRows.map(r => `${r.interest} (${r.votes})`).join(' · ')}
            </p>
          )}
        </Section>

        <Section title="What they said">
          <DataTable
            columns={[
              { key: 'when', header: 'Loop', mono: true },
              {
                key: 'rating', header: '★', mono: true, align: 'right',
                render: r => <span style={{ color: r.low ? '#b3311f' : GOLD_TXT, fontWeight: 700 }}>{r.rating}</span>,
              },
              { key: 'again', header: 'Again?', hideOnMobile: true },
              { key: 'comment', header: 'Comment', primary: true },
            ]}
            rows={commentRows}
            rowKey={r => r.key}
            empty={<Empty>No written comments yet.</Empty>}
          />
        </Section>
      </div>
    </main>
  )
}

function MigrationPending() {
  return (
    <main style={mainStyle}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <h1 style={h1Style}>Rider feedback</h1>
        <div style={{
          marginTop: 16, padding: '14px 16px', borderRadius: 10,
          background: 'rgba(212,163,51,0.10)', border: '1px solid rgba(212,163,51,0.35)',
        }}>
          <p style={{ ...introStyle, margin: 0, color: '#17130f' }}>
            <strong>One migration left to run.</strong> Paste{' '}
            <code style={{ color: GOLD_TXT }}>sql/047_ride_feedback.sql</code> into the Supabase SQL editor and
            reload this page. Until then no survey can send and nothing is being collected.
          </p>
        </div>
      </div>
    </main>
  )
}

// Count non-null values of `pick` across rows, biggest first, ties by name so
// the order is stable between renders.
function tally(rows, pick) {
  const counts = new Map()
  for (const r of rows) {
    const v = pick(r)
    if (!v) continue
    counts.set(v, (counts.get(v) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
}

function Meter({ pct }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: 'rgba(23,19,15,0.06)', minWidth: 80 }}>
      <div style={{ height: 6, borderRadius: 3, width: `${Math.max(0, Math.min(100, pct))}%`, background: GOLD }} />
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 26 }}>
      <div style={{
        color: GOLD_TXT, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase',
        fontWeight: 700, marginBottom: 10,
      }}>
        {title}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }) {
  return <div style={{ color: INK_DIM, fontSize: 13, padding: '20px 0' }}>{children}</div>
}

const mainStyle = {
  minHeight: '100vh',
  background: '#faf5ea',
  color: '#17130f',
  padding: '24px 16px calc(48px + env(safe-area-inset-bottom))',
  paddingLeft: 'max(16px, env(safe-area-inset-left))',
  paddingRight: 'max(16px, env(safe-area-inset-right))',
  fontFamily: 'inherit',
}
const headerRow = {
  display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
  gap: 12, flexWrap: 'wrap', marginBottom: 18,
}
const h1Style = {
  color: '#17130f', fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
  fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: 0,
}
const introStyle = {
  color: INK_DIM, fontSize: 13, margin: '0 0 18px', maxWidth: 680,
  fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif', lineHeight: 1.6,
}
