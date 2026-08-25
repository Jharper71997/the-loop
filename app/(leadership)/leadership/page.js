import Link from 'next/link'
import { getLeadershipHome, formatCents } from '@/lib/leadershipHome'
import { serverNow } from '@/lib/serverNow'
import LiveStamp from '../_components/LiveStamp'
import StatCard from '../_components/StatCard'

export const dynamic = 'force-dynamic'

const FONT_BODY = '-apple-system, "Segoe UI", Roboto, sans-serif'

// How the active loop reads at a glance.
const STATE = {
  upcoming:   { tone: '#9c9ca3', dot: '#9c9ca3', label: 'Next loop',   pulse: false },
  pre_pickup: { tone: '#d4a333', dot: '#d4a333', label: 'Boarding soon', pulse: true },
  in_progress:{ tone: '#3fb27f', dot: '#3fb27f', label: 'On the road',  pulse: true },
  wrapping:   { tone: '#d4a333', dot: '#d4a333', label: 'Wrapping up',  pulse: true },
}

function fmtDate(iso) {
  if (!iso) return ''
  try {
    return new Date(`${iso}T12:00:00-05:00`).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return iso }
}

export default async function LeadershipScoreboard() {
  const { live, week } = await getLeadershipHome()
  const renderedAt = await serverNow()

  return (
    <main style={{
      minHeight: '100vh', background: '#0a0a0b', color: '#e8e8ea',
      padding: '24px 16px calc(48px + env(safe-area-inset-bottom))',
      paddingLeft: 'max(16px, env(safe-area-inset-left))',
      paddingRight: 'max(16px, env(safe-area-inset-right))',
      fontFamily: FONT_BODY,
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <header style={{ marginBottom: 22 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>Scoreboard</h1>
          {/* Faster heartbeat than the old 60s so it actually feels live. */}
          <LiveStamp renderedAt={renderedAt} intervalMs={20000} />
        </header>

        <LiveTonight live={live} />

        <div className="lead-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: live ? 24 : 0 }}>
          <StatCard label="Revenue this week" value={formatCents(week.revenueCents)} tone="ok" mono />
          <StatCard label="Riders this week" value={week.riders.toLocaleString('en-US')} tone="gold" mono />
          <StatCard label="Cash on hand" value={formatCents(week.cashCents)} tone="ink" mono
            hint={week.cashAsOf ? `as of ${fmtDate(week.cashAsOf)}` : 'add at /leadership/cash'} />
          <StatCard label="Active bars" value={week.activeBars} tone="ink" mono />
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 22 }}>
          <Detail href="/leadership/income" label="Income detail" />
          <Detail href="/leadership/ridership" label="Ridership by bar" />
          <Detail href="/leadership/passes" label="Loop Pass" />
          <Detail href="/leadership/referrals" label="Referrals" />
          <Detail href="/leadership/comps" label="Free / comped rides" />
        </div>

        <style>{`
          @keyframes leadpulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.82); } }
          @media (max-width: 760px) { .lead-grid { grid-template-columns: repeat(2, 1fr) !important; } }
          @media (max-width: 380px) { .lead-grid { grid-template-columns: 1fr !important; } }
        `}</style>
      </div>
    </main>
  )
}

function LiveTonight({ live }) {
  if (!live) {
    return (
      <div style={{
        background: 'linear-gradient(180deg, #121216, #0d0d10)', border: '1px solid #2a2a31',
        borderRadius: 12, padding: '18px 20px', color: '#9c9ca3', fontSize: 14, marginBottom: 4,
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
        background: 'linear-gradient(180deg, #15151c, #101015)',
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
          <span style={{ marginLeft: 'auto', color: '#6f6f76', fontSize: 12 }}>Tap for ops →</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>{live.name}</h2>
          <span style={{ color: s.tone, fontSize: 13, fontWeight: 600 }}>{s.label}</span>
        </div>
        {where && <div style={{ color: '#c8c8cc', fontSize: 14, marginTop: 4 }}>{where}</div>}

        <div style={{ display: 'flex', gap: 26, marginTop: 14, flexWrap: 'wrap' }}>
          <LiveStat label={isUpcoming ? 'Pre-sold' : 'Collected'} value={formatCents(live.revenueCents)} tone="#3fb27f" />
          <LiveStat label="Riders booked" value={live.riders} tone="#e8e8ea" />
          {live.waitlist > 0 && <LiveStat label="On waitlist" value={live.waitlist} tone="#d4a333" />}
          {live.stopCount > 0 && (
            <LiveStat
              label="Stops"
              value={live.state === 'in_progress' && live.currentStopIndex != null
                ? `${live.currentStopIndex + 1}/${live.stopCount}`
                : live.stopCount}
              tone="#9c9ca3"
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
      <div style={{ color: '#9c9ca3', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', marginTop: 3 }}>
        {label}
      </div>
    </div>
  )
}

function Detail({ href, label }) {
  return (
    <Link href={href} style={{
      color: '#9c9ca3', fontSize: 13, textDecoration: 'none',
      borderBottom: '1px solid #2a2a31', paddingBottom: 2,
    }}>
      {label} →
    </Link>
  )
}
