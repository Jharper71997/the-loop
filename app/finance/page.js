'use client'

import { useEffect, useMemo, useState } from 'react'

const LS_KEY = 'the-loop:proforma:v1'

const DEFAULT_PROFORMA = {
  price: 20,
  fridayRiders: 20,
  saturdayRiders: 20,
  costPerNight: 300,
  monthlyFixed: 500,
  ttFeePct: 3,
  stripeFeePct: 2.9,
  stripeFeeFlat: 0.3,
  weeksPerMonth: 4.33,
}

export default function Finance() {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pro, setPro] = useState(DEFAULT_PROFORMA)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) setPro({ ...DEFAULT_PROFORMA, ...JSON.parse(saved) })
    } catch {}
    refresh()
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(pro))
    } catch {}
  }, [pro])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/finance-summary')
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Failed')
      setSummary(json)
      setPro(prev => ({
        ...prev,
        fridayRiders: Math.round(json.avgPast4Riders) || prev.fridayRiders,
        saturdayRiders: Math.round(json.avgPast4Riders) || prev.saturdayRiders,
      }))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const projection = useMemo(() => {
    const ridersPerWeek = Number(pro.fridayRiders) + Number(pro.saturdayRiders)
    const grossPerWeek = ridersPerWeek * Number(pro.price)
    const ttFeePerWeek = grossPerWeek * (Number(pro.ttFeePct) / 100)
    const stripeFeePerWeek = grossPerWeek * (Number(pro.stripeFeePct) / 100) + ridersPerWeek * Number(pro.stripeFeeFlat)
    const netPerWeek = grossPerWeek - ttFeePerWeek - stripeFeePerWeek

    const operatingCostPerWeek = Number(pro.costPerNight) * 2 // Fri + Sat
    const profitPerWeek = netPerWeek - operatingCostPerWeek
    const profitPerMonth = profitPerWeek * Number(pro.weeksPerMonth) - Number(pro.monthlyFixed)
    const profitPerYear = profitPerMonth * 12

    const variableCostPerRider = (Number(pro.price) * (Number(pro.ttFeePct) + Number(pro.stripeFeePct)) / 100) + Number(pro.stripeFeeFlat)
    const netPerRider = Number(pro.price) - variableCostPerRider
    const fixedPerWeek = operatingCostPerWeek + Number(pro.monthlyFixed) / Number(pro.weeksPerMonth)
    const breakEvenRidersPerWeek = netPerRider > 0 ? Math.ceil(fixedPerWeek / netPerRider) : null
    const breakEvenPerNight = breakEvenRidersPerWeek != null ? Math.ceil(breakEvenRidersPerWeek / 2) : null

    return {
      grossPerWeek,
      netPerWeek,
      profitPerWeek,
      profitPerMonth,
      profitPerYear,
      ttFeePerWeek,
      stripeFeePerWeek,
      operatingCostPerWeek,
      breakEvenRidersPerWeek,
      breakEvenPerNight,
      netPerRider,
    }
  }, [pro])

  return (
    <main>
      <h1>Finance</h1>
      <p className="muted" style={{ marginBottom: '14px' }}>Revenue · projection · break-even</p>

      {loading && <p className="muted">Loading…</p>}
      {error && <p style={{ color: '#e07a7a' }}>Error: {error}</p>}

      {summary && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <StatCard label="Past 90 days" value={usd(summary.pastRevenue)} sub={`${summary.pastTickets} riders`} />
            <StatCard label="Upcoming booked" value={usd(summary.upcomingRevenue)} sub={`${summary.upcomingTickets} riders`} accent />
            <StatCard label="Avg/night (last 4)" value={usd(summary.avgPast4Revenue)} sub={`${Math.round(summary.avgPast4Riders)} riders`} />
            <StatCard label="Refunded" value={usd(summary.refunded)} />
          </div>

          <h2>Revenue by month</h2>
          <div className="card" style={{ padding: 0 }}>
            {summary.months.length === 0 && <p className="muted" style={{ padding: '12px' }}>No months yet.</p>}
            {summary.months.map((m, i) => (
              <MonthRow key={m.month} month={m.month} revenue={m.revenue} first={i === 0} />
            ))}
          </div>

          <h2>Nights</h2>
          <div className="card" style={{ padding: 0 }}>
            {summary.nights.slice(-12).reverse().map((n, i) => (
              <NightRow key={n.date} night={n} first={i === 0} />
            ))}
          </div>
        </>
      )}

      <h2>Pro forma</h2>
      <div className="card">
        <p className="tiny" style={{ marginBottom: '10px' }}>
          Adjust inputs to see projected monthly/yearly profit and break-even.
        </p>
        <InputRow label="Ticket price ($)" value={pro.price} onChange={v => setPro({ ...pro, price: v })} />
        <InputRow label="Riders / Friday" value={pro.fridayRiders} onChange={v => setPro({ ...pro, fridayRiders: v })} />
        <InputRow label="Riders / Saturday" value={pro.saturdayRiders} onChange={v => setPro({ ...pro, saturdayRiders: v })} />
        <InputRow label="Cost per night (gas, driver)" value={pro.costPerNight} onChange={v => setPro({ ...pro, costPerNight: v })} />
        <InputRow label="Fixed monthly cost" value={pro.monthlyFixed} onChange={v => setPro({ ...pro, monthlyFixed: v })} />
        <InputRow label="Ticket Tailor fee %" value={pro.ttFeePct} onChange={v => setPro({ ...pro, ttFeePct: v })} />
        <InputRow label="Stripe fee %" value={pro.stripeFeePct} onChange={v => setPro({ ...pro, stripeFeePct: v })} />
        <InputRow label="Stripe fee flat per tx" value={pro.stripeFeeFlat} onChange={v => setPro({ ...pro, stripeFeeFlat: v })} />
      </div>

      <h2>Projection</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
        <StatCard label="Gross / week" value={usd(projection.grossPerWeek)} />
        <StatCard label="Net / week (after fees)" value={usd(projection.netPerWeek)} />
        <StatCard
          label="Profit / month"
          value={usd(projection.profitPerMonth)}
          accent={projection.profitPerMonth >= 0}
          negative={projection.profitPerMonth < 0}
        />
        <StatCard
          label="Profit / year"
          value={usd(projection.profitPerYear)}
          accent={projection.profitPerYear >= 0}
          negative={projection.profitPerYear < 0}
        />
      </div>

      <div className="card card-compact">
        <p style={{ fontSize: '13px', color: '#c8c8cc' }}>
          <strong style={{ color: '#d4a333' }}>Break-even:</strong>{' '}
          {projection.breakEvenRidersPerWeek == null
            ? 'Not reachable at current price'
            : `${projection.breakEvenRidersPerWeek} riders/week (~${projection.breakEvenPerNight}/night)`}
        </p>
        <p className="tiny" style={{ marginTop: '4px' }}>
          Net per rider: {usd(projection.netPerRider)} · Operating cost/week: {usd(projection.operatingCostPerWeek)}
        </p>
      </div>
    </main>
  )
}

