'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const ACCENT = '#d4a333'
const SURFACE = '#15151a'
const BORDER = '#2a2a31'
const LS_KEY = 'the-loop:proforma:v1'

const DEFAULT_PROFORMA = {
  price: 25,
  fridayRiders: 20,
  saturdayRiders: 20,
  costPerNight: 300,
  monthlyFixed: 500,
  ttFeePct: 0,
  stripeFeePct: 2.9,
  stripeFeeFlat: 0.3,
  weeksPerMonth: 4.33,
}

const EXPENSE_CATEGORIES = ['driver_pay', 'fuel', 'insurance', 'marketing', 'platform_fees', 'other']

export default function Finance() {
  const [summary, setSummary] = useState(null)
  const [data, setData] = useState(null)
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pro, setPro] = useState(DEFAULT_PROFORMA)
  const [showProforma, setShowProforma] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY)
      if (saved) setPro({ ...DEFAULT_PROFORMA, ...JSON.parse(saved) })
    } catch {}
    refresh()
  }, [])

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(pro)) } catch {}
  }, [pro])

  async function refresh() {
    setLoading(true); setError(null)
    try {
      const [sumRes, dataRes, groupsRes] = await Promise.all([
        fetch('/api/finance-summary').then(r => r.json()),
        fetch('/api/finance-data').then(r => r.json()),
        supabase.from('groups').select('id, name, event_date').order('event_date', { ascending: false }).limit(40),
      ])
      if (sumRes.error) throw new Error(sumRes.error)
      setSummary(sumRes)
      setData(dataRes)
      setGroups(groupsRes.data || [])
    } catch (err) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  const cashPosition = useMemo(() => {
    const stripe = (summary?.stripe?.balanceAvailable || 0) + (summary?.stripe?.balancePending || 0)
    const bank = (data?.bank || []).reduce((s, b) => s + (b.balance_cents || 0) / 100, 0)
    return { stripe, bank, total: stripe + bank }
  }, [summary, data])

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px', minHeight: '100vh', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16 }}>
        <h1 style={{ fontSize: 28, color: ACCENT, margin: 0 }}>Finance</h1>
        <button onClick={refresh} style={ghostBtn}>Refresh</button>
      </div>

      {loading && <p style={{ color: '#9c9ca3' }}>Loading…</p>}
      {error && <Card style={{ borderColor: '#f87171' }}><span style={{ color: '#f87171' }}>{error}</span></Card>}

      {summary && data && (
        <>
          {/* Cash */}
          <Section title="Cash position">
            <Stats3>
              <Stat label="Total" value={`$${fmt(cashPosition.total)}`} highlight />
              <Stat label="Stripe" value={`$${fmt(cashPosition.stripe)}`} />
              <Stat label="Bank accounts" value={`$${fmt(cashPosition.bank)}`} />
            </Stats3>

            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
              {(data.bank || []).map(b => (
                <BankRow key={b.id} b={b} onChange={refresh} />
              ))}
              <AddBankForm onAdded={refresh} />
            </div>
          </Section>

          {/* Sales */}
          <Section title="Ticket sales (last 90 days)">
            <Stats3>
              <Stat label="Past revenue" value={`$${fmt(summary.pastRevenue)}`} />
              <Stat label="Upcoming revenue" value={`$${fmt(summary.upcomingRevenue)}`} />
              <Stat label="Refunded" value={`$${fmt(summary.refunded)}`} />
            </Stats3>
            <p style={{ color: '#9c9ca3', fontSize: 12, margin: '8px 0 0' }}>
              Avg last 4 nights: {Math.round(summary.avgPast4Riders || 0)} riders · ${fmt(summary.avgPast4Revenue || 0)}
            </p>
            {summary.native?.orderCount > 0 && (
              <p style={{ color: '#9c9ca3', fontSize: 12, margin: '4px 0 0' }}>
                Native orders: {summary.native.orderCount} · ${fmt(summary.native.pastRevenue + summary.native.upcomingRevenue)}
              </p>
            )}
          </Section>

          {/* Sponsors */}
          <Section title="Sponsorships">
            <Stats3>
              <Stat label="Committed" value={`$${fmt(data.sponsorTotals.committed)}`} />
              <Stat label="Paid" value={`$${fmt(data.sponsorTotals.paid)}`} />
              <Stat label="Outstanding" value={`$${fmt(data.sponsorTotals.committed - data.sponsorTotals.paid)}`} />
            </Stats3>
            <div style={{ display: 'grid', gap: 6 }}>
              {(data.sponsors || []).map(s => (
                <div key={s.id} style={listRow}>
                  <div>
                    <strong>{s.name}</strong>
                    <span style={{ color: '#9c9ca3', fontSize: 12, marginLeft: 6 }}>{s.tier || '—'}</span>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 13 }}>
                    <div style={{ color: ACCENT }}>${fmt(s.amount_paid || 0)} / ${fmt(s.amount_committed || 0)}</div>
                    <div style={{ color: '#9c9ca3', fontSize: 11 }}>{s.status || 'pending'}</div>
                  </div>
                </div>
              ))}
              {(!data.sponsors || data.sponsors.length === 0) && (
                <div style={{ color: '#9c9ca3', fontSize: 13 }}>No sponsors yet. Add via SQL or Sponsors page.</div>
              )}
            </div>
          </Section>

          {/* Expenses */}
          <Section title="Expenses">
            <Stats3>
              <Stat label="Month-to-date" value={`$${fmt(data.expensesMTD / 100)}`} />
            </Stats3>
            <AddExpenseForm groups={groups} onAdded={refresh} />
            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
              {(data.expenses || []).slice(0, 30).map(e => (
                <ExpenseRow key={e.id} e={e} groups={groups} onChange={refresh} />
              ))}
              {(!data.expenses || data.expenses.length === 0) && (
                <div style={{ color: '#9c9ca3', fontSize: 13 }}>No expenses logged yet.</div>
              )}
            </div>
          </Section>

          {/* Profit per Loop */}
          <Section title="Profit per Loop">
            {(data.perLoop || []).length === 0 && (
              <div style={{ color: '#9c9ca3', fontSize: 13 }}>
                No data yet — once orders + expenses are tagged to Loops, they show here.
              </div>
            )}
            <div style={{ display: 'grid', gap: 6 }}>
              {(data.perLoop || []).map(l => {
                const profit = l.revenue - l.expenses
                return (
                  <div key={l.id} style={listRow}>
                    <div>
                      <div style={{ fontSize: 11, color: '#9c9ca3' }}>{l.event_date}</div>
                      <strong>{l.name}</strong>
                      <div style={{ fontSize: 11, color: '#9c9ca3', marginTop: 2 }}>{l.tickets} tickets</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 13 }}>
                      <div style={{ color: '#10b981' }}>+${fmt(l.revenue / 100)}</div>
                      <div style={{ color: '#f87171' }}>−${fmt(l.expenses / 100)}</div>
                      <div style={{ color: profit >= 0 ? ACCENT : '#f87171', fontWeight: 700, marginTop: 2 }}>
                        ${fmt(profit / 100)}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* Pro-forma calculator (collapsed) */}
          <Section title={`Projection calculator${showProforma ? '' : ' (click to expand)'}`}>
            <button onClick={() => setShowProforma(s => !s)} style={ghostBtn}>
              {showProforma ? 'Hide' : 'Show'} calculator
            </button>
            {showProforma && (
              <Proforma pro={pro} setPro={setPro} />
            )}
          </Section>
        </>
      )}
    </main>
  )
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function Section({ title, children }) {
  return (
    <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, display: 'grid', gap: 10, marginBottom: 14 }}>
      <h2 style={{ fontSize: 12, color: ACCENT, margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</h2>
      {children}
    </section>
  )
}

