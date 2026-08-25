import Link from 'next/link'
import { getLeadershipHome, formatCents } from '@/lib/leadershipHome'
import { serverNow } from '@/lib/serverNow'
import LiveStamp from '../_components/LiveStamp'
import StatCard from '../_components/StatCard'

export const dynamic = 'force-dynamic'

const FONT_BODY = '-apple-system, "Segoe UI", Roboto, sans-serif'

// How the active loop reads at a glance.
const STATE = {
  upcoming:   { tone: '#6e6154', dot: '#6e6154', label: 'Next loop',   pulse: false },
  pre_pickup: { tone: '#8a5f0a', dot: '#d4a333', label: 'Boarding soon', pulse: true },
  in_progress:{ tone: '#0f7a4e', dot: '#2fa36b', label: 'On the road',  pulse: true },
  wrapping:   { tone: '#8a5f0a', dot: '#d4a333', label: 'Wrapping up',  pulse: true },
}

// Bar and sponsor subscriptions bill monthly through Stripe, but whatever used
// to copy them into sponsor_payments / bar_payments stopped: newest rows are
// 2026-05-28 and 2026-06-14, while Stripe kept collecting. Until that is fixed
// the Money pages will show partners as unpaid months after they paid, so say
// so here rather than let the tables be read as truth.
function SyncWarning({ sync }) {
  if (!sync?.stale) return null
  const parts = []
  if (sync.sponsorAgeDays != null) parts.push(`sponsors ${sync.sponsorAgeDays}d`)
  if (sync.barAgeDays != null) parts.push(`bars ${sync.barAgeDays}d`)
  return (
    <div style={{
      background: '#fdeae6', border: '1px solid #d8543f', borderRadius: 10,
      padding: '12px 14px', marginBottom: 16, fontSize: 13.5, color: '#b3311f',
    }}>
      <strong style={{ fontWeight: 800 }}>Bar and sponsor payments have stopped syncing from Stripe.</strong>
      {' '}Last recorded {parts.join(', ')} ago, but Stripe is still charging them monthly. Money in (right) is read
      straight from Stripe and is correct; the Bars, Sponsors and Money pages are not, and will show partners as
      unpaid until this is reconnected.
    </div>
  )
}

// "Fri Aug 21 + Sat Aug 22" — a weekend reads as its nights, not as a range.
function nightsLabel(dates) {
  if (!dates || !dates.length) return ''
  return dates.map(fmtDate).join(' + ')
}

// A balance nobody has updated since May is not "cash on hand", it is a number
// from May. Say how old it is so it can't quietly pass for current.
function cashHint({ cashCents, cashAsOf, cashAgeDays }) {
  if (cashCents == null) return 'never recorded — add it in Money → Cash on hand'
  if (cashAsOf == null) return 'date unknown'
  const age = cashAgeDays == null ? '' : ` · ${cashAgeDays} days old`
  return `as of ${fmtDate(cashAsOf)}${age}`
}

function fmtDate(iso) {
  if (!iso) return ''
  try {
    // Loop dates are bare YYYY-MM-DD and want noon ET so they can't slip a day.
    // A bank balance is already a full timestamp — pinning noon onto it produced
    // an invalid date, which the catch below quietly rendered as raw ISO.
    const d = String(iso).length > 10 ? new Date(iso) : new Date(`${iso}T12:00:00-05:00`)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return iso }
}