function StatCard({ label, value, sub, accent, negative }) {
  const color = negative ? '#e07a7a' : accent ? '#d4a333' : '#e8e8ea'
  const bg = accent ? '#1c1a10' : negative ? '#1c1313' : '#121215'
  return (
    <div className="card card-compact" style={{ marginBottom: 0, background: bg }}>
      <p style={{ fontSize: '11px', color: '#8a8a90', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
      <p style={{ fontSize: '20px', fontWeight: 700, color, marginTop: '2px' }}>{value}</p>
      {sub && <p className="tiny" style={{ marginTop: '2px' }}>{sub}</p>}
    </div>
  )
}

function MonthRow({ month, revenue, first }) {
  return (
    <div style={{
      padding: '10px 14px',
      borderTop: first ? 'none' : '1px solid #1a1a1f',
      display: 'flex',
      justifyContent: 'space-between',
    }}>
      <span style={{ fontSize: '14px', color: '#e8e8ea' }}>{formatMonth(month)}</span>
      <span style={{ fontSize: '14px', color: '#d4a333', fontWeight: 600 }}>{usd(revenue)}</span>
    </div>
  )
}

function NightRow({ night, first }) {
  return (
    <div style={{
      padding: '10px 14px',
      borderTop: first ? 'none' : '1px solid #1a1a1f',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <div>
        <p style={{ fontSize: '14px', color: '#e8e8ea' }}>
          {formatDate(night.date)} {night.upcoming && <span className="chip chip-green" style={{ marginLeft: '6px' }}>upcoming</span>}
        </p>
        <p className="tiny">{night.tickets} rider{night.tickets === 1 ? '' : 's'}</p>
      </div>
      <span style={{ fontSize: '14px', color: '#d4a333', fontWeight: 600 }}>{usd(night.revenue)}</span>
    </div>
  )
}

function InputRow({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
      <span style={{ flex: 1, fontSize: '13px', color: '#c8c8cc' }}>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
        style={{ width: '100px', textAlign: 'right', marginBottom: 0, fontSize: '14px', padding: '6px 8px' }}
      />
    </label>
  )
}

function usd(n) {
  if (n == null || Number.isNaN(n)) return '$0'
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(Math.round(n))
  return sign + '$' + abs.toLocaleString()
}

function formatMonth(ym) {
  try {
    const [y, m] = ym.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  } catch {
    return ym
  }
}

function formatDate(iso) {
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}
