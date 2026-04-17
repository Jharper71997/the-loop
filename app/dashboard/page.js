'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const VIEWS = [
  { key: 'overview', label: 'Overview' },
  { key: 'current', label: 'Current Finances' },
  { key: 'potential', label: 'Potential Finances' },
  { key: 'sales', label: 'Ticket Sales' },
  { key: 'sponsors', label: 'Sponsors' },
  { key: 'bars', label: 'Bars' },
]

export default function Dashboard() {
  const [view, setView] = useState('overview')
  const [data, setData] = useState(null)
  const [finance, setFinance] = useState(null)
  const [financeErr, setFinanceErr] = useState(null)

  useEffect(() => {
    refresh()
  }, [])

  async function refresh() {
    const [c, g, m] = await Promise.all([
      supabase.from('contacts').select('id, sms_consent'),
      supabase.from('groups').select('id, event_date, name, pickup_time, schedule, tt_event_id'),
      supabase.from('group_members').select('id, group_id, contact_id, current_stop_index'),
    ])
    setData({
      contacts: c.data || [],
      groups: g.data || [],
      members: m.data || [],
    })

    try {
      const res = await fetch('/api/finance-summary')
      const json = await res.json()
      if (!res.ok || json.error) throw new Error(json.error || 'Failed')
      setFinance(json)
    } catch (err) {
      setFinanceErr(err.message)
    }
  }

  return (
    <main>
      <h1>Dashboard</h1>
      <p className="muted" style={{ marginBottom: '14px' }}>Snapshot · switch view below</p>

      <select
        value={view}
        onChange={e => setView(e.target.value)}
        style={{ marginBottom: '16px', fontSize: '14px', fontWeight: 600 }}
      >
        {VIEWS.map(v => <option key={v.key} value={v.key}>{v.label}</option>)}
      </select>

      {!data && <p className="muted">Loading…</p>}
      {data && view === 'overview' && <Overview data={data} />}
      {data && view === 'current' && <CurrentFinances finance={finance} err={financeErr} />}
      {data && view === 'potential' && <PotentialFinances finance={finance} />}
      {data && view === 'sales' && <TicketSales data={data} />}
      {data && view === 'sponsors' && <Sponsors />}
      {data && view === 'bars' && <Bars data={data} />}
    </main>
  )
}

// ---------- OVERVIEW ----------

function Overview({ data }) {
  const today = todayISO()
  const stats = useMemo(() => {
    const groupById = new Map(data.groups.map(g => [g.id, g]))
    const uniqueRiders = new Set()
    let upcoming = 0
    let totalRides = 0
    const nights = new Map()

    for (const m of data.members) {
      const g = groupById.get(m.group_id)
      if (!g) continue
      uniqueRiders.add(m.contact_id)
      totalRides++
      if (g.event_date && g.event_date >= today) upcoming++
      if (g.event_date) nights.set(g.event_date, (nights.get(g.event_date) || 0) + 1)
    }

    const sorted = Array.from(nights.entries()).sort((a, b) => b[0].localeCompare(a[0]))
    const past4 = sorted.filter(([d]) => d < today).slice(0, 4)
    const avgPast4 = past4.length ? Math.round(past4.reduce((s, [, n]) => s + n, 0) / past4.length) : 0

    return {
      contacts: data.contacts.length,
      uniqueRiders: uniqueRiders.size,
      totalRides,
      upcoming,
      smsConsent: data.contacts.filter(c => c.sms_consent).length,
      avgPast4,
      upcomingNights: sorted.filter(([d]) => d >= today).reverse(),
      pastNights: sorted.filter(([d]) => d < today),
    }
  }, [data, today])

  return (
    <>
      <div style={grid2}>
        <StatCard label="Contacts" value={stats.contacts} />
        <StatCard label="Unique riders" value={stats.uniqueRiders} />
        <StatCard label="Upcoming seats" value={stats.upcoming} accent />
        <StatCard label="Avg last 4 nights" value={stats.avgPast4} />
        <StatCard label="SMS consent" value={`${stats.smsConsent}/${stats.contacts}`} />
        <StatCard label="Total rides" value={stats.totalRides} />
      </div>

      <h2>Upcoming nights</h2>
      {stats.upcomingNights.length === 0 ? (
        <p className="muted">No nights booked yet.</p>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {stats.upcomingNights.map(([date, count], i) => (
            <ListRow key={date} left={formatDate(date)} right={<span className="chip">{count} rider{count === 1 ? '' : 's'}</span>} first={i === 0} />
          ))}
        </div>
      )}

      <h2>Last 8 nights</h2>
      {stats.pastNights.length === 0 ? (
        <p className="muted">No past nights recorded.</p>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {stats.pastNights.slice(0, 8).map(([date, count], i) => (
            <ListRow key={date} left={formatDate(date)} right={<span className="chip">{count} rider{count === 1 ? '' : 's'}</span>} first={i === 0} />
          ))}
        </div>
      )}
    </>
  )
}

