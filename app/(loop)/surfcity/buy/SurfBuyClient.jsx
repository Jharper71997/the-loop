'use client'

import { useMemo, useRef, useState } from 'react'
import { C } from '../../_theme'

// Surf City buy form. Trimmed fork of the Brew BookingForm / Marines BuyClient:
// no waivers, parties, add-ons, or verification gate. The rider picks a LOOP
// (a weekend day can have several), then a STOP — each stop is its own fare
// (ticket_type with a stop_index), so picking the stop sets both the fare and
// the boarding point. POSTs the same /api/checkout the Brew Loop uses; checkout
// tags the order metadata.kind='surf'.

function money(cents) {
  const d = (cents || 0) / 100
  return d % 1 === 0 ? `$${d.toFixed(0)}` : `$${d.toFixed(2)}`
}

export default function SurfBuyClient({ loops = [] }) {
  const [eventId, setEventId] = useState(loops[0]?.eventId || '')
  const loop = useMemo(() => loops.find(l => l.eventId === eventId) || loops[0] || null, [loops, eventId])
  const ticketTypes = loop?.ticketTypes || []

  const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id || '')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [agree, setAgree] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const clientToken = useRef(null)
  if (!clientToken.current && typeof crypto !== 'undefined' && crypto.randomUUID) {
    clientToken.current = crypto.randomUUID()
  }

  function onPickLoop(id) {
    setEventId(id)
    const next = loops.find(l => l.eventId === id)
    setTicketTypeId(next?.ticketTypes?.[0]?.id || '')
  }

  const selected = ticketTypes.find(t => t.id === ticketTypeId) || null

  async function handlePay(e) {
    e.preventDefault()
    setError(null)
    if (!firstName.trim() || (!phone.trim() && !email.trim())) {
      setError('Add your name and at least a phone or email.'); return
    }
    if (!eventId) { setError('Pick a loop.'); return }
    if (!ticketTypeId || !selected) { setError('Pick where you’re hopping on.'); return }
    if (!agree) { setError('Please agree to the rider waiver to ride.'); return }

    setSubmitting(true)
    try {
      const typedName = `${firstName.trim()} ${lastName.trim()}`.trim()
      const body = {
        event_id: eventId,
        client_token: clientToken.current,
        buyer_typed_name: typedName,
        buyer: {
          first_name: firstName.trim(), last_name: lastName.trim(),
          email: email.trim(), phone: phone.trim(), sms_consent: true,
        },
        riders: [{
          ticket_type_id: ticketTypeId,
          first_name: firstName.trim(), last_name: lastName.trim(),
          email: email.trim(), phone: phone.trim(),
          pickup_stop_index: selected.stop_index ?? null,
          signed_self: true,
          typed_name: typedName,
        }],
      }
      const res = await fetch('/api/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(prettyError(data?.error) || `Could not start checkout (${res.status})`); return }
      if (data?.checkout_url) { window.location.href = data.checkout_url; return }
      setError('Could not start checkout. Try again.')
    } catch (err) {
      setError(err.message || 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handlePay} style={{ ...card, borderRadius: 16, boxShadow: '0 18px 40px rgba(0,0,0,0.28)', padding: '18px 16px', display: 'grid', gap: 14 }}>
      {/* Loop picker — only when more than one loop is on sale today */}
      {loops.length > 1 && (
        <label style={{ display: 'grid', gap: 6 }}>
          <span style={fieldLabel}>Which loop?</span>
          <select style={input} value={eventId} onChange={e => onPickLoop(e.target.value)}>
            {loops.map(l => (
              <option key={l.eventId} value={l.eventId}>
                {l.name}{l.pickupTime ? ` · ${formatTime(l.pickupTime)}` : ''}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Boarding stop = fare */}
      <div style={{ display: 'grid', gap: 8 }}>
        <span style={fieldLabel}>Where are you hopping on?</span>
        <div style={{ display: 'grid', gap: 8 }}>
          {ticketTypes.map(t => {
            const active = t.id === ticketTypeId
            return (
              <button type="button" key={t.id} onClick={() => setTicketTypeId(t.id)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                padding: '14px 14px', borderRadius: 11, cursor: 'pointer', textAlign: 'left',
                background: active ? 'rgba(212,163,51,0.10)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? 'rgba(212,163,51,0.6)' : C.LINE}`, color: C.INK,
              }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: active ? C.GOLD_HI : C.INK }}>{t.name}</span>
                <span style={{ fontSize: 18, fontWeight: 800, color: C.WARM }}>{money(t.price_cents)}</span>
              </button>
            )
          })}
        </div>
      </div>

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

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, cursor: 'pointer' }}>
        <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} style={{ marginTop: 3, accentColor: C.GOLD, width: 16, height: 16 }} />
        <span style={{ color: C.INK_DIM, fontSize: 12.5, lineHeight: 1.45 }}>
          I agree to the Surf City Loop rider waiver and to receive ride texts. Typing my name above is my signature.
        </span>
      </label>

      {error && <div style={{ color: '#ff8585', fontSize: 13 }}>{error}</div>}

      <button type="submit" disabled={submitting} style={{ ...primaryCta, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'default' : 'pointer', border: 'none' }}>
        {submitting ? 'Starting checkout…' : (selected ? `Pay ${money(selected.price_cents)}` : 'Continue')}
      </button>
      <div style={{ color: C.INK_DIM, fontSize: 11.5, lineHeight: 1.4, textAlign: 'center' }}>
        One ride, every stop. Ride shared with friends, not a private car.
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
  if (code === 'sold_out') return 'That ride just filled up. Try another stop or loop.'
  if (String(code).startsWith('event_not_on_sale')) return 'This loop isn’t open for booking right now.'
  if (code === 'pickup_required') return 'Pick where you’re hopping on.'
  return null
}

const card = { borderRadius: 14, background: C.SURFACE, border: `1px solid ${C.LINE}` }
const fieldLabel = { color: C.INK_DIM, fontSize: 12, fontWeight: 600 }
const input = { width: '100%', padding: '11px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.LINE}`, color: C.INK, fontSize: 15, outline: 'none' }
const primaryCta = { padding: '13px 22px', borderRadius: 10, background: `linear-gradient(180deg, ${C.GOLD_HI}, ${C.GOLD})`, color: '#0a0a0b', fontWeight: 800, fontSize: 15, textDecoration: 'none' }
