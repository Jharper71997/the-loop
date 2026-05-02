'use client'

const ACCENT = '#d4a333'
const ACCENT_HI = '#f0c24a'
const SURFACE = '#15151a'
const BORDER = '#2a2a31'
const INK = '#f5f5f7'
const INK_DIM = '#9c9ca3'

export default function SummaryView({
  group,
  event,
  ticketTypes,
  members,
  orders,
  orderItems = [],
  waiverSigs,
  onJumpToEdit,
  onJumpToTickets,
}) {
  const paidOrders = (orders || []).filter(o => o.status === 'paid')
  // Real ticket count comes from active (non-voided) order_items, not
  // orders.party_size — voiding a seat decrements party_size but the order's
  // party_size sum is the right rollup either way. Use order_items length so
  // per-type counts and total agree.
  const ticketsSold = orderItems.length
  const revenueCents = paidOrders.reduce((s, o) => s + (o.total_cents || 0), 0)
  const checkedIn = (members || []).filter(m => m.checked_in_at).length

  // Group order_items by ticket_type_id for the "issued" column.
  const issuedByType = new Map()
  for (const oi of orderItems) {
    if (!oi.ticket_type_id) continue
    issuedByType.set(oi.ticket_type_id, (issuedByType.get(oi.ticket_type_id) || 0) + 1)
  }

  const days = computeDaysToGo(group.event_date)

  const sigByContact = new Map()
  for (const s of waiverSigs || []) {
    if (!sigByContact.has(s.contact_id)) sigByContact.set(s.contact_id, s)
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <Header title="Event summary" />

      <div style={{
        display: 'grid',
        gap: 12,
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      }}>
        <Stat label="Tickets sold" value={ticketsSold} />
        <Stat label="Revenue" value={`$${(revenueCents / 100).toFixed(2)}`} />
        <Stat label="Days to go" value={days == null ? '—' : days} />
        <Stat label="Checked in" value={checkedIn} />
        <Stat label="Riders" value={(members || []).length} />
      </div>

      {event?.id && (
        <Panel title="Event page link">
          <div style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            padding: '12px 14px',
            background: '#0e0e12',
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            fontFamily: 'ui-monospace, SFMono-Regular, monospace',
            fontSize: 12,
            color: INK_DIM,
            wordBreak: 'break-all',
          }}>
            <span style={{ flex: 1 }}>/book/{event.id}</span>
            <a href={`/book/${event.id}`} target="_blank" rel="noreferrer" style={ghostBtn}>Open</a>
          </div>
        </Panel>
      )}

      <Panel
        title={`Ticket sales (${ticketTypes.length})`}
        action={
          <button type="button" onClick={onJumpToTickets} style={ghostBtn}>
            Manage tickets →
          </button>
        }
      >
        {ticketTypes.length === 0 ? (
          <Empty>No ticket types yet. Add one in Tickets and items.</Empty>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {ticketTypes.map(tt => {
              const issued = issuedByType.get(tt.id) || 0
              const cap = tt.capacity || null
              const remaining = cap != null ? Math.max(0, cap - issued) : null
              return (
                <div key={tt.id} style={listRow}>
                  <div>
                    <strong style={{ color: INK }}>{tt.name}</strong>
                    {tt.active === false && (
                      <span style={{ marginLeft: 8, fontSize: 10, color: INK_DIM, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                        OFF
                      </span>
                    )}
                    <div style={{ fontSize: 11, color: INK_DIM, marginTop: 2 }}>
                      ${(tt.price_cents / 100).toFixed(2)}
                      {tt.stop_index != null ? ` · Stop ${tt.stop_index + 1}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, color: ACCENT_HI, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {issued} issued
                    </div>
                    <div style={{ fontSize: 11, color: INK_DIM }}>
                      {remaining != null ? `${remaining} remaining` : 'Unlimited'}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel title={`Riders (${(members || []).length})`}>
        {(members || []).length === 0 ? (
          <Empty>No riders yet.</Empty>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {(members || []).map(m => {
              const c = m.contacts || {}
              const sig = sigByContact.get(c.id)
              return (
                <div key={m.id} style={listRow}>
                  <div>
                    <strong style={{ color: INK }}>{c.first_name} {c.last_name}</strong>
                    {c.phone && <span style={{ color: INK_DIM, fontSize: 12, marginLeft: 6 }}>{c.phone}</span>}
                    <div style={{ fontSize: 11, color: INK_DIM, marginTop: 2 }}>
                      Stop {m.current_stop_index != null ? m.current_stop_index + 1 : '—'}
                    </div>
                  </div>
                  <div style={{ fontSize: 11 }}>
                    {sig ? (
                      <span style={{ color: '#6fbf7f' }}>✓ waiver v{sig.waiver_versions?.version}</span>
                    ) : (
                      <span style={{ color: '#facc15' }}>waiver pending</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Panel>

      <Panel title={`Recent orders (${(orders || []).length})`}>
        {(orders || []).length === 0 ? (
          <Empty>No orders yet.</Empty>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {(orders || []).slice(0, 10).map(o => (
              <div key={o.id} style={listRow}>
                <div>
                  <strong style={{ color: INK }}>{o.buyer_name || '(no name)'}</strong>
                  {o.buyer_phone && <span style={{ color: INK_DIM, fontSize: 12, marginLeft: 6 }}>{o.buyer_phone}</span>}
                  <div style={{ fontSize: 11, color: INK_DIM, marginTop: 2 }}>
                    {o.party_size} ticket{o.party_size === 1 ? '' : 's'} · {new Date(o.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: ACCENT_HI, fontWeight: 700 }}>${((o.total_cents || 0) / 100).toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: INK_DIM }}>{o.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

    </div>
  )
}

function Header({ title }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <h1 style={{
        fontSize: 22,
        color: INK,
        margin: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        fontWeight: 700,
        letterSpacing: '-0.01em',
      }}>
        {title}
      </h1>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: 14,
    }}>
      <div style={{
        fontSize: 10,
        color: INK_DIM,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        fontWeight: 700,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 26,
        fontWeight: 800,
        color: ACCENT_HI,
        marginTop: 4,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
    </div>
  )
}

function Panel({ title, action, children }) {
  return (
    <section style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: 14,
      display: 'grid',
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={panelHeader}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Empty({ children }) {
  return <div style={{ color: INK_DIM, fontSize: 13 }}>{children}</div>
}

function countIssued(tt, paidOrders) {
  // We don't have a direct order_items rollup at this layer, so fall back to
  // a rough heuristic: for unscoped types (no stop_index) count nothing here
  // and lean on the orders list. Real per-type counts ship when admin queries
  // order_items directly — kept simple for now.
  if (!paidOrders.length) return 0
  return paidOrders.reduce((s, o) => {
    const meta = o.metadata || {}
    if (Array.isArray(meta.ticket_type_counts) && meta.ticket_type_counts.length) {
      const hit = meta.ticket_type_counts.find(c => c.ticket_type_id === tt.id)
      return s + (hit?.qty || 0)
    }
    return s
  }, 0)
}

function computeDaysToGo(iso) {
  if (!iso) return null
  try {
    const now = new Date()
    const target = new Date(`${iso}T00:00:00`)
    const days = Math.ceil((target.getTime() - now.getTime()) / 86400000)
    return Math.max(0, days)
  } catch { return null }
}

const listRow = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: 10,
  background: '#0e0e12',
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  fontSize: 13,
  flexWrap: 'wrap',
  gap: 8,
}

const panelHeader = {
  fontSize: 11,
  color: ACCENT,
  margin: 0,
  letterSpacing: '0.22em',
  textTransform: 'uppercase',
  fontWeight: 700,
}

const ghostBtn = {
  background: 'transparent',
  border: `1px solid ${BORDER}`,
  color: ACCENT,
  padding: '6px 12px',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  textDecoration: 'none',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const primaryBtn = {
  background: `linear-gradient(180deg, ${ACCENT_HI}, ${ACCENT})`,
  color: '#0a0a0b',
  border: 0,
  padding: '12px 18px',
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  justifySelf: 'flex-start',
}