// ---------- CURRENT FINANCES ----------

function CurrentFinances({ finance, err }) {
  if (err) return <p style={{ color: '#e07a7a' }}>Error: {err}</p>
  if (!finance) return <p className="muted">Loading revenue…</p>

  const stripe = finance.stripe

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Ticket Tailor</h2>
      <div style={grid2}>
        <StatCard label="Past 90 days" value={usd(finance.pastRevenue)} sub={`${finance.pastTickets} riders`} />
        <StatCard label="Upcoming booked" value={usd(finance.upcomingRevenue)} sub={`${finance.upcomingTickets} riders`} accent />
        <StatCard label="Avg/night (last 4)" value={usd(finance.avgPast4Revenue)} sub={`${Math.round(finance.avgPast4Riders)} riders`} />
        <StatCard label="Refunded" value={usd(finance.refunded)} />
      </div>

      {stripe && !stripe.error && (
        <>
          <h2>Stripe</h2>
          <div style={grid2}>
            <StatCard label="Available balance" value={usd(stripe.balanceAvailable)} accent />
            <StatCard label="Pending balance" value={usd(stripe.balancePending)} sub="clearing" />
            <StatCard label="Gross (last 90d)" value={usd(stripe.grossLast90)} sub={`${stripe.chargeCount} charges`} />
            <StatCard label="Fees (last 90d)" value={usd(stripe.feesLast90)} negative />
            <StatCard label="Net (last 90d)" value={usd(stripe.netLast90)} />
            <StatCard label="Paid to bank (90d)" value={usd(stripe.paidOutLast90)} />
          </div>

          {stripe.payouts?.length > 0 && (
            <>
              <h2>Recent payouts</h2>
              <div className="card" style={{ padding: 0 }}>
                {stripe.payouts.map((p, i) => (
                  <ListRow
                    key={p.id}
                    first={i === 0}
                    left={<>
                      <p style={{ fontSize: '14px' }}>{formatUnixDate(p.arrival_date)}</p>
                      <p className="tiny">{p.status}</p>
                    </>}
                    right={<strong style={{ color: p.status === 'paid' ? '#6fbf7f' : '#d4a333' }}>{usd(p.amount)}</strong>}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {stripe?.error && (
        <p style={{ color: '#e07a7a', fontSize: '13px', marginBottom: '12px' }}>Stripe error: {stripe.error}</p>
      )}

      <h2>Revenue by month</h2>
      <div className="card" style={{ padding: 0 }}>
        {finance.months.length === 0 && <p className="muted" style={{ padding: '12px' }}>No months yet.</p>}
        {finance.months.map((m, i) => (
          <ListRow key={m.month} left={formatMonth(m.month)} right={<strong style={{ color: '#d4a333' }}>{usd(m.revenue)}</strong>} first={i === 0} />
        ))}
      </div>

      <h2>Nights</h2>
      <div className="card" style={{ padding: 0 }}>
        {finance.nights.slice(-12).reverse().map((n, i) => (
          <ListRow
            key={n.date}
            first={i === 0}
            left={<>
              <p style={{ fontSize: '14px' }}>{formatDate(n.date)} {n.upcoming && <span className="chip chip-green" style={{ marginLeft: '6px' }}>upcoming</span>}</p>
              <p className="tiny">{n.tickets} rider{n.tickets === 1 ? '' : 's'}</p>
            </>}
            right={<strong style={{ color: '#d4a333' }}>{usd(n.revenue)}</strong>}
          />
        ))}
      </div>
    </>
  )
}

// ---------- POTENTIAL FINANCES (pro forma) ----------

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

function PotentialFinances({ finance }) {
  const [pro, setPro] = useState(DEFAULT_PROFORMA)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) setPro({ ...DEFAULT_PROFORMA, ...JSON.parse(saved) })
    } catch {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(pro)) } catch {}
  }, [pro])

  function seedFromAverage() {
    if (!finance?.avgPast4Riders) return
    const avg = Math.round(finance.avgPast4Riders)
    setPro(p => ({ ...p, fridayRiders: avg, saturdayRiders: avg }))
  }

  const projection = useMemo(() => {
    const ridersPerWeek = Number(pro.fridayRiders) + Number(pro.saturdayRiders)
    const gross = ridersPerWeek * Number(pro.price)
    const ttFee = gross * (Number(pro.ttFeePct) / 100)
    const stripeFee = gross * (Number(pro.stripeFeePct) / 100) + ridersPerWeek * Number(pro.stripeFeeFlat)
    const net = gross - ttFee - stripeFee
    const opCost = Number(pro.costPerNight) * 2
    const profitWeek = net - opCost
    const profitMonth = profitWeek * Number(pro.weeksPerMonth) - Number(pro.monthlyFixed)
    const profitYear = profitMonth * 12

    const variablePerRider = (Number(pro.price) * (Number(pro.ttFeePct) + Number(pro.stripeFeePct)) / 100) + Number(pro.stripeFeeFlat)
    const netPerRider = Number(pro.price) - variablePerRider
    const fixedWeek = opCost + Number(pro.monthlyFixed) / Number(pro.weeksPerMonth)
    const breakEvenWeek = netPerRider > 0 ? Math.ceil(fixedWeek / netPerRider) : null

    return { gross, net, profitWeek, profitMonth, profitYear, ttFee, stripeFee, opCost, netPerRider, breakEvenWeek }
  }, [pro])

  return (
    <>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
          <h3 style={{ margin: 0 }}>Inputs</h3>
          {finance?.avgPast4Riders ? (
            <button className="btn-link" onClick={seedFromAverage}>Use avg ({Math.round(finance.avgPast4Riders)}/night)</button>
          ) : null}
        </div>
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
      <div style={grid2}>
        <StatCard label="Gross / week" value={usd(projection.gross)} />
        <StatCard label="Net / week" value={usd(projection.net)} sub="after fees" />
        <StatCard label="Profit / month" value={usd(projection.profitMonth)} accent={projection.profitMonth >= 0} negative={projection.profitMonth < 0} />
        <StatCard label="Profit / year" value={usd(projection.profitYear)} accent={projection.profitYear >= 0} negative={projection.profitYear < 0} />
      </div>

      <div className="card card-compact">
        <p style={{ fontSize: '13px', color: '#c8c8cc' }}>
          <strong style={{ color: '#d4a333' }}>Break-even:</strong>{' '}
          {projection.breakEvenWeek == null
            ? 'Not reachable at current price'
            : `${projection.breakEvenWeek} riders/week (~${Math.ceil(projection.breakEvenWeek / 2)}/night)`}
        </p>
        <p className="tiny" style={{ marginTop: '4px' }}>
          Net per rider: {usd(projection.netPerRider)} · Operating cost/week: {usd(projection.opCost)}
        </p>
      </div>
    </>
  )
}

// ---------- TICKET SALES ----------

function TicketSales({ data }) {
  const today = todayISO()
  const stats = useMemo(() => {
    const groupById = new Map(data.groups.map(g => [g.id, g]))
    const nights = new Map()
    const stops = new Map()
    for (const m of data.members) {
      const g = groupById.get(m.group_id)
      if (!g?.event_date) continue
      nights.set(g.event_date, (nights.get(g.event_date) || 0) + 1)
      const schedule = Array.isArray(g.schedule) ? g.schedule : []
      const idx = m.current_stop_index
      const stopName = idx != null && schedule[idx]?.name ? schedule[idx].name : 'Unassigned'
      stops.set(stopName, (stops.get(stopName) || 0) + 1)
    }
    return {
      nights: Array.from(nights.entries()).sort((a, b) => b[0].localeCompare(a[0])),
      stops: Array.from(stops.entries()).sort((a, b) => b[1] - a[1]),
    }
  }, [data])

  const max = Math.max(1, ...stats.nights.map(([, n]) => n))
  const stopMax = Math.max(1, ...stats.stops.map(([, n]) => n))

  return (
    <>
      <h2>By night</h2>
      <div className="card" style={{ padding: 0 }}>
        {stats.nights.length === 0 && <p className="muted" style={{ padding: '12px' }}>No nights yet.</p>}
        {stats.nights.map(([date, count], i) => (
          <div key={date} style={rowStyle(i === 0)}>
            <span style={{ fontSize: '13px', color: '#e8e8ea', minWidth: '110px' }}>
              {formatDate(date)}
              {date >= today && <span className="chip chip-green" style={{ marginLeft: '6px' }}>upcoming</span>}
            </span>
            <div style={{ flex: 1, margin: '0 10px', background: '#1a1a1f', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${(count / max) * 100}%`, background: '#d4a333', height: '100%' }} />
            </div>
            <span style={{ fontSize: '13px', color: '#d4a333', fontWeight: 600 }}>{count}</span>
          </div>
        ))}
      </div>

      <h2>By pickup stop (all time)</h2>
      <div className="card" style={{ padding: 0 }}>
        {stats.stops.length === 0 && <p className="muted" style={{ padding: '12px' }}>No rider data.</p>}
        {stats.stops.map(([name, count], i) => (
          <div key={name} style={rowStyle(i === 0)}>
            <span style={{ fontSize: '13px', color: '#e8e8ea', minWidth: '130px' }}>{name}</span>
            <div style={{ flex: 1, margin: '0 10px', background: '#1a1a1f', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${(count / stopMax) * 100}%`, background: '#d4a333', height: '100%' }} />
            </div>
            <span style={{ fontSize: '13px', color: '#d4a333', fontWeight: 600 }}>{count}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ---------- SPONSORS ----------

function Sponsors() {
  const [rows, setRows] = useState(null)
  const [form, setForm] = useState({ name: '', contact: '', tier: '', amount_committed: '', notes: '' })
  const [err, setErr] = useState(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data, error } = await supabase.from('sponsors').select('*').order('created_at', { ascending: false })
    if (error) setErr(error.message)
    else setRows(data || [])
  }

  async function add() {
    if (!form.name) return
    const row = {
      name: form.name,
      contact: form.contact || null,
      tier: form.tier || null,
      amount_committed: form.amount_committed ? Number(form.amount_committed) : null,
      notes: form.notes || null,
      status: 'prospect',
    }
    const { error } = await supabase.from('sponsors').insert(row)
    if (error) setErr(error.message)
    else {
      setForm({ name: '', contact: '', tier: '', amount_committed: '', notes: '' })
      load()
    }
  }

  async function updateStatus(id, status) {
    await supabase.from('sponsors').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  async function updatePaid(id, amount_paid) {
    await supabase.from('sponsors').update({ amount_paid, updated_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  async function remove(id) {
    if (!confirm('Remove sponsor?')) return
    await supabase.from('sponsors').delete().eq('id', id)
    load()
  }

  if (err) return <p style={{ color: '#e07a7a' }}>Error: {err}</p>
  if (!rows) return <p className="muted">Loading…</p>

  const totalCommitted = rows.reduce((s, r) => s + Number(r.amount_committed || 0), 0)
  const totalPaid = rows.reduce((s, r) => s + Number(r.amount_paid || 0), 0)

  return (
    <>
      <div style={grid2}>
        <StatCard label="Sponsors" value={rows.length} />
        <StatCard label="Committed" value={usd(totalCommitted)} />
        <StatCard label="Paid" value={usd(totalPaid)} accent />
        <StatCard label="Outstanding" value={usd(totalCommitted - totalPaid)} />
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '10px' }}>Add sponsor</h3>
        <input placeholder="Name (required)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Contact (email or phone)" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} />
        <input placeholder="Tier (Gold, Silver...)" value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })} />
        <input type="number" placeholder="Amount committed ($)" value={form.amount_committed} onChange={e => setForm({ ...form, amount_committed: e.target.value })} />
        <textarea rows={2} placeholder="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
        <button className="btn-primary" onClick={add} disabled={!form.name}>Add</button>
      </div>

      <h2>Pipeline</h2>
      {rows.length === 0 && <p className="muted">No sponsors yet.</p>}
      {rows.map(r => (
        <div key={r.id} className="card">
          <div className="row" style={{ marginBottom: '6px' }}>
            <div>
              <p style={{ fontWeight: 600, color: '#e8e8ea' }}>{r.name}</p>
              <p className="tiny">{r.tier || '—'} · {r.contact || 'no contact'}</p>
            </div>
            <select
              value={r.status || 'prospect'}
              onChange={e => updateStatus(r.id, e.target.value)}
              style={{ width: 'auto', marginBottom: 0, fontSize: '12px', padding: '4px 8px' }}
            >
              <option value="prospect">Prospect</option>
              <option value="committed">Committed</option>
              <option value="paid">Paid</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="row" style={{ fontSize: '13px' }}>
            <span className="muted">Committed: {usd(r.amount_committed || 0)}</span>
            <span className="muted">
              Paid:{' '}
              <input
                type="number"
                defaultValue={r.amount_paid || 0}
                onBlur={e => updatePaid(r.id, Number(e.target.value) || 0)}
                style={{ width: '80px', display: 'inline-block', marginBottom: 0, fontSize: '12px', padding: '3px 6px', textAlign: 'right' }}
              />
            </span>
          </div>
          {r.notes && <p className="tiny" style={{ marginTop: '6px' }}>{r.notes}</p>}
          <button onClick={() => remove(r.id)} className="btn-link" style={{ color: '#e07a7a', marginTop: '4px' }}>Remove</button>
        </div>
      ))}
    </>
  )
}

// ---------- BARS ----------

function Bars({ data }) {
  const stats = useMemo(() => {
    const byBar = new Map()
    const groupById = new Map(data.groups.map(g => [g.id, g]))
    for (const m of data.members) {
      const g = groupById.get(m.group_id)
      const schedule = Array.isArray(g?.schedule) ? g.schedule : []
      const idx = m.current_stop_index
      const name = idx != null && schedule[idx]?.name ? schedule[idx].name : null
      if (!name) continue
      if (!byBar.has(name)) byBar.set(name, { riders: 0, nights: new Set() })
      const entry = byBar.get(name)
      entry.riders++
      if (g.event_date) entry.nights.add(g.event_date)
    }
    return Array.from(byBar.entries())
      .map(([name, v]) => ({ name, riders: v.riders, nights: v.nights.size, avg: v.nights.size ? v.riders / v.nights.size : 0 }))
      .sort((a, b) => b.riders - a.riders)
  }, [data])

  if (stats.length === 0) {
    return <p className="muted">No rider-to-bar data yet. Riders get mapped to bars once their ticket stop is matched.</p>
  }

  return (
    <>
      <h2>Per-bar totals</h2>
      <div className="card" style={{ padding: 0 }}>
        {stats.map((s, i) => (
          <div key={s.name} style={rowStyle(i === 0)}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '14px', color: '#e8e8ea' }}>{s.name}</p>
              <p className="tiny">{s.nights} night{s.nights === 1 ? '' : 's'} · avg {s.avg.toFixed(1)} riders/night</p>
            </div>
            <span className="chip chip-gold">{s.riders}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ---------- SHARED ----------

const grid2 = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }

function rowStyle(first) {
  return {
    padding: '10px 14px',
    borderTop: first ? 'none' : '1px solid #1a1a1f',
    display: 'flex',
    alignItems: 'center',
  }
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

function ListRow({ left, right, first }) {
  return (
    <div style={{
      padding: '10px 14px',
      borderTop: first ? 'none' : '1px solid #1a1a1f',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    }}>
      <div style={{ fontSize: '14px', color: '#e8e8ea' }}>{left}</div>
      <div>{right}</div>
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
  if (n == null || Number.isNaN(Number(n))) return '$0'
  const num = Number(n)
  const sign = num < 0 ? '-' : ''
  const abs = Math.abs(Math.round(num))
  return sign + '$' + abs.toLocaleString()
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatDate(iso) {
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch { return iso }
}

function formatUnixDate(unix) {
  if (!unix) return ''
  try {
    return new Date(unix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return String(unix) }
}

function formatMonth(ym) {
  try {
    const [y, m] = ym.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  } catch { return ym }
}
