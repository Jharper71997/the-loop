'use client'

import { useState } from 'react'
import ConsentCheckbox, { PolicyLink } from '@/app/_components/legal/ConsentCheckbox'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const INK_MUTED = '#94949b' // 4.5:1+ on the card background
const LINE = 'rgba(255,255,255,0.10)'
const CARD = 'rgba(255,255,255,0.03)'

export default function PassClient({ plans = [] }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '' })
  const [plan, setPlan] = useState(plans[0]?.id || 'monthly')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Required, never pre-ticked: the rider confirms they understand the pass
  // renews automatically at the price shown until they cancel.
  const [renewalAck, setRenewalAck] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const selected = plans.find(p => p.id === plan) || null
  const priceText = selected?.price ? formatPrice(selected.price) : null
  const ready = form.first_name.trim() && form.phone.trim() && plan && priceText && renewalAck

  async function submit(e) {
    e.preventDefault()
    if (!ready || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/loop-pass', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, plan, renewal_ack: renewalAck }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setError(data.error || 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      window.location.href = data.url
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  if (!plans.length) {
    return (
      <main style={wrap}>
        <h1 style={h1}>Loop Pass</h1>
        <p style={{ color: INK_DIM, marginTop: 8 }}>
          The Loop Pass is coming soon. Text us at (636) 266-1801 to get on the list.
        </p>
      </main>
    )
  }

  return (
    <main style={wrap}>
      <p style={kicker}>Monthly membership</p>
      <h1 style={h1}>Loop Pass</h1>
      <p style={{ color: INK_DIM, marginTop: 8, fontSize: 16, maxWidth: 460 }}>
        Every weekend loop, covered. Book your seat each weekend and it shows $0.
      </p>

      <form onSubmit={submit} style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {plans.map((p) => {
            const active = plan === p.id
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => setPlan(p.id)}
                aria-pressed={active}
                style={{
                  textAlign: 'left',
                  padding: '16px 18px',
                  borderRadius: 14,
                  border: `1.5px solid ${active ? GOLD : LINE}`,
                  background: active ? 'rgba(212,163,51,0.08)' : CARD,
                  color: INK,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{p.label}</span>
                  <span style={{ color: active ? GOLD : INK_DIM, fontSize: 15, fontWeight: 800 }}>
                    {p.price ? formatPrice(p.price) : 'Price unavailable'}
                    <span aria-hidden style={{ marginLeft: 10, fontSize: 18 }}>{active ? '●' : '○'}</span>
                  </span>
                </div>
                <div style={{ color: INK_DIM, fontSize: 13, marginTop: 4 }}>{p.blurb}</div>
              </button>
            )
          })}
        </div>

        <Row>
          <Field label="First name" value={form.first_name} onChange={set('first_name')} autoComplete="given-name" required />
          <Field label="Last name" value={form.last_name} onChange={set('last_name')} autoComplete="family-name" />
        </Row>
        <Field label="Mobile number" value={form.phone} onChange={set('phone')} type="tel" autoComplete="tel" required
          hint="We text your pass details and pickup info to this number. Msg & data rates may apply. Reply STOP to opt out." />
        <Field label="Email (optional)" value={form.email} onChange={set('email')} type="email" autoComplete="email" />

        <div style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid ${LINE}`, background: CARD, display: 'grid', gap: 10 }}>
          <p style={{ color: INK, fontSize: 14, lineHeight: 1.55, margin: 0 }}>
            {priceText
              ? <><strong>{priceText}, billed automatically</strong> starting today and every {intervalWord(selected.price)} after, until you cancel.</>
              : <>We could not load the price right now, so checkout is paused. Please try again shortly.</>}
            {' '}Cancel anytime on the <PolicyLink href="/pass/manage">Manage your Loop Pass</PolicyLink> page or by contacting us; your pass then runs to the end of the period you paid for.
          </p>
          <ConsentCheckbox id="pass-renewal" checked={renewalAck} onChange={setRenewalAck} required>
            I understand my Loop Pass renews automatically{priceText ? ` at ${priceText}` : ''} until I cancel, and I agree to the{' '}
            <PolicyLink href="/terms#loop-pass">Terms of Service</PolicyLink>,{' '}
            <PolicyLink href="/refunds#loop-pass">Refund Policy</PolicyLink> and{' '}
            <PolicyLink href="/privacy">Privacy Policy</PolicyLink>. I am 21 or older.
          </ConsentCheckbox>
        </div>

        {error && <div style={{ color: '#ff9a8a', fontSize: 14 }}>{error}</div>}

        <button type="submit" disabled={!ready || submitting} style={{ ...cta, opacity: !ready || submitting ? 0.55 : 1, cursor: !ready || submitting ? 'default' : 'pointer' }}>
          {submitting ? 'Starting checkout…' : 'Get my Loop Pass'}
        </button>
        <p style={{ color: INK_MUTED, fontSize: 12, textAlign: 'center' }}>
          Secure checkout powered by Stripe. No fees on top of the price shown.
        </p>
      </form>
    </main>
  )
}

function formatPrice(price) {
  const amount = (price.amountCents / 100).toLocaleString('en-US', { style: 'currency', currency: price.currency || 'USD' })
  return `${amount}/${intervalWord(price)}`
}

function intervalWord(price) {
  const n = price?.intervalCount || 1
  const unit = price?.interval || 'month'
  return n === 1 ? unit : `${n} ${unit}s`
}

function Row({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>
}

function Field({ label, hint, ...props }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ color: INK_DIM, fontSize: 13, fontWeight: 600 }}>{label}</span>
      <input
        {...props}
        style={{
          background: CARD,
          border: `1px solid ${LINE}`,
          borderRadius: 10,
          padding: '13px 14px',
          color: INK,
          fontSize: 16,
          outline: 'none',
        }}
      />
      {hint && <span style={{ color: INK_MUTED, fontSize: 12 }}>{hint}</span>}
    </label>
  )
}

const wrap = { maxWidth: 520, margin: '0 auto', padding: '40px 20px 80px' }
const kicker = { color: GOLD, letterSpacing: '0.18em', textTransform: 'uppercase', fontSize: 12, fontWeight: 700, margin: 0 }
const h1 = { color: INK, fontSize: 38, margin: '10px 0 0', letterSpacing: '-0.02em' }
const cta = {
  marginTop: 4,
  padding: '16px 24px',
  borderRadius: 14,
  border: 'none',
  background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
  color: '#0a0a0b',
  fontWeight: 800,
  fontSize: 17,
  letterSpacing: '0.01em',
}