function Stats3({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>{children}</div>
}

function Stat({ label, value, highlight }) {
  return (
    <div style={{
      padding: 10,
      background: '#0e0e12',
      border: highlight ? `1px solid ${ACCENT}` : `1px solid ${BORDER}`,
      borderRadius: 8,
    }}>
      <div style={{ fontSize: 10, color: '#9c9ca3', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: highlight ? ACCENT : '#fff', marginTop: 2 }}>{value}</div>
    </div>
  )
}

function Card({ children, style }) {
  return <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, ...style }}>{children}</div>
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
}

const ghostBtn = {
  background: 'transparent',
  border: `1px solid ${BORDER}`,
  color: ACCENT,
  padding: '6px 10px',
  borderRadius: 8,
  fontSize: 12,
  cursor: 'pointer',
}

function AddBankForm({ onAdded }) {
  const [account, setAccount] = useState('NFCU Operating')
  const [balance, setBalance] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!account || !balance) return
    setBusy(true)
    await fetch('/api/finance-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'bank',
        bank: { account_name: account, balance_cents: Math.round(parseFloat(balance) * 100) },
      }),
    })
    setBalance('')
    setBusy(false)
    onAdded()
  }
  return (
    <form onSubmit={submit} style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
      <input value={account} onChange={e => setAccount(e.target.value)} placeholder="Account" style={input} />
      <input value={balance} onChange={e => setBalance(e.target.value)} placeholder="Balance ($)" type="number" step="0.01" style={input} />
      <button type="submit" disabled={busy} style={{ ...ghostBtn, color: '#0a0a0b', background: ACCENT, borderColor: ACCENT }}>
        {busy ? 'Saving…' : 'Update'}
      </button>
    </form>
  )
}

function BankRow({ b, onChange }) {
  async function del() {
    if (!confirm(`Delete snapshot for ${b.account_name}?`)) return
    await fetch(`/api/finance-entries?kind=bank&id=${b.id}`, { method: 'DELETE' })
    onChange()
  }
  return (
    <div style={listRow}>
      <div>
        <strong>{b.account_name}</strong>
        <div style={{ fontSize: 11, color: '#9c9ca3' }}>as of {new Date(b.as_of).toLocaleDateString()}</div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ color: ACCENT, fontWeight: 600 }}>${fmt(b.balance_cents / 100)}</span>
        <button onClick={del} style={ghostBtn}>×</button>
      </div>
    </div>
  )
}