export default async function LeadershipScoreboard() {
  const { live, weekend, money, sync } = await getLeadershipHome()
  const renderedAt = await serverNow()

  return (
    <main style={{
      minHeight: '100vh', background: '#faf5ea', color: '#17130f',
      padding: '24px 16px calc(48px + env(safe-area-inset-bottom))',
      paddingLeft: 'max(16px, env(safe-area-inset-left))',
      paddingRight: 'max(16px, env(safe-area-inset-right))',
      fontFamily: FONT_BODY,
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <header style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Back office</h1>
          <p style={{ color: '#6e6154', fontSize: 13.5, margin: '4px 0 0' }}>
            The week so far, and every page that isn&apos;t about tonight.
          </p>
          {/* Faster heartbeat than the old 60s so it actually feels live. */}
          <LiveStamp renderedAt={renderedAt} intervalMs={20000} />
        </header>

        <SyncWarning sync={sync} />

        <LiveTonight live={live} />

        {/* Weekend-shaped, not calendar-shaped. The Loop runs Fri + Sat, so a
            Mon-to-Sun window reads zero five days out of seven — which is what
            made this page look broken on a Tuesday. */}
        <div className="lead-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: live ? 24 : 0 }}>
          <StatCard
            label="Riders last weekend"
            value={weekend.last.riders.toLocaleString('en-US')}
            tone={weekend.last.riders ? 'gold' : 'dim'}
            hint={nightsLabel(weekend.last.dates) || 'no loop on record'}
            mono
          />
          <StatCard
            label="Money in · 30 days"
            value={money.ok ? formatCents(money.grossCents) : '—'}
            tone={money.ok ? (money.grossCents ? 'ok' : 'dim') : 'err'}
            hint={
              money.ok
                ? `subscriptions ${formatCents(money.subsCents)} · tickets ${formatCents(money.ticketsCents)} · Stripe only, not Ticket Tailor`
                : 'Stripe did not answer — no number is better than a wrong one'
            }
            mono
          />
          <StatCard
            label="Sold this weekend"
            value={weekend.coming.riders.toLocaleString('en-US')}
            tone={weekend.coming.riders ? 'gold' : 'err'}
            hint={
              weekend.coming.dates.length
                ? (weekend.coming.riders
                    ? `${nightsLabel(weekend.coming.dates)} · ${formatCents(weekend.coming.revenueCents)} booked`
                    : `nothing sold yet for ${nightsLabel(weekend.coming.dates)}`)
                : 'no loop on the books — build one in Loops'
            }
            mono
          />
          <StatCard
            label="Cash on hand"
            value={formatCents(weekend.cashCents)}
            tone={weekend.cashAgeDays != null && weekend.cashAgeDays > 45 ? 'err' : 'ink'}
            hint={cashHint(weekend)}
            mono
          />
        </div>

        <Directory />

        <style>{`
          @keyframes leadpulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.82); } }
          @media (max-width: 760px) { .lead-grid { grid-template-columns: repeat(2, 1fr) !important; } }
          @media (max-width: 380px) { .lead-grid { grid-template-columns: 1fr !important; } }
          @media (max-width: 900px) { .dir-grid { grid-template-columns: repeat(2, 1fr) !important; } }
          @media (max-width: 560px) { .dir-grid { grid-template-columns: 1fr !important; } }
        `}</style>
      </div>
    </main>
  )
}

function LiveTonight({ live }) {
  if (!live) {
    return (
      <div style={{
        background: 'linear-gradient(180deg, #ffffff, #fdfaf3)', border: '1px solid #e8ddc8',
        borderRadius: 12, padding: '18px 20px', color: '#6e6154', fontSize: 14, marginBottom: 4,
      }}>
        No loop running right now. The next scheduled loop shows here once it&rsquo;s set up.
      </div>
    )
  }

  const s = STATE[live.state] || STATE.upcoming
  const isUpcoming = live.state === 'upcoming'

  // The single most useful "where are we" line.
  let where = null
  if (live.state === 'in_progress') {
    where = live.currentStopName
      ? `Now at ${live.currentStopName}${live.nextStopName ? ` · next: ${live.nextStopName}${live.nextStopTime ? ` ${live.nextStopTime}` : ''}` : ''}`
      : 'On the road'
  } else if (live.state === 'pre_pickup') {
    where = live.nextStopName
      ? `First pickup: ${live.nextStopName}${live.nextStopTime ? ` at ${live.nextStopTime}` : ''}`
      : 'Getting ready to roll'
  } else if (live.state === 'wrapping') {
    where = 'Last stop done — close out when ready'
  } else {
    where = fmtDate(live.eventDate)
  }

  return (
    <Link href="/admin" style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
      <div style={{
        background: 'linear-gradient(180deg, #ffffff, #fdfaf3)',
        border: `1px solid ${s.tone}55`,
        borderRadius: 14,
        padding: '18px 20px',
        boxShadow: `0 0 0 1px ${s.tone}18, 0 14px 40px rgba(0,0,0,0.4)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <span style={{
            width: 9, height: 9, borderRadius: '50%', background: s.dot,
            boxShadow: `0 0 10px ${s.dot}`,
            animation: s.pulse ? 'leadpulse 1.6s ease-in-out infinite' : 'none',
          }} />
          <span style={{ color: s.tone, fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            {isUpcoming ? 'Next loop' : 'Live now'}
          </span>
          <span style={{ marginLeft: 'auto', color: '#7d7060', fontSize: 12 }}>Tap for ops →</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{live.name}</h2>
          <span style={{ color: s.tone, fontSize: 13, fontWeight: 600 }}>{s.label}</span>
        </div>
        {where && <div style={{ color: '#3b322a', fontSize: 14, marginTop: 4 }}>{where}</div>}

        <div style={{ display: 'flex', gap: 26, marginTop: 14, flexWrap: 'wrap' }}>
          <LiveStat label={isUpcoming ? 'Pre-sold' : 'Collected'} value={formatCents(live.revenueCents)} tone="#2fa36b" />
          <LiveStat label="Riders booked" value={live.riders} tone="#17130f" />
          {live.waitlist > 0 && <LiveStat label="On waitlist" value={live.waitlist} tone="#d4a333" />}
          {live.stopCount > 0 && (
            <LiveStat
              label="Stops"
              value={live.state === 'in_progress' && live.currentStopIndex != null
                ? `${live.currentStopIndex + 1}/${live.stopCount}`
                : live.stopCount}
              tone="#6e6154"
            />
          )}
        </div>
      </div>
    </Link>
  )
}

function LiveStat({ label, value, tone }) {
  return (
    <div>
      <div style={{ fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: 26, fontWeight: 800, color: tone, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ color: '#6e6154', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 3 }}>
        {label}
      </div>
    </div>
  )
}

// The sidebar carries six entries now, all of them about running a night. That
// left every back-office page without a link, so they live here instead: one
// index, grouped by the question it answers. Nothing was deleted and no URL
// moved — this is the door they are all behind.
const GROUPS = [
  {
    title: 'Money',
    items: [
      ['/leadership/income', 'Income'],
      ['/leadership/expenses', 'Expenses'],
      ['/leadership/cash', 'Cash on hand'],
      ['/leadership/merch', 'Merch'],
      ['/leadership/profit-first', 'Profit First'],
      ['/admin/finance', 'Ledger entries'],
    ],
  },
  {
    title: 'Bars & sponsors',
    items: [
      ['/leadership/bars', 'Bars'],
      ['/leadership/sponsors', 'Sponsors'],
      ['/leadership/comps', 'Free / comped rides'],
    ],
  },
  {
    title: 'Riders',
    items: [
      ['/leadership/ridership', 'Ridership by bar'],
      ['/leadership/feedback', 'Feedback'],
      ['/leadership/leaderboard', 'Leaderboard'],
      ['/leadership/referrals', 'Referrals'],
      ['/leadership/passes', 'Loop Pass'],
    ],
  },
  {
    title: 'Loops & season',
    items: [
      ['/leadership/loops', 'Loop P&L'],
      ['/leadership/schedule', 'Season'],
      ['/leadership/drivers', 'Drivers'],
      ['/leadership/drivers/route-log', 'Route log'],
    ],
  },
  {
    title: 'Setup',
    items: [
      ['/leadership/automations', 'Automations'],
      ['/leadership/alerts', 'Alerts'],
      ['/leadership/attribution', 'Flyer tracking'],
    ],
  },
]

function Directory() {
  return (
    <div className="dir-grid" style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 26,
    }}>
      {GROUPS.map(g => (
        <div key={g.title} style={{
          background: '#ffffff', border: '1px solid #e8ddc8', borderRadius: 12, padding: '14px 16px 16px',
        }}>
          <div style={{
            color: '#8a5f0a', fontSize: 10, fontWeight: 800,
            letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10,
          }}>
            {g.title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {g.items.map(([href, label]) => (
              <Link key={href} href={href} style={{
                color: '#3b322a', fontSize: 13.5, fontWeight: 600, textDecoration: 'none',
                padding: '7px 8px', borderRadius: 8, display: 'block',
              }}>
                {label}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
