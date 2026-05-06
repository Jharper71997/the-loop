import { supabaseAdmin } from '@/lib/supabaseAdmin'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Automations · Leadership' }

const ACCENT = '#d4a333'
const ACCENT_HI = '#f0c24a'
const SURFACE = '#15151a'
const BORDER = 'rgba(255,255,255,0.08)'
const INK = '#f5f5f7'
const INK_DIM = '#9c9ca3'

// Read-only inventory of every automated send / job / webhook in the Loop
// app. Source of truth here is the code; this page is just a window so
// Jacob can see at a glance what's firing without spelunking through
// finalizeBooking + vercel.json + middleware. Status badges:
//   ON      — runs automatically, currently active
//   OFF     — codepath disabled (commented out, gated, or never wired)
//   MANUAL  — only fires when an operator/user explicitly clicks send
//   STRIPE  — managed externally (Stripe sends it, we don't)

const AUTOMATIONS = [
  {
    section: 'Booking confirmations (post-payment)',
    rows: [
      { name: 'Buyer SMS',                 channel: 'SMS',   trigger: 'Stripe webhook → finalizeBooking',   status: 'ON',     where: 'lib/booking.js sendBookingConfirmation' },
      { name: 'Buyer email',               channel: 'Email', trigger: 'Stripe webhook → finalizeBooking',   status: 'ON',     where: 'lib/booking.js sendEmail (booking template)' },
      { name: 'Buyer push notification',   channel: 'Push',  trigger: 'Stripe webhook → finalizeBooking',   status: 'ON',     where: 'lib/push.js sendPushToContact' },
      { name: 'Per-rider SMS',             channel: 'SMS',   trigger: 'Stripe webhook → finalizeBooking',   status: 'ON',     where: 'lib/booking.js sendRiderConfirmation' },
      { name: 'Per-rider email',           channel: 'Email', trigger: 'Stripe webhook → finalizeBooking',   status: 'ON',     where: 'lib/booking.js sendEmail (booking template)' },
      { name: 'Per-rider push',            channel: 'Push',  trigger: 'Stripe webhook → finalizeBooking',   status: 'ON',     where: 'lib/push.js sendPushToContact' },
      { name: 'Self-serve resend',         channel: 'Both',  trigger: '/my-tickets resend button',           status: 'MANUAL', where: 'app/api/my-tickets/resend/route.js' },
    ],
  },
  {
    section: 'Waivers',
    rows: [
      { name: 'Daily waiver-nudge cron',   channel: 'SMS',   trigger: 'Vercel cron',                          status: 'OFF',    where: 'app/api/cron/waiver-nudge/route.js (not in vercel.json)' },
      { name: 'Manual waiver nudge',       channel: 'SMS',   trigger: 'Admin Waivers panel button',           status: 'MANUAL', where: 'admin Waivers UI' },
      { name: 'Waiver text update',        channel: 'DB',    trigger: 'sql migration',                        status: 'ON',     where: 'sql/023_waiver_v2_full_text.sql' },
    ],
  },
  {
    section: 'Refunds & voids',
    rows: [
      { name: 'Refund receipt',            channel: 'Email', trigger: 'Stripe charge.refunded',               status: 'STRIPE', where: 'Stripe sends, not us' },
      { name: 'Refund SMS',                channel: 'SMS',   trigger: 'Stripe charge.refunded',               status: 'OFF',    where: 'app/api/stripe-webhook/route.js (handler removed 2026-05-02)' },
      { name: 'Void/seat-cancel SMS',      channel: 'SMS',   trigger: 'Admin voids an order item',            status: 'OFF',    where: 'app/api/order-items/[id]/void/route.js' },
    ],
  },
  {
    section: 'Crons (vercel.json)',
    rows: [
      { name: 'Cleanup pending orders',    channel: 'Job',   trigger: 'Daily 9:00 UTC',                       status: 'ON',     where: '/api/cron/cleanup-pending' },
      { name: 'Alert on failures digest',  channel: 'Email', trigger: 'Daily 9:00 UTC',                       status: 'ON',     where: '/api/cron/alert-on-failures → jacob@jvillebrewloop.com' },
      { name: '1-hour pickup reminder',    channel: 'Both',  trigger: 'Every 10 min, 55-70 min before stop', status: 'ON',     where: '/api/cron/ticket-reminder → SMS + email per rider' },
    ],
  },
  {
    section: 'Inbound webhooks',
    rows: [
      { name: 'Stripe checkout.completed', channel: 'Webhook', trigger: 'Stripe',                              status: 'ON',     where: 'app/api/stripe-webhook/route.js → finalizeBooking' },
      { name: 'Stripe charge.refunded',    channel: 'Webhook', trigger: 'Stripe',                              status: 'ON',     where: 'app/api/stripe-webhook/route.js → handleRefund' },
      { name: 'Ticket Tailor order',       channel: 'Webhook', trigger: 'Ticket Tailor',                       status: 'ON',     where: 'app/api/ticket-tailor-webhook/route.js' },
    ],
  },
  {
    section: 'Tracking & attribution',
    rows: [
      { name: 'Shuttle ping ingest',       channel: 'API',   trigger: 'Driver page broadcasting GPS',          status: 'ON',     where: '/api/shuttle/ping' },
      { name: 'QR scan attribution',       channel: 'API',   trigger: '/r/<code> redirect',                    status: 'ON',     where: 'app/r/[code]/route.js' },
      { name: 'Bartender code attribution',channel: 'API',   trigger: 'Checkout form bartender_code field',    status: 'ON',     where: 'app/api/checkout/route.js → bartenders.share_code' },
    ],
  },
  {
    section: 'Manual blast tools',
    rows: [
      { name: 'Tonight SMS broadcast',     channel: 'SMS',   trigger: 'Admin Tonight page button',            status: 'MANUAL', where: 'admin SmsBroadcast component' },
      { name: 'Per-loop rider broadcast',  channel: 'SMS',   trigger: 'Admin loop page button',                status: 'MANUAL', where: 'admin loop UI' },
    ],
  },
]

