import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { loadAutomationFlags, setAutomationEnabled, AUTOMATION_KEYS } from '@/lib/automationSettings'
import ShowMore from '../../_components/ShowMore'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Automations · Leadership' }

const ACCENT = '#d4a333'
const ACCENT_HI = '#f0c24a'
const SURFACE = '#15151a'
const BORDER = 'rgba(255,255,255,0.08)'
const INK = '#f5f5f7'
const INK_DIM = '#9c9ca3'

// Toggleable automations: each is gated by a DB row and short-circuits its
// code path when off. Source of truth for the keys is lib/automationSettings.
const TOGGLEABLE = [
  {
    section: 'Booking confirmations (post-payment)',
    rows: [
      { key: AUTOMATION_KEYS.BOOKING_BUYER_SMS,   name: 'Buyer SMS',                channel: 'SMS',   trigger: 'Stripe webhook → finalizeBooking', where: 'lib/booking.js' },
      { key: AUTOMATION_KEYS.BOOKING_BUYER_EMAIL, name: 'Buyer email',              channel: 'Email', trigger: 'Stripe webhook → finalizeBooking', where: 'lib/booking.js' },
      { key: AUTOMATION_KEYS.BOOKING_BUYER_PUSH,  name: 'Buyer push notification',  channel: 'Push',  trigger: 'Stripe webhook → finalizeBooking', where: 'lib/booking.js' },
      { key: AUTOMATION_KEYS.BOOKING_RIDER_SMS,   name: 'Per-rider SMS',            channel: 'SMS',   trigger: 'Stripe webhook → finalizeBooking', where: 'lib/booking.js' },
      { key: AUTOMATION_KEYS.BOOKING_RIDER_EMAIL, name: 'Per-rider email',          channel: 'Email', trigger: 'Stripe webhook → finalizeBooking', where: 'lib/booking.js' },
      { key: AUTOMATION_KEYS.BOOKING_RIDER_PUSH,  name: 'Per-rider push',           channel: 'Push',  trigger: 'Stripe webhook → finalizeBooking', where: 'lib/booking.js' },
    ],
  },
  {
    section: 'Waivers',
    rows: [
      { key: AUTOMATION_KEYS.WAIVER_NUDGE_CRON, name: 'Daily waiver-nudge cron', channel: 'SMS', trigger: 'Vercel cron (not yet scheduled)', where: 'app/api/cron/waiver-nudge', extra: 'Schedule still needs to be added to vercel.json. Toggle here gates the route either way.' },
    ],
  },
]

// Read-only entries: nothing in the DB controls these — they're either
// external (Stripe), inbound (webhooks), or manual (operator-clicked).
// Status is hard-coded so the inventory stays useful.
const READ_ONLY = [
  {
    section: 'Refunds & voids',
    rows: [
      { name: 'Refund receipt',         channel: 'Email', trigger: 'Stripe charge.refunded',     status: 'STRIPE', where: 'Stripe sends, not us' },
      { name: 'Refund SMS',             channel: 'SMS',   trigger: 'Stripe charge.refunded',     status: 'OFF',    where: 'handler removed 2026-05-02' },
      { name: 'Void/seat-cancel SMS',   channel: 'SMS',   trigger: 'Admin voids an order item',  status: 'OFF',    where: 'app/api/order-items/[id]/void' },
    ],
  },
  {
    section: 'Crons (vercel.json)',
    rows: [
      { name: 'Cleanup pending orders',   channel: 'Job',   trigger: 'Daily 9:00 UTC',                       status: 'ON', where: '/api/cron/cleanup-pending' },
      { name: 'Alert on failures digest', channel: 'Email', trigger: 'Daily 9:00 UTC',                       status: 'ON', where: '/api/cron/alert-on-failures' },
      { name: '1-hour pickup reminder',   channel: 'Both',  trigger: 'Every 10 min, 55–70 min before stop', status: 'ON', where: '/api/cron/ticket-reminder' },
    ],
  },
  {
    section: 'Inbound webhooks',
    rows: [
      { name: 'Stripe checkout.completed', channel: 'Webhook', trigger: 'Stripe',        status: 'ON', where: 'app/api/stripe-webhook → finalizeBooking' },
      { name: 'Stripe charge.refunded',    channel: 'Webhook', trigger: 'Stripe',        status: 'ON', where: 'app/api/stripe-webhook → handleRefund' },
      { name: 'Ticket Tailor order',       channel: 'Webhook', trigger: 'Ticket Tailor', status: 'ON', where: 'app/api/ticket-tailor-webhook' },
    ],
  },
  {
    section: 'Tracking & attribution',
    rows: [
      { name: 'Shuttle ping ingest',        channel: 'API', trigger: 'Driver page broadcasting GPS',       status: 'ON', where: '/api/shuttle/ping' },
      { name: 'QR scan attribution',        channel: 'API', trigger: '/r/<code> redirect',                 status: 'ON', where: 'app/r/[code]/route.js' },
      { name: 'Bartender code attribution', channel: 'API', trigger: 'Checkout form bartender_code field', status: 'ON', where: 'app/api/checkout → bartenders.share_code' },
    ],
  },
  {
    section: 'Manual blast tools',
    rows: [
      { name: 'Tonight SMS broadcast',    channel: 'SMS', trigger: 'Admin Tonight page button', status: 'MANUAL', where: 'admin SmsBroadcast component' },
      { name: 'Per-loop rider broadcast', channel: 'SMS', trigger: 'Admin loop page button',    status: 'MANUAL', where: 'admin loop UI' },
    ],
  },
]

