import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { formatCents } from '@/lib/leadershipScoreboard'
import DataTable from '../../_components/DataTable'
import StatCard from '../../_components/StatCard'
import StatusBadge from '../../_components/StatusBadge'
import ShowMore from '../../_components/ShowMore'

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

  const rows = (codes || []).map(c => {
    const scans = scanCount.get(c.id) || 0
    const buyers = (buyersByCode.get(c.code) || []).length
    const gross = grossByCode.get(c.code) || 0
    return { ...c, scans, buyers, gross }
  }).sort((a, b) => b.scans - a.scans || b.buyers - a.buyers)

  const totalScans = rows.reduce((s, r) => s + r.scans, 0)
  const totalBuyers = rows.reduce((s, r) => s + r.buyers, 0)
  const totalGross = rows.reduce((s, r) => s + r.gross, 0)

  const conv = totalScans > 0 ? Math.round((totalBuyers / totalScans) * 100) : 0

  const flyerColumns = [
    {
      key: 'flyer', header: 'Flyer', primary: true,
      render: r => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.label || r.code}</div>
          <div style={{ fontSize: 10, color: '#9c9ca3', marginTop: 2 }}>{r.code}</div>
        </div>
      ),
    },
    {
      key: 'kind', header: 'Kind',
      render: r => r.kind === 'bar'
        ? <StatusBadge label="bar" tone="gold" />
        : <StatusBadge label="sponsor" tone="purple" />,
    },
    { key: 'scans', header: 'Scans', align: 'right', mono: true, render: r => r.scans },
    { key: 'buyers', header: 'Buyers', align: 'right', mono: true, render: r => <span style={{ color: r.buyers > 0 ? '#3fb27f' : '#6f6f76' }}>{r.buyers}</span> },
    { key: 'conv', header: 'Conv', align: 'right', mono: true, render: r => <span style={{ color: '#9c9ca3' }}>{r.scans > 0 ? `${Math.round((r.buyers / r.scans) * 100)}%` : '—'}</span> },
    { key: 'gross', header: 'Gross', align: 'right', mono: true, render: r => (r.gross > 0 ? formatCents(r.gross) : '—') },
  ]

  const buyerRows = [...ordersForRollup].sort((a, b) => new Date(b.paid_at) - new Date(a.paid_at))
  const buyerColumns = [
    {
      key: 'when', header: 'When', primary: true,
      render: o => new Date(o.paid_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    },
    { key: 'buyer', header: 'Buyer', render: o => o.buyer_name || '—' },
    { key: 'email', header: 'Email', hideOnMobile: true, render: o => <span style={{ color: '#9c9ca3' }}>{o.buyer_email || '—'}</span> },
    {
      key: 'from', header: 'From',
      render: o => {
        const code = o.metadata?.qr_code
        const qc = codesByCode.get(code)
        return (
          <div>
            <div style={{ fontSize: 12 }}>{qc?.label || code}</div>
            <div style={{ fontSize: 10, color: '#9c9ca3' }}>{code}</div>
          </div>
        )
      },
    },
    { key: 'paid', header: 'Paid', align: 'right', mono: true, render: o => formatCents(o.total_cents || 0) },
  ]

  return (
    <main style={{
      minHeight: '100vh',
      background: '#0a0a0b',
      color: '#e8e8ea',
      padding: '24px 16px calc(48px + env(safe-area-inset-bottom))',
      paddingLeft: 'max(16px, env(safe-area-inset-left))',
      paddingRight: 'max(16px, env(safe-area-inset-right))',
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
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12, marginBottom: 18,
        }}>
          <StatCard label="Total scans" value={totalScans.toLocaleString()} />
          <StatCard label="Buyers" value={totalBuyers.toLocaleString()} />
          <StatCard label="Conv %" value={`${conv}%`} />
          <StatCard label="Gross" value={formatCents(totalGross)} />
        </div>

        <DataTable
          columns={flyerColumns}
          rows={rows}
          rowKey={r => r.id}
          empty={<div style={{ color: '#9c9ca3', fontSize: 13, padding: '16px 2px' }}>No bar/sponsor QR codes registered. Run register-qr-codes.sql first.</div>}
        />

        <h2 style={{
          color: '#e8e8ea',
          fontFamily: '-apple-system, "Segoe UI", Roboto, sans-serif',
          fontSize: 16, fontWeight: 700, margin: '4px 0 10px',
        }}>
          Buyers this month
        </h2>

        <ShowMore label="buyer-by-buyer detail" count={buyerRows.length || undefined}>
          <DataTable
            columns={buyerColumns}
            rows={buyerRows}
            rowKey={o => o.id}
            empty={<div style={{ color: '#9c9ca3', fontSize: 13, padding: '16px 2px' }}>No attributed orders for {bounds.label} yet.</div>}
          />
        </ShowMore>
      </div>
    </main>
  )
}

function MonthPicker({ label, value, prev, next }) {
  return (
    <form style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <Link href={`/leadership/attribution?month=${prev}`} style={navBtn} aria-label="Previous month">‹</Link>
      <span style={{ color: '#e8e8ea', fontSize: 13, fontWeight: 600, minWidth: 110, textAlign: 'center' }}>{label}</span>
      <Link href={`/leadership/attribution?month=${next}`} style={navBtn} aria-label="Next month">›</Link>
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
