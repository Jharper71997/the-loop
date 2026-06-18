'use client'

import { useState } from 'react'
import { C, card, sectionLabel, primaryCta, ghostCta } from '../../_theme'

const GREEN = '#5fc97a'

// Phone-lookup for The Loop passes — red-themed fork of Brew Loop's
// MyTicketsClient. POSTs the phone to /api/marines/my-tickets, then lists each
// order with its event date and every rider's pass (name, type chip, QR
// thumbnail, and a link to the full pass at /marines/tickets/<code>). No waiver
// pills, no bar/alcohol cues.
export default function MarinesMyTicketsClient() {
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [searched, setSearched] = useState(false)
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)

  const digits = phone.replace(/\D/g, '')

  async function lookup(rawPhone) {
    const p = (rawPhone || '').trim()
    if (p.replace(/\D/g, '').length < 10) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/marines/my-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: p }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.error === 'rate_limited') {
          setError(`Slow down. Try again in ${json.retry_after_seconds || 60} seconds.`)
        } else {
          setError(json.error || 'Something went wrong. Try again.')
        }
        setSubmitting(false)
        return
      }
      setOrders(json.orders || [])
      setSearched(true)
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  function onSubmit(e) {
    e.preventDefault()
    if (submitting) return
    lookup(phone)
  }

  function reset() {
    setSearched(false)
    setOrders([])
    setError(null)
    setPhone('')
  }

  if (searched) {
    return (
      <div style={{ display: 'grid', gap: 14 }}>
        {orders.length === 0 && (
          <div style={{ ...card, padding: '20px 18px' }}>
            <div style={{ color: C.INK, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
              No passes found for that number.
            </div>
            <p style={{ color: C.INK_DIM, margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              Double-check the phone you booked with and try again.
            </p>
          </div>
        )}

        {orders.map(o => <OrderCard key={o.id} order={o} />)}

        <button type="button" onClick={reset} style={{ ...ghostCta, justifySelf: 'center', cursor: 'pointer' }}>
          Look up another
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 14 }}>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={labelStyle}>Phone number</span>
        <input
          type="tel"
          required
          autoFocus
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="(910) 555-0123"
          style={inputStyle}
        />
      </label>

      {error && (
        <div style={{ color: C.RED_HI, fontSize: 13, padding: '8px 12px', background: 'rgba(229,72,77,0.1)', borderRadius: 8, border: `1px solid rgba(229,72,77,0.3)` }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || digits.length < 10}
        style={{
          ...primaryCta,
          width: '100%',
          textAlign: 'center',
          border: 0,
          cursor: submitting ? 'wait' : 'pointer',
          opacity: submitting || digits.length < 10 ? 0.6 : 1,
        }}
      >
        {submitting ? 'Looking up…' : 'Find my passes'}
      </button>

      <p style={{ color: C.INK_DIM, fontSize: 12, textAlign: 'center', margin: '4px 0 0' }}>
        Enter the phone you booked with.
      </p>
    </form>
  )
}

function OrderCard({ order }) {
  const ev = order.event
  const eventDate = ev?.event_date ? formatDate(ev.event_date) : null
  const pickupTime = ev?.pickup_time ? formatTime(ev.pickup_time) : null
  const riders = order.riders || []

  return (
    <div style={{ ...card, borderRadius: 16, boxShadow: '0 16px 34px rgba(0,0,0,0.26)', padding: '18px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: C.RED, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
            {eventDate || 'The Loop'}
            {pickupTime ? ` · ${pickupTime}` : ''}
          </div>
          <h3 style={{ color: C.INK, fontSize: 18, fontWeight: 700, margin: '4px 0 0' }}>
            {ev?.name || 'The Loop'}
          </h3>
        </div>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: order.status === 'paid' ? GREEN : C.RED_HI,
            background: order.status === 'paid' ? 'rgba(95,201,122,0.12)' : 'rgba(229,72,77,0.12)',
            border: `1px solid ${order.status === 'paid' ? 'rgba(95,201,122,0.32)' : 'rgba(229,72,77,0.4)'}`,
            whiteSpace: 'nowrap',
          }}
        >
          {order.status === 'paid' ? 'Paid' : order.status}
        </span>
      </div>

      {riders.length > 0 ? (
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={sectionLabel}>Passes</div>
          {riders.map((r, i) => <RiderRow key={i} rider={r} />)}
          {order.status !== 'paid' && !riders.some(r => r.ticket_code) && (
            <div style={{ color: C.INK_DIM, fontSize: 11, lineHeight: 1.4 }}>
              Your passes appear here once your payment finishes processing.
            </div>
          )}
        </div>
      ) : (
        <div style={{ color: C.INK_DIM, fontSize: 13 }}>No active passes on this order.</div>
      )}
    </div>
  )
}

function RiderRow({ rider: r }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: 10,
        padding: '12px',
        background: C.SURFACE_HI,
        border: `1px solid ${C.LINE}`,
        borderRadius: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: C.INK, fontSize: 14, fontWeight: 700 }}>
            {r.name || 'Rider'}
          </span>
          {r.pass_type && (
            <span style={{
              padding: '3px 10px', borderRadius: 999,
              background: 'rgba(229,72,77,0.14)', border: `1px solid ${C.RED}`, color: C.RED_HI,
              fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
            }}>
              {r.pass_type}
            </span>
          )}
        </div>
        {r.ticket_url && (
          <a
            href={r.ticket_url}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'transparent',
              color: C.INK_DIM,
              border: `1px solid ${C.LINE}`,
              fontWeight: 600,
              fontSize: 11,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Open full pass
          </a>
        )}
      </div>

      {r.ticket_qr_data_url && r.ticket_url && (
        <a
          href={r.ticket_url}
          target="_blank"
          rel="noreferrer"
          style={{
            background: '#ffffff',
            borderRadius: 12,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            textDecoration: 'none',
            boxShadow: '0 0 0 1px rgba(229,72,77,0.4)',
          }}
        >
          <img
            src={r.ticket_qr_data_url}
            alt={`Pass QR for ${r.name || 'rider'}`}
            style={{ width: '100%', maxWidth: 220, height: 'auto', display: 'block' }}
          />
          <div
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 10,
              letterSpacing: '0.2em',
              color: '#3a3a44',
              textTransform: 'uppercase',
            }}
          >
            {r.ticket_code}
          </div>
        </a>
      )}
    </div>
  )
}

const labelStyle = {
  color: C.INK_DIM,
  fontSize: 12,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  fontWeight: 600,
}

const inputStyle = {
  width: '100%',
  padding: '16px 16px',
  borderRadius: 10,
  border: `1px solid ${C.LINE}`,
  background: C.SURFACE,
  color: C.INK,
  fontSize: 18,
  outline: 'none',
  boxSizing: 'border-box',
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York',
    })
  } catch { return iso }
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
