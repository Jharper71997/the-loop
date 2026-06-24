'use client'

import { useState, useRef } from 'react'
import { C } from '../../_theme'

// Trimmed fork of the Brew Loop BookingForm: no waivers, add-ons, claim links,
// or parties. Name + phone/email, pick a fare, pick a boarding stop, Pay.
// POSTs the same /api/checkout the Brew Loop uses — checkout enforces the
// verification gate server-side and tags the order metadata.kind='marines'.

function money(cents) {
  const d = (cents || 0) / 100
  return d % 1 === 0 ? `$${d.toFixed(0)}` : `$${d.toFixed(2)}`
}

export default function BuyClient({ eventId, ticketTypes = [], stops = [] }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id || '')
  const [pickupIndex, setPickupIndex] = useState(stops[0]?.index ?? 0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [needsVerify, setNeedsVerify] = useState(false)
  const clientToken = useRef(null)
  if (!clientToken.current && typeof crypto !== 'undefined' && crypto.randomUUID) {
    clientToken.current = crypto.randomUUID()
  }

  async function handlePay(e) {
    e.preventDefault()
    setError(null)
    setNeedsVerify(false)

    if (!firstName.trim() || (!phone.trim() && !email.trim())) {
      setError('Add your name and at least a phone or email.')
      return
    }
    if (!ticketTypeId) { setError('Pick a fare.'); return }
    if (stops.length && pickupIndex == null) { setError('Pick where you’re boarding.'); return }

    setSubmitting(true)
    try {
      // Soft gate — let the rider know before they hit Stripe. The real gate is
      // the 403 from /api/checkout below.
      const checkRes = await fetch('/api/marines/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), email: email.trim() }),
      })
      const checkData = await checkRes.json().catch(() => ({}))
      if (!checkData?.verified) {
        setNeedsVerify(true)
        setSubmitting(false)
        return
      }

      const body = {
        event_id: eventId,
        client_token: clientToken.current,
        buyer: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          sms_consent: true,
        },
        riders: [{
          ticket_type_id: ticketTypeId,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          pickup_stop_index: stops.length ? pickupIndex : null,
        }],
      }

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data?.error === 'verification_required') { setNeedsVerify(true); return }
        setError(prettyError(data?.error) || `Could not start checkout (${res.status})`)
        return
      }
      if (data?.checkout_url) {
        window.location.href = data.checkout_url
        return
      }
      setError('Could not start checkout. Try again.')
    } catch (err) {
      setError(err.message || 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const selected = ticketTypes.find(t => t.id === ticketTypeId) || null

  return (
    <form onSubmit={handlePay} style={{ ...card, borderRadius: 16, boxShadow: '0 18px 40px rgba(0,0,0,0.28)', padding: '18px 16px', display: 'grid', gap: 14 }}>
      {/* Fare */}
      <div style={{ display: 'grid', gap: 8 }}>
        <span style={fieldLabel}>Your fare</span>
        <div style={{ display: 'grid', gap: 8 }}>
          {ticketTypes.map(t => {
            const active = t.id === ticketTypeId
            return (
              <button
                type="button"
                key={t.id}
                onClick={() => setTicketTypeId(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '14px 14px', borderRadius: 11, cursor: 'pointer', textAlign: 'left',
                  background: active ? 'rgba(212,163,51,0.10)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${active ? 'rgba(212,163,51,0.6)' : C.LINE}`,
                  color: C.INK,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 800, color: active ? C.GOLD_HI : C.INK }}>{t.name}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: C.WARM }}>{money(t.price_cents)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Boarding stop */}
      {stops.length > 0 && (
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={fieldLabel}>Where are you boarding?</span>
          <select
            style={input}
            value={pickupIndex}
            onChange={e => setPickupIndex(Number(e.target.value))}
          >
            {stops.map(s => (
              <option key={s.index} value={s.index}>
                {s.index + 1}. {s.name}{s.onBase ? ' (on-base gate)' : ''}{s.startTime ? ` · ${formatTime(s.startTime)}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Rider */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={fieldLabel}>First name</span>
          <input style={input} value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="given-name" />
        </label>
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={fieldLabel}>Last name</span>
          <input style={input} value={lastName} onChange={e => setLastName(e.target.value)} autoComplete="family-name" />
        </label>
      </div>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={fieldLabel}>Phone</span>
        <input style={input} type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="(910) 555 0123" />
      </label>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={fieldLabel}>Email</span>
        <input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" />
      </label>

      {needsVerify && (
        <div style={{ padding: '12px 14px', borderRadius: 10, background: 'rgba(212,163,51,0.10)', border: '1px solid rgba(212,163,51,0.45)' }}>
          <div style={{ color: C.GOLD_HI, fontSize: 13.5, fontWeight: 800 }}>One quick step first</div>
          <div style={{ color: C.INK_DIM, fontSize: 13, marginTop: 3, lineHeight: 1.45 }}>
            We don{"'"}t have you cleared to ride yet. Verify your ID once and come right back to buy.
          </div>
          <a href="/marines/verify" style={{ ...primaryCta, display: 'inline-block', marginTop: 10, padding: '10px 16px', fontSize: 14 }}>Verify to ride</a>
        </div>
      )}

      {error && <div style={{ color: '#ff8585', fontSize: 13 }}>{error}</div>}

      <button type="submit" disabled={submitting} style={{ ...primaryCta, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'default' : 'pointer', border: 'none' }}>
        {submitting ? 'Starting checkout…' : (selected ? `Pay ${money(selected.price_cents)}` : 'Continue')}
      </button>
      <div style={{ color: C.INK_DIM, fontSize: 11.5, lineHeight: 1.4, textAlign: 'center' }}>
        ID required to ride. The driver checks an ID at the door.
      </div>
    </form>
  )
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr); const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

function prettyError(code) {
  if (!code) return null
  if (code === 'sold_out') return 'That ride just filled up. Try another fare or stop.'
  if (String(code).startsWith('event_not_on_sale')) return 'This loop isn’t open for booking right now.'
  if (code === 'pickup_required') return 'Pick where you’re boarding.'
  return null
}

const card = { borderRadius: 14, background: C.SURFACE, border: `1px solid ${C.LINE}` }
const fieldLabel = { color: C.INK_DIM, fontSize: 12, fontWeight: 600 }
const input = { width: '100%', padding: '11px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.LINE}`, color: C.INK, fontSize: 15, outline: 'none' }
const primaryCta = { padding: '13px 22px', borderRadius: 10, background: `linear-gradient(180deg, ${C.GOLD_HI}, ${C.GOLD})`, color: '#0a0a0b', fontWeight: 800, fontSize: 15, textDecoration: 'none' }
