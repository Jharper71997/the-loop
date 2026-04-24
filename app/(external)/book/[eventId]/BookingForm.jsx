'use client'

import { useEffect, useMemo, useState } from 'react'

const ACCENT = '#d4a333'
const SURFACE = '#15151a'
const BORDER = '#2a2a31'

export default function BookingForm({ eventId, eventName, ticketTypes, waiver }) {
  const defaultTtId = ticketTypes[0]?.id || ''

  const [attribution, setAttribution] = useState(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    const a = {
      qr_code: p.get('qr') || null,
      utm_source: p.get('utm_source') || null,
      utm_medium: p.get('utm_medium') || null,
      utm_campaign: p.get('utm_campaign') || null,
    }
    if (a.qr_code || a.utm_source || a.utm_campaign) setAttribution(a)
  }, [])

  const [buyer, setBuyer] = useState({
    first_name: '', last_name: '', email: '', phone: '', sms_consent: true,
  })
  const [riders, setRiders] = useState([
    {
      ticket_type_id: defaultTtId,
      first_name: '', last_name: '', email: '', phone: '',
      same_as_buyer: true,
      signed_self: true,
      signed_by_buyer: false,
      typed_name: '',
    },
  ])
  const [buyerTypedName, setBuyerTypedName] = useState('')
  const [waiverOpen, setWaiverOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const totalCents = useMemo(() => riders.reduce((s, r) => {
    const tt = ticketTypes.find(t => t.id === r.ticket_type_id)
    return s + (tt?.price_cents || 0)
  }, 0), [riders, ticketTypes])

  function updateRider(idx, patch) {
    setRiders(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  function addRider() {
    setRiders(prev => [...prev, {
      ticket_type_id: defaultTtId,
      first_name: '', last_name: '', email: '', phone: '',
      same_as_buyer: false,
      signed_self: false,
      signed_by_buyer: true,
      typed_name: '',
    }])
  }

  function removeRider(idx) {
    setRiders(prev => prev.filter((_, i) => i !== idx))
  }

  const buyerOwesSig = riders.some(r => r.signed_by_buyer)
  const formValid = useMemo(() => {
    if (!buyer.first_name || !buyer.last_name) return false
    if (!buyer.phone && !buyer.email) return false
    if (!ticketTypes.length) return false
    for (const r of riders) {
      if (!r.ticket_type_id) return false
      if (!r.same_as_buyer && (!r.first_name || !r.last_name)) return false
      if (!r.same_as_buyer && !r.phone && !r.email) return false
      if (r.signed_self && !r.typed_name.trim()) return false
    }
    if (buyerOwesSig && !buyerTypedName.trim()) return false
    return true
  }, [buyer, riders, ticketTypes, buyerOwesSig, buyerTypedName])

  async function onSubmit(e) {
    e.preventDefault()
    if (!formValid || submitting) return
    setSubmitting(true)
    setError(null)

    const ridersPayload = riders.map(r => {
      const baseRider = r.same_as_buyer
        ? {
            first_name: buyer.first_name,
            last_name: buyer.last_name,
            email: buyer.email,
            phone: buyer.phone,
          }
        : {
            first_name: r.first_name,
            last_name: r.last_name,
            email: r.email,
            phone: r.phone,
          }
      return {
        ...baseRider,
        ticket_type_id: r.ticket_type_id,
        signed_self: !!r.signed_self,
        signed_by_buyer: !!r.signed_by_buyer,
        typed_name: r.signed_self ? r.typed_name.trim() : '',
      }
    })

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          buyer,
          riders: ridersPayload,
          buyer_typed_name: buyerTypedName.trim(),
          attribution,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.checkout_url) {
        setError(json.error || `Checkout failed (${res.status})`)
        setSubmitting(false)
        return
      }
      window.location.href = json.checkout_url
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  if (!ticketTypes.length) {
    return (
      <div style={{ padding: 16, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, color: '#bbb' }}>
        No ticket types are set up yet for this event. Check back soon.
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
      <Section title="Your info">
        <Row>
          <Field label="First name" value={buyer.first_name} onChange={v => setBuyer(b => ({ ...b, first_name: v }))} />
          <Field label="Last name" value={buyer.last_name} onChange={v => setBuyer(b => ({ ...b, last_name: v }))} />
        </Row>
        <Row>
          <Field label="Phone" value={buyer.phone} type="tel" onChange={v => setBuyer(b => ({ ...b, phone: v }))} />
          <Field label="Email" value={buyer.email} type="email" onChange={v => setBuyer(b => ({ ...b, email: v }))} />
        </Row>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#bbb' }}>
          <input
            type="checkbox"
            checked={buyer.sms_consent}
            onChange={e => setBuyer(b => ({ ...b, sms_consent: e.target.checked }))}
          />
          Text me my pickup details and the live tracking link.
        </label>
      </Section>

      <Section title={`Riders (${riders.length})`}>
        <div style={{ display: 'grid', gap: 12 }}>
          {riders.map((r, idx) => {
            const tt = ticketTypes.find(t => t.id === r.ticket_type_id)
            return (
              <div key={idx} style={{
                padding: 12,
                background: '#0e0e12',
                border: `1px solid ${BORDER}`,
                borderRadius: 10,
                display: 'grid',
                gap: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: ACCENT, fontSize: 13 }}>Rider {idx + 1}</strong>
                  {idx > 0 && (
                    <button type="button" onClick={() => removeRider(idx)} style={btnGhost}>Remove</button>
                  )}
                </div>

                <select
                  value={r.ticket_type_id}
                  onChange={e => updateRider(idx, { ticket_type_id: e.target.value })}
                  style={input}
                >
                  {ticketTypes.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} — ${(t.price_cents / 100).toFixed(2)}
                    </option>
                  ))}
                </select>

                {idx === 0 ? (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#bbb' }}>
                    <input
                      type="checkbox"
                      checked={r.same_as_buyer}
                      onChange={e => updateRider(idx, { same_as_buyer: e.target.checked })}
                    />
                    This rider is me
                  </label>
                ) : null}

                {!r.same_as_buyer && (
                  <>
                    <Row>
                      <Field label="First name" value={r.first_name} onChange={v => updateRider(idx, { first_name: v })} />
                      <Field label="Last name" value={r.last_name} onChange={v => updateRider(idx, { last_name: v })} />
                    </Row>
                    <Row>
                      <Field label="Phone" value={r.phone} type="tel" onChange={v => updateRider(idx, { phone: v })} />
                      <Field label="Email" value={r.email} type="email" onChange={v => updateRider(idx, { email: v })} />
                    </Row>
                  </>
                )}

                <div style={{ display: 'grid', gap: 6, padding: 10, background: '#15151a', borderRadius: 8, marginTop: 4 }}>
                  <strong style={{ fontSize: 12, color: ACCENT, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    Waiver for this rider
                  </strong>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <input
                      type="radio"
                      name={`sig-${idx}`}
                      checked={r.signed_self}
                      onChange={() => updateRider(idx, { signed_self: true, signed_by_buyer: false })}
                    />
                    This rider signs themselves
                  </label>
                  {idx > 0 && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                      <input
                        type="radio"
                        name={`sig-${idx}`}
                        checked={r.signed_by_buyer}
                        onChange={() => updateRider(idx, { signed_self: false, signed_by_buyer: true })}
                      />
                      I'm signing on their behalf
                    </label>
                  )}

                  {r.signed_self && (
                    <input
                      placeholder="Type rider's full legal name"
                      value={r.typed_name}
                      onChange={e => updateRider(idx, { typed_name: e.target.value })}
                      style={input}
                    />
                  )}
                </div>

                <div style={{ fontSize: 12, color: '#9c9ca3', textAlign: 'right' }}>
                  {tt ? `$${(tt.price_cents / 100).toFixed(2)}` : ''}
                </div>
              </div>
            )
          })}
        </div>

        <button type="button" onClick={addRider} style={{ ...btnGhost, marginTop: 4, width: '100%' }}>
          + Add another rider
        </button>
      </Section>

      <Section title="Liability waiver">
        <button
          type="button"
          onClick={() => setWaiverOpen(o => !o)}
          style={{ ...btnGhost, width: '100%', textAlign: 'left' }}
        >
          {waiverOpen ? 'Hide' : 'Read'} waiver{waiver?.version ? ` (v${waiver.version})` : ''}
        </button>

        {waiverOpen && waiver && (
          <pre style={{
            whiteSpace: 'pre-wrap',
            fontFamily: 'inherit',
            fontSize: 13,
            color: '#ddd',
            background: '#0e0e12',
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            padding: 12,
            margin: 0,
            maxHeight: 280,
            overflowY: 'auto',
          }}>
            {waiver.body_md}
          </pre>
        )}

        {buyerOwesSig && (
          <div style={{ marginTop: 8 }}>
            <label style={{ fontSize: 13, color: '#bbb' }}>
              Type your full legal name to sign on behalf of any riders above:
            </label>
            <input
              value={buyerTypedName}
              onChange={e => setBuyerTypedName(e.target.value)}
              placeholder="Your full legal name"
              style={{ ...input, marginTop: 6 }}
            />
            {buyerTypedName && (
              <div style={{ fontSize: 11, color: '#9c9ca3', marginTop: 4 }}>
                Signed by {buyerTypedName} · {new Date().toLocaleDateString('en-US')}
              </div>
            )}
          </div>
        )}
      </Section>

      {error && (
        <div style={{ padding: 10, background: '#3a1a1a', border: '1px solid #f87171', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
      }}>
        <div>
          <div style={{ fontSize: 12, color: '#9c9ca3', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: ACCENT }}>${(totalCents / 100).toFixed(2)}</div>
        </div>
        <button
          type="submit"
          disabled={!formValid || submitting}
          style={{
            background: formValid && !submitting ? ACCENT : '#5a4720',
            color: '#0a0a0b',
            border: 0,
            padding: '12px 20px',
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 15,
            cursor: formValid && !submitting ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? 'Loading…' : `Pay $${(totalCents / 100).toFixed(2)}`}
        </button>
      </div>
    </form>
  )
}

function Section({ title, children }) {
  return (
    <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
      <h2 style={{ fontSize: 13, color: ACCENT, margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</h2>
      {children}
    </section>
  )
}

function Row({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{children}</div>
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#9c9ca3' }}>
      {label}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} style={input} />
    </label>
  )
}

const input = {
  background: '#0a0a0b',
  border: '1px solid #2a2a31',
  color: '#fff',
  padding: '10px 12px',
  borderRadius: 8,
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
}

const btnGhost = {
  background: 'transparent',
  border: '1px solid #2a2a31',
  color: '#d4a333',
  padding: '8px 12px',
  borderRadius: 8,
  fontSize: 13,
  cursor: 'pointer',
}
