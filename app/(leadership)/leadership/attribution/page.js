import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { formatCents } from '@/lib/leadershipScoreboard'

export const dynamic = 'force-dynamic'

function monthBoundsFromParam(monthStr) {
  let year, month
  const m = /^(\d{4})-(\d{2})$/.exec(monthStr || '')
  if (m) {
    year = parseInt(m[1], 10)
    month = parseInt(m[2], 10) - 1
  } else {
    const now = new Date()
    year = now.getFullYear()
    month = now.getMonth()
  }
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 1))
  const label = start.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const value = `${year}-${String(month + 1).padStart(2, '0')}`
  const prev = new Date(Date.UTC(year, month - 1, 1))
  const next = new Date(Date.UTC(year, month + 1, 1))
  const prevValue = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`
  const nextValue = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`
  return { startISO: start.toISOString(), endISO: end.toISOString(), label, value, prevValue, nextValue }
}

export default async function AttributionPage({ searchParams }) {
  const params = await searchParams
  const bounds = monthBoundsFromParam(params?.month)
  const supabase = supabaseAdmin()

  const { data: codes } = await supabase
    .from('qr_codes')
    .select('id, code, kind, label')
    .in('kind', ['bar', 'sponsor'])
    .order('kind')
    .order('code')

  const codeIds = (codes || []).map(c => c.id)

  const { data: scans } = await supabase
    .from('qr_scans')
    .select('id, qr_id, scanned_at, resulting_order_id')
    .in('qr_id', codeIds.length ? codeIds : ['00000000-0000-0000-0000-000000000000'])
    .gte('scanned_at', bounds.startISO)
    .lt('scanned_at', bounds.endISO)

  const scanCount = new Map()
  const convCount = new Map()
  const orderIdsFromScans = new Set()
  for (const s of scans || []) {
    scanCount.set(s.qr_id, (scanCount.get(s.qr_id) || 0) + 1)
    if (s.resulting_order_id) {
      convCount.set(s.qr_id, (convCount.get(s.qr_id) || 0) + 1)
      orderIdsFromScans.add(s.resulting_order_id)
    }
  }

  const codesById = new Map((codes || []).map(c => [c.id, c]))
  const codesByCode = new Map((codes || []).map(c => [c.code, c]))

  let ordersFromScans = []
  if (orderIdsFromScans.size > 0) {
    const { data } = await supabase
      .from('orders')
      .select('id, buyer_name, buyer_email, total_cents, status, paid_at, created_at, metadata')
      .in('id', Array.from(orderIdsFromScans))
    ordersFromScans = data || []
  }

  const codeList = (codes || []).map(c => c.code)
  let ordersByMetadata = []
  if (codeList.length > 0) {
    const { data } = await supabase
      .from('orders')
      .select('id, buyer_name, buyer_email, total_cents, status, paid_at, created_at, metadata')
      .eq('status', 'paid')
      .gte('paid_at', bounds.startISO)
      .lt('paid_at', bounds.endISO)
      .not('metadata->>qr_code', 'is', null)
    ordersByMetadata = (data || []).filter(o => codesByCode.has(o.metadata?.qr_code))
  }

  const ordersById = new Map()
  for (const o of [...ordersFromScans, ...ordersByMetadata]) {
    ordersById.set(o.id, o)
  }

  const ordersForRollup = Array.from(ordersById.values()).filter(o => {
    if (o.status !== 'paid' || !o.paid_at) return false
    return o.paid_at >= bounds.startISO && o.paid_at < bounds.endISO
  })

  const grossByCode = new Map()
  const buyersByCode = new Map()
  for (const o of ordersForRollup) {
    const code = o.metadata?.qr_code
    if (!code || !codesByCode.has(code)) continue
    grossByCode.set(code, (grossByCode.get(code) || 0) + (o.total_cents || 0))
    if (!buyersByCode.has(code)) buyersByCode.set(code, [])
    buyersByCode.get(code).push(o)
  }

  let totalScans = 0, totalBuyers = 0, totalGross = 0
  const rows = (codes || []).map(c => {
    const scans = scanCount.get(c.id) || 0
    const buyers = (buyersByCode.get(c.code) || []).length
    const gross = grossByCode.get(c.code) || 0
    totalScans += scans
    totalBuyers += buyers
    totalGross += gross
    return { ...c, scans, buyers, gross }
  }).sort((a, b) => b.scans - a.scans || b.buyers - a.buyers)

  const conv = totalScans > 0 ? Math.round((totalBuyers / totalScans) * 100) : 0

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#e8e8ea',
      padding: '24px 16px 48px',
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          gap: 12, flexWrap: 'wrap', marginBottom: 18,
        }}>
          <h1 style={{
            color: '#e8e8ea',
            fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
            fontSize: 24, fontWeight: 700, letterSpacing: '-0.01em', margin: 0,
          }}>
            Flyer Attribution
          </h1>
          <MonthPicker label={bounds.label} value={bounds.value} prev={bounds.prevValue} next={bounds.nextValue} />
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12, marginBottom: 18,
        }}>
          <Stat label="Total scans" value={totalScans.toLocaleString()} />
          <Stat label="Buyers" value={totalBuyers.toLocaleString()} />
          <Stat label="Conv %" value={`${conv}%`} />
          <Stat label="Gross" value={formatCents(totalGross)} />
        </div>

        <div style={{
          background: 'linear-gradient(180deg, #121216, #0d0d10)',
          border: '1px solid #2a2a31', borderRadius: 8, overflow: 'hidden',
          marginBottom: 24,
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a31', background: '#0d0d10' }}>
                <th style={th}>Flyer</th>
                <th style={th}>Kind</th>
                <th style={{ ...th, textAlign: 'right' }}>Scans</th>
                <th style={{ ...th, textAlign: 'right' }}>Buyers</th>
                <th style={{ ...th, textAlign: 'right' }}>Conv</th>
                <th style={{ ...th, textAlign: 'right' }}>Gross</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={6} style={{ ...td, color: '#9c9ca3', textAlign: 'center' }}>
                  No bar/sponsor QR codes registered. Run register-qr-codes.sql first.
                </td></tr>
              ) : rows.map(r => {
                const rowConv = r.scans > 0 ? Math.round((r.buyers / r.scans) * 100) : 0
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid #2a2a31' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600 }}>{r.label || r.code}</div>
                      <div style={{ fontSize: 10, color: '#9c9ca3', marginTop: 2 }}>{r.code}</div>
                    </td>
                    <td style={td}>
                      <span style={{
                        background: r.kind === 'bar' ? 'rgba(212,163,51,0.15)' : 'rgba(99,91,255,0.15)',
                        color: r.kind === 'bar' ? '#d4a333' : '#8b85ff',
                        fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase',
                        padding: '3px 8px', borderRadius: 4,
                      }}>{r.kind}</span>
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.scans}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.buyers > 0 ? '#3fb27f' : '#6f6f76' }}>{r.buyers}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#9c9ca3' }}>{r.scans > 0 ? `${rowConv}%` : '—'}</td>
                    <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.gross > 0 ? formatCents(r.gross) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <h2 style={{
          color: '#e8e8ea',
          fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: 16, fontWeight: 700, margin: '0 0 10px',
        }}>
          Buyers this month
        </h2>

        <div style={{
          background: 'linear-gradient(180deg, #121216, #0d0d10)',
          border: '1px solid #2a2a31', borderRadius: 8, overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #2a2a31', background: '#0d0d10' }}>
                <th style={th}>When</th>
                <th style={th}>Buyer</th>
                <th style={th}>Email</th>
                <th style={th}>From</th>
                <th style={{ ...th, textAlign: 'right' }}>Paid</th>
              </tr>
            </thead>
            <tbody>
              {ordersForRollup.length === 0 ? (
                <tr><td colSpan={5} style={{ ...td, color: '#9c9ca3', textAlign: 'center' }}>
                  No attributed orders for {bounds.label} yet.
                </td></tr>
              ) : (
                [...ordersForRollup]
                  .sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
                  .map(o => {
                    const code = o.metadata?.qr_code
                    const qc = codesByCode.get(code)
                    const when = new Date(o.paid_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                    })
                    return (
                      <tr key={o.id} style={{ borderBottom: '1px solid #2a2a31' }}>
                        <td style={{ ...td, color: '#9c9ca3', whiteSpace: 'nowrap' }}>{when}</td>
                        <td style={td}>{o.buyer_name || '—'}</td>
                        <td style={{ ...td, color: '#9c9ca3' }}>{o.buyer_email || '—'}</td>
                        <td style={td}>
                          <div style={{ fontSize: 12 }}>{qc?.label || code}</div>
                          <div style={{ fontSize: 10, color: '#9c9ca3' }}>{code}</div>
                        </td>
                        <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                          {formatCents(o.total_cents || 0)}
                        </td>
                      </tr>
                    )
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

function Stat({ label, value }) {
  return (
    <div style={{
      background: 'linear-gradient(180deg, #121216, #0d0d10)',
      border: '1px solid #2a2a31', borderRadius: 8, padding: '12px 14px',
    }}>
      <div style={{ fontSize: 10, color: '#9c9ca3', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  )
}

function MonthPicker({ label, value, prev, next }) {
  return (
    <form style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <a href={`/leadership/attribution?month=${prev}`} style={navBtn} aria-label="Previous month">‹</a>
      <span style={{ color: '#e8e8ea', fontSize: 13, fontWeight: 600, minWidth: 130, textAlign: 'center' }}>{label}</span>
      <a href={`/leadership/attribution?month=${next}`} style={navBtn} aria-label="Next month">›</a>
      <input type="month" name="month" defaultValue={value}
        style={{
          background: '#0d0d10', color: '#e8e8ea',
          border: '1px solid #2a2a31', borderRadius: 6, padding: '6px 10px',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontSize: 12,
        }} />
      <button type="submit" style={{
        background: '#d4a333', color: '#0a0a0b', border: 'none', borderRadius: 6,
        padding: '6px 12px', fontWeight: 700, fontSize: 12, cursor: 'pointer',
      }}>Go</button>
    </form>
  )
}

const navBtn = {
  background: '#0d0d10', color: '#e8e8ea',
  border: '1px solid #2a2a31', borderRadius: 6,
  padding: '4px 10px', fontSize: 14, textDecoration: 'none',
  fontWeight: 700,
}
const th = {
  textAlign: 'left', padding: '10px 12px', color: '#9c9ca3',
  fontSize: 10, fontWeight: 600, letterSpacing: '0.18em', textTransform: 'uppercase',
}
const td = {
  padding: '12px', color: '#e8e8ea', verticalAlign: 'top',
}