async function getCurrentEmail() {
  try {
    const cookieStore = await cookies()
    const sb = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )
    const { data: { user } } = await sb.auth.getUser()
    return user?.email || null
  } catch {
    return null
  }
}

async function toggleAutomation(formData) {
  'use server'
  const key = (formData.get('key') || '').toString()
  // Hidden checkbox carries the *current* value; we flip it.
  const currentEnabled = formData.get('current') === 'true'
  const email = await getCurrentEmail()
  const result = await setAutomationEnabled({
    key,
    enabled: !currentEnabled,
    updatedBy: email,
  })
  if (!result.ok) {
    revalidatePath('/leadership/automations')
    return
  }
  revalidatePath('/leadership/automations')
}

export default async function AutomationsPage({ searchParams }) {
  const sp = await searchParams
  const tableMissing = sp?.error === 'table_missing'

  // Fetch flags + last-updated metadata in parallel.
  const allKeys = TOGGLEABLE.flatMap(s => s.rows.map(r => r.key))
  const [flags, settingsMeta, recentWebhooks, recentAlerts] = await Promise.all([
    loadAutomationFlags(allKeys),
    fetchSettingsMeta(allKeys),
    fetchRecentWebhooks(),
    fetchRecentAlerts(),
  ])

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
          Flip the switches to turn an automated send or cron on/off — the change applies on the next event with no redeploy. Read-only entries below run from external systems or operator buttons.
        </p>
        {settingsMeta.tableMissing && (
          <div style={{
            marginTop: 12,
            padding: '10px 12px',
            background: 'rgba(248,113,113,0.10)',
            border: '1px solid rgba(248,113,113,0.35)',
            color: '#fca5a5',
            borderRadius: 8,
            fontSize: 12,
            lineHeight: 1.5,
          }}>
            <strong>automation_settings table not found.</strong> Toggles below show defaults but flips won&rsquo;t persist until the migration runs. Paste <code style={{ color: '#ffd5d5' }}>sql/029_automation_settings.sql</code> into the Supabase SQL editor.
          </div>
        )}
      </header>

      <div style={{ display: 'grid', gap: 14 }}>
        {TOGGLEABLE.map(group => (
          <ToggleSection
            key={group.section}
            title={group.section}
            rows={group.rows}
            flags={flags}
            meta={settingsMeta.byKey}
            action={toggleAutomation}
          />
        ))}

        {/* Read-only inventory + activity are reference, not controls —
            collapsed so the live toggles above lead the page. */}
        <ShowMore label="Read-only inventory & activity">
          <div style={{ display: 'grid', gap: 14 }}>
            {READ_ONLY.map(group => (
              <ReadOnlySection key={group.section} title={group.section} rows={group.rows} />
            ))}
            <ActivityCard webhooks={recentWebhooks} alerts={recentAlerts} />
          </div>
        </ShowMore>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .auto-row { grid-template-columns: 1fr !important; gap: 6px !important; }
          .auto-row > div:last-child { text-align: left !important; }
        }
      `}</style>
    </main>
  )
}

async function fetchSettingsMeta(keys) {
  try {
    const sb = supabaseAdmin()
    const { data, error } = await sb
      .from('automation_settings')
      .select('key, updated_at, updated_by')
      .in('key', keys)
    if (error) {
      // Postgres "relation does not exist" code is 42P01.
      if (error.code === '42P01') return { tableMissing: true, byKey: new Map() }
      return { tableMissing: false, byKey: new Map() }
    }
    return { tableMissing: false, byKey: new Map((data || []).map(r => [r.key, r])) }
  } catch (err) {
    return { tableMissing: false, byKey: new Map() }
  }
}

async function fetchRecentWebhooks() {
  try {
    const sb = supabaseAdmin()
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await sb.from('webhook_events').select('event_type, status, processed_at').gte('processed_at', since).order('processed_at', { ascending: false }).limit(100)
    return data || []
  } catch { return [] }
}
async function fetchRecentAlerts() {
  try {
    const sb = supabaseAdmin()
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await sb.from('alerts').select('kind, created_at, severity').gte('created_at', since).order('created_at', { ascending: false }).limit(100)
    return data || []
  } catch { return [] }
}

function ToggleSection({ title, rows, flags, meta, action }) {
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
        {rows.map((row, i) => (
          <ToggleRow
            key={row.key}
            row={row}
            enabled={!!flags.get(row.key)}
            meta={meta.get(row.key)}
            action={action}
            first={i === 0}
          />
        ))}
      </div>
    </section>
  )
}

function ToggleRow({ row, enabled, meta, action, first }) {
  return (
    <div className="auto-row" style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(180px, 1.4fr) minmax(70px, 0.5fr) minmax(180px, 1.2fr) 110px',
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
        {row.extra && (
          <div style={{ color: INK_DIM, fontSize: 11, marginTop: 4, lineHeight: 1.4, fontStyle: 'italic' }}>
            {row.extra}
          </div>
        )}
        {meta?.updated_at && (
          <div style={{ color: '#6e6e75', fontSize: 10, marginTop: 4, letterSpacing: '0.04em' }}>
            Last flipped {new Date(meta.updated_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            {meta.updated_by ? ` · ${meta.updated_by.split('@')[0]}` : ''}
          </div>
        )}
      </div>
      <div style={{ color: INK_DIM, fontSize: 12 }}>{row.channel}</div>
      <div style={{ color: INK_DIM, fontSize: 12, lineHeight: 1.4 }}>{row.trigger}</div>
      <div style={{ textAlign: 'right' }}>
        <form action={action}>
          <input type="hidden" name="key" value={row.key} />
          <input type="hidden" name="current" value={String(enabled)} />
          <Switch enabled={enabled} />
        </form>
      </div>
    </div>
  )
}

function Switch({ enabled }) {
  // Submit button styled as a switch; clicking flips the DB row.
  return (
    <button
      type="submit"
      aria-pressed={enabled}
      title={enabled ? 'Click to turn OFF' : 'Click to turn ON'}
      style={{
        position: 'relative',
        width: 56,
        height: 30,
        borderRadius: 999,
        background: enabled ? 'linear-gradient(180deg, #f0c24a, #d4a333)' : 'rgba(255,255,255,0.08)',
        border: enabled ? '1px solid rgba(212,163,51,0.7)' : `1px solid ${BORDER}`,
        cursor: 'pointer',
        boxShadow: enabled ? '0 0 12px rgba(212,163,51,0.45)' : 'none',
        transition: 'background 0.15s, box-shadow 0.15s',
        padding: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 3,
          left: enabled ? 28 : 3,
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: enabled ? '#0a0a0b' : '#c8c8cc',
          transition: 'left 0.15s',
          fontSize: 10,
          fontWeight: 800,
          color: enabled ? '#d4a333' : '#0a0a0b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          letterSpacing: '0.04em',
        }}
      >
        {enabled ? 'ON' : 'OFF'}
      </span>
    </button>
  )
}

function ReadOnlySection({ title, rows }) {
  return (
    <section style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      overflow: 'hidden',
      opacity: 0.95,
    }}>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ color: ACCENT, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>
          {title}
        </div>
        <div style={{ color: INK_DIM, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 600 }}>
          deploy-managed
        </div>
      </div>
      <div>
        {rows.map((r, i) => (
          <ReadOnlyRow key={r.name} row={r} first={i === 0} />
        ))}
      </div>
    </section>
  )
}

function ReadOnlyRow({ row, first }) {
  return (
    <div className="auto-row" style={{
      display: 'grid',
      gridTemplateColumns: 'minmax(180px, 1.4fr) minmax(70px, 0.5fr) minmax(180px, 1.2fr) 110px',
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
