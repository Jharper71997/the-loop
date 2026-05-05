import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { operationalDateInTZ } from '@/lib/schedule'

export const dynamic = 'force-dynamic'

const ACCENT = '#d4a333'
const SURFACE = '#15151a'
const BORDER = '#2a2a31'
const INK = '#e8e8ea'
const INK_DIM = '#9c9ca3'

export default async function ManageLoopsListPage() {
  const supabase = supabaseAdmin()
  const today = operationalDateInTZ()

  const [{ data: groups }, { data: events }, { data: orders }] = await Promise.all([
    supabase
      .from('groups')
      .select('id, name, event_date, pickup_time')
      .gte('event_date', today)
      .order('event_date', { ascending: true }),
    supabase
      .from('events')
      .select('id, group_id, status, name'),
    supabase
      .from('orders')
      .select('event_id, party_size, status, paid_at, metadata')
      .eq('status', 'paid')
      .gte('paid_at', new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()),
  ])

  const eventByGroup = new Map((events || []).map(e => [e.group_id, e]))
  const ticketsByGroup = {}
  for (const o of orders || []) {
    const ev = (events || []).find(e => e.id === o.event_id)
    const gid = ev?.group_id
    if (!gid) continue
    ticketsByGroup[gid] = (ticketsByGroup[gid] || 0) + (Number(o.party_size) || 1)
  }

  return (
    <main style={{
      maxWidth: 1000,
      margin: '0 auto',
      padding: '24px 16px 48px',
      color: INK,
      fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
    }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>Manage Loops</h1>
          <p style={{ color: INK_DIM, fontSize: 13, margin: '4px 0 0' }}>
            Edit upcoming events, ticket types, and pricing.
          </p>
        </div>
        <a
          href="/leadership/loops/new"
          style={{
            background: ACCENT,
            color: '#0a0a0b',
            padding: '10px 16px',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            textDecoration: 'none',
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          + New Loop
        </a>
      </header>

      {(!groups || groups.length === 0) && (
        <div style={{
          padding: '24px',
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          color: INK_DIM,
          textAlign: 'center',
        }}>
          No upcoming Loops. Hit + New Loop to add one.
        </div>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {(groups || []).map(g => {
          const event = eventByGroup.get(g.id)
          const tickets = ticketsByGroup[g.id] || 0
          return (
            <a
              key={g.id}
              href={`/leadership/loops/${g.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 16px',
                background: SURFACE,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                textDecoration: 'none',
                color: INK,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: INK }}>
                  {event?.name || g.name || '(unnamed)'}
                </div>
                <div style={{ color: INK_DIM, fontSize: 12, marginTop: 4 }}>
                  {formatDate(g.event_date)}
                  {g.pickup_time ? ` · ${formatTime(g.pickup_time)}` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {event?.status && <StatusPill status={event.status} />}
                <span style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: INK,
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: 'rgba(212,163,51,0.10)',
                  border: '1px solid rgba(212,163,51,0.4)',
                  whiteSpace: 'nowrap',
                }}>
                  {tickets} {tickets === 1 ? 'ticket' : 'tickets'}
                </span>
                <span style={{ color: ACCENT, fontWeight: 700 }}>→</span>
              </div>
            </a>
          )
        })}
      </div>
    </main>
  )
}

function StatusPill({ status }) {
  const palette = {
    on_sale:   { bg: 'rgba(111,191,127,0.12)', border: 'rgba(111,191,127,0.4)', color: '#6fbf7f', label: 'On sale' },
    draft:     { bg: 'rgba(212,163,51,0.10)',  border: 'rgba(212,163,51,0.45)', color: '#f0c24a', label: 'Draft' },
    sold_out:  { bg: 'rgba(255,140,80,0.12)',  border: 'rgba(255,140,80,0.45)', color: '#ffb074', label: 'Sold out' },
    cancelled: { bg: 'rgba(224,122,122,0.12)', border: 'rgba(224,122,122,0.4)', color: '#e07a7a', label: 'Cancelled' },
  }[status] || { bg: SURFACE, border: BORDER, color: INK_DIM, label: status }
  return (
    <span style={{
      fontSize: 10,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      fontWeight: 700,
      padding: '3px 8px',
      borderRadius: 999,
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      color: palette.color,
      whiteSpace: 'nowrap',
    }}>
      {palette.label}
    </span>
  )
}

function formatDate(iso) {
  if (!iso) return 'No date'
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return iso }
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr); const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}