function AddExpenseForm({ groups, onAdded }) {
  const [category, setCategory] = useState('driver_pay')
  const [amount, setAmount] = useState('')
  const [vendor, setVendor] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [groupId, setGroupId] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!amount) return
    setBusy(true)
    await fetch('/api/finance-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'expense',
        expense: {
          category,
          vendor: vendor || null,
          amount_cents: Math.round(parseFloat(amount) * 100),
          group_id: groupId || null,
          expense_date: date,
        },
      }),
    })
    setAmount(''); setVendor('')
    setBusy(false)
    onAdded()
  }
  return (
    <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
      <select value={category} onChange={e => setCategory(e.target.value)} style={input}>
        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
      </select>
      <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="$" type="number" step="0.01" style={input} />
      <input value={vendor} onChange={e => setVendor(e.target.value)} placeholder="Vendor" style={input} />
      <input type="date" value={date} onChange={e => setDate(e.target.value)} style={input} />
      <select value={groupId} onChange={e => setGroupId(e.target.value)} style={input}>
        <option value="">— No Loop —</option>
        {groups.map(g => <option key={g.id} value={g.id}>{g.event_date} · {g.name}</option>)}
      </select>
      <button type="submit" disabled={busy} style={{ ...ghostBtn, color: '#0a0a0b', background: ACCENT, borderColor: ACCENT }}>
        {busy ? 'Adding…' : 'Add'}
      </button>
    </form>
  )
}

function ExpenseRow({ e, groups, onChange }) {
  const group = groups.find(g => g.id === e.group_id)
  async function del() {
    if (!confirm(`Delete expense?`)) return
    await fetch(`/api/finance-entries?kind=expense&id=${e.id}`, { method: 'DELETE' })
    onChange()
  }
  return (
    <div style={listRow}>
      <div>
        <strong style={{ textTransform: 'capitalize' }}>{e.category.replace(/_/g, ' ')}</strong>
        {e.vendor && <span style={{ color: '#9c9ca3', fontSize: 12, marginLeft: 6 }}>{e.vendor}</span>}
        <div style={{ fontSize: 11, color: '#9c9ca3', marginTop: 2 }}>
          {e.expense_date}{group ? ` · ${group.name}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ color: '#f87171', fontWeight: 600 }}>−${fmt(e.amount_cents / 100)}</span>
        <button onClick={del} style={ghostBtn}>×</button>
      </div>
    </div>
  )
}

const input = {
  background: '#0a0a0b',
  border: `1px solid ${BORDER}`,
  color: '#fff',
  padding: '8px 10px',
  borderRadius: 6,
  fontSize: 13,
  width: '100%',
  boxSizing: 'border-box',
}

function Proforma({ pro, setPro }) {
  const projection = useMemo(() => {
    const ridersPerWeek = Number(pro.fridayRiders) + Number(pro.saturdayRiders)
    const grossPerWeek = ridersPerWeek * Number(pro.price)
    const stripeFee = grossPerWeek * (Number(pro.stripeFeePct) / 100) + ridersPerWeek * Number(pro.stripeFeeFlat)
    const netPerWeek = grossPerWeek - stripeFee
    const opCostPerWeek = Number(pro.costPerNight) * 2
    const profitWk = netPerWeek - opCostPerWeek
    const profitMo = profitWk * Number(pro.weeksPerMonth) - Number(pro.monthlyFixed)
    const profitYr = profitMo * 12
    return { grossPerWeek, netPerWeek, profitWk, profitMo, profitYr }
  }, [pro])

  function set(k, v) { setPro(p => ({ ...p, [k]: v })) }

  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
        <Stat label="Wkly gross" value={`$${fmt(projection.grossPerWeek)}`} />
        <Stat label="Wkly net" value={`$${fmt(projection.netPerWeek)}`} />
        <Stat label="Wkly profit" value={`$${fmt(projection.profitWk)}`} highlight />
        <Stat label="Monthly profit" value={`$${fmt(projection.profitMo)}`} />
        <Stat label="Annual profit" value={`$${fmt(projection.profitYr)}`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 6 }}>
        <Lbl label="Ticket price">
          <input type="number" value={pro.price} onChange={e => set('price', e.target.value)} style={input} />
        </Lbl>
        <Lbl label="Friday riders">
          <input type="number" value={pro.fridayRiders} onChange={e => set('fridayRiders', e.target.value)} style={input} />
        </Lbl>
        <Lbl label="Saturday riders">
          <input type="number" value={pro.saturdayRiders} onChange={e => set('saturdayRiders', e.target.value)} style={input} />
        </Lbl>
        <Lbl label="Cost per night">
          <input type="number" value={pro.costPerNight} onChange={e => set('costPerNight', e.target.value)} style={input} />
        </Lbl>
        <Lbl label="Monthly fixed">
          <input type="number" value={pro.monthlyFixed} onChange={e => set('monthlyFixed', e.target.value)} style={input} />
        </Lbl>
      </div>
    </div>
  )
}

function Lbl({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 11, color: '#9c9ca3' }}>
      {label}
      {children}
    </label>
  )
}