export default async function AutomationsPage() {
  // Pull last 30 days of webhook + alert activity so each row can show an
  // honest "last fired" rather than just the policy. Best-effort — if either
  // query fails we still render the static inventory.
  let recentWebhooks = []
  let recentAlerts = []
  try {
    const sb = supabaseAdmin()
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const [w, a] = await Promise.all([
      sb.from('webhook_events').select('event_type, status, processed_at').gte('processed_at', since).order('processed_at', { ascending: false }).limit(100),
      sb.from('alerts').select('kind, created_at, severity').gte('created_at', since).order('created_at', { ascending: false }).limit(100),
    ])
    recentWebhooks = w?.data || []
    recentAlerts = a?.data || []
  } catch (err) {
    console.error('[/leadership/automations] activity lookup threw', err)
  }

  return (
    <main style={{
      maxWidth: 1100,
      margin: '0 auto',
      padding: '20px 18px 40px',
      fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
      color: INK,
    }}>
      <header style={{ marginBottom: 18 }}>
        <div style={{ color: ACCENT, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
          Leadership · Automations
        </div>
        <h1 style={{ fontSize: 22, margin: '4px 0 6px', fontWeight: 700 }}>What runs by itself</h1>
        <p style={{ color: INK_DIM, fontSize: 13, margin: 0, lineHeight: 1.5 }}>
          Read-only inventory of every automated send, cron, and webhook in the Loop app. Use this to see what's firing without digging through code. Toggling these from the UI isn't wired up yet — flips happen via deploy.
        </p>
      </header>

      <div style={{ display: 'grid', gap: 14 }}>
        {AUTOMATIONS.map(group => (
          <Section key={group.section} title={group.section} rows={group.rows} />
        ))}
        <ActivityCard webhooks={recentWebhooks} alerts={recentAlerts} />
      </div>
    </main>
  )
}

function Section({ title, rows }) {
  return (
    <section style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ color: ACCENT, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>
          {title}
        </div>
      </div>
      <div>
        {rows.map((r, i) => (
          <Row key={r.name} row={r} first={i === 0} />
        ))}
      </div>
    </section>
  )
}

function Row({ row, first }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(160px, 1.4fr) minmax(70px, 0.6fr) minmax(180px, 1.2fr) 92px',
      alignItems: 'center',
      gap: 12,
      padding: '12px 14px',
      borderTop: first ? 'none' : `1px solid ${BORDER}`,
    }}>
      <div>
        <div style={{ color: INK, fontSize: 14, fontWeight: 600 }}>{row.name}</div>
        <div style={{ color: INK_DIM, fontSize: 11, marginTop: 2, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
          {row.where}
        </div>
      </div>
      <div style={{ color: INK_DIM, fontSize: 12 }}>{row.channel}</div>
      <div style={{ color: INK_DIM, fontSize: 12, lineHeight: 1.4 }}>{row.trigger}</div>
      <div style={{ textAlign: 'right' }}>
        <StatusBadge status={row.status} />
      </div>
    </div>
  )
}

function StatusBadge({ status }) {
  const palette = {
    ON:     { bg: 'rgba(212,163,51,0.18)', border: 'rgba(212,163,51,0.55)', color: ACCENT_HI },
    OFF:    { bg: 'rgba(255,255,255,0.04)', border: BORDER, color: INK_DIM },
    MANUAL: { bg: 'rgba(99,179,237,0.14)',  border: 'rgba(99,179,237,0.4)', color: '#9bd0ff' },
    STRIPE: { bg: 'rgba(255,255,255,0.04)', border: BORDER, color: INK_DIM },
  }[status] || { bg: 'rgba(255,255,255,0.04)', border: BORDER, color: INK_DIM }

  return (
    <span style={{
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: 999,
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      color: palette.color,
    }}>
      {status}
    </span>
  )
}

function ActivityCard({ webhooks, alerts }) {
  const okCount = webhooks.filter(w => w.status === 'ok').length
  const errCount = webhooks.filter(w => w.status === 'error').length
  const dupCount = webhooks.filter(w => w.status === 'ignored_duplicate').length
  const alertErrors = alerts.filter(a => a.severity === 'error' || a.severity === 'critical').length

  return (
    <section style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: 14,
    }}>
      <div style={{ color: ACCENT, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, marginBottom: 10 }}>
        Last 30 days
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
        <Stat label="Webhooks OK" value={okCount} tone="ok" />
        <Stat label="Webhook errors" value={errCount} tone={errCount > 0 ? 'err' : 'ok'} />
        <Stat label="Duplicate events" value={dupCount} tone="dim" />
        <Stat label="Alerts (error+)" value={alertErrors} tone={alertErrors > 0 ? 'err' : 'ok'} />
      </div>
      <div style={{ color: INK_DIM, fontSize: 11, marginTop: 10 }}>
        Detail at <a href="/leadership/alerts" style={{ color: ACCENT_HI, textDecoration: 'none' }}>/leadership/alerts</a>.
      </div>
    </section>
  )
}

function Stat({ label, value, tone }) {
  const color = tone === 'err' ? '#f87171' : tone === 'ok' ? ACCENT_HI : INK_DIM
  return (
    <div style={{ background: '#0e0e12', border: `1px solid ${BORDER}`, borderRadius: 10, padding: 10 }}>
      <div style={{ color: INK_DIM, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      <div style={{ color, fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{value}</div>
    </div>
  )
}
