'use client'

import { useState } from 'react'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const INK_MUTED = '#8a8a90'
const LINE = 'rgba(255,255,255,0.08)'
const RED = '#e07a7a'
const GREEN = '#6fbf7f'

export default function MyTicketsClient() {
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [searched, setSearched] = useState(false)
  const [orders, setOrders] = useState([])
  const [error, setError] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/my-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.error === 'rate_limited') {
          setError(`Slow down — try again in ${json.retry_after_seconds || 60} seconds.`)
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

  function reset() {
    setSearched(false)
    setOrders([])
    setError(null)
  }

  if (searched) {
    return (
      <div style={{ display: 'grid', gap: 16 }}>
        {orders.length === 0 && (
          <Card>
            <div style={{ color: INK, fontWeight: 600, fontSize: 17, marginBottom: 6 }}>
              No tickets found.
            </div>
            <p style={{ color: INK_DIM, margin: 0, fontSize: 14 }}>
              Double-check the phone number you booked with. If it still doesn’t match, text us at{' '}
              <a href="sms:+16362661801" style={{ color: GOLD, textDecoration: 'none', fontWeight: 600 }}>
                (636) 266-1801
              </a>{' '}
              and we’ll track it down.
            </p>
          </Card>
        )}

        {orders.map(o => <OrderCard key={o.id} order={o} phone={phone} />)}

        <button
          type="button"
          onClick={reset}
          style={{
            padding: '12px 22px',
            borderRadius: 999,
            background: 'transparent',
            color: INK,
            border: `1px solid ${LINE}`,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            justifySelf: 'center',
          }}
        >
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
          style={{ ...inputStyle, fontSize: 18, padding: '16px 16px' }}
        />
      </label>

      {error && (
        <div style={{ color: RED, fontSize: 13, padding: '8px 12px', background: 'rgba(224,122,122,0.08)', borderRadius: 8 }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || phone.replace(/\D/g, '').length < 10}
        style={{
          marginTop: 4,
          padding: '18px 24px',
          borderRadius: 12,
          background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
          color: '#0a0a0b',
          border: 0,
          fontWeight: 700,
          fontSize: 17,
          cursor: submitting ? 'wait' : 'pointer',
          opacity: submitting || phone.replace(/\D/g, '').length < 10 ? 0.6 : 1,
          boxShadow: '0 10px 30px rgba(212,163,51,0.25)',
        }}
      >
        {submitting ? 'Looking up…' : 'Find my tickets'}
      </button>

      <p style={{ color: INK_MUTED, fontSize: 12, textAlign: 'center', margin: '8px 0 0' }}>
        Enter the phone you booked with — we’ll show your tickets and waiver.
      </p>
    </form>
  )
}

function OrderCard({ order, phone }) {
  const ev = order.event
  const eventDate = ev?.event_date ? formatDate(ev.event_date) : null
  const pickupTime = ev?.pickup_time ? formatTime(ev.pickup_time) : null
  const waiverHref = order.contact_id ? `/waiver/${order.contact_id}` : '/waiver'

  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState(null)

  async function onResend() {
    if (resending) return
    setResending(true)
    setResendMsg(null)
    try {
      const res = await fetch('/api/my-tickets/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: order.id, phone }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.error === 'rate_limited') {
          const mins = Math.ceil((json.retry_after_seconds || 300) / 60)
          setResendMsg({ kind: 'err', text: `Try again in ${mins} min.` })
        } else {
          setResendMsg({ kind: 'err', text: json.error || 'Resend failed.' })
        }
      } else {
        setResendMsg({ kind: 'ok', text: 'Sent — check your phone & email.' })
      }
    } catch (err) {
      setResendMsg({ kind: 'err', text: err.message })
    }
    setResending(false)
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
        <div>
          <div
            style={{
              color: GOLD,
              fontSize: 11,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            {eventDate || 'Event'}
            {pickupTime ? ` · ${pickupTime}` : ''}
          </div>
          <h3 style={{ color: INK, fontSize: 18, fontWeight: 600, margin: '4px 0 0' }}>
            {ev?.name || 'Brew Loop'}
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
            color: order.status === 'paid' ? GREEN : GOLD,
            background: order.status === 'paid' ? 'rgba(111,191,127,0.12)' : 'rgba(212,163,51,0.12)',
            border: `1px solid ${order.status === 'paid' ? 'rgba(111,191,127,0.3)' : 'rgba(212,163,51,0.3)'}`,
            whiteSpace: 'nowrap',
          }}
        >
          {order.status === 'paid' ? 'Paid' : order.status}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', color: INK_DIM, fontSize: 14, marginBottom: 12 }}>
        <span>{order.party_size} seat{order.party_size === 1 ? '' : 's'}</span>
        {order.total_cents != null && <span>${(order.total_cents / 100).toFixed(2)} total</span>}
      </div>

      <div
        style={{
          padding: '12px 14px',
          borderRadius: 10,
          background: order.waiver_signed ? 'rgba(111,191,127,0.08)' : 'rgba(212,163,51,0.1)',
          border: `1px solid ${order.waiver_signed ? 'rgba(111,191,127,0.28)' : 'rgba(212,163,51,0.35)'}`,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 20, color: order.waiver_signed ? GREEN : GOLD_HI }}>
          {order.waiver_signed ? '✓' : '!'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: INK, fontWeight: 600, fontSize: 14 }}>
            {order.waiver_signed ? 'Waiver signed — you’re clear to ride' : 'Waiver not signed yet'}
          </div>
          <div style={{ color: INK_DIM, fontSize: 12, marginTop: 2 }}>
            {order.waiver_signed
              ? 'Nothing else needed before pickup.'
              : 'Every rider signs one before pickup. 30 seconds.'}
          </div>
        </div>
        {!order.waiver_signed && (
          <a
            href={waiverHref}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
              color: '#0a0a0b',
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Sign
          </a>
        )}
      </div>

      {order.riders?.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 12, color: INK_MUTED }}>
          Riders:{' '}
          {order.riders.map((r, i) => (
            <span key={i}>
              {r.name || (r.unclaimed ? 'Unclaimed' : 'Guest')}
              {r.waiver_signed ? <span style={{ color: GREEN, marginLeft: 4 }}>✓</span> : null}
              {i < order.riders.length - 1 ? ', ' : ''}
            </span>
          ))}
        </div>
      )}

      {order.status === 'paid' && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
          <button
            type="button"
            onClick={onResend}
            disabled={resending}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 10,
              background: 'transparent',
              border: `1px solid ${LINE}`,
              color: INK,
              fontWeight: 600,
              fontSize: 13,
              cursor: resending ? 'wait' : 'pointer',
            }}
          >
            {resending ? 'Sending…' : 'Resend ticket links'}
          </button>
          {resendMsg && (
            <div style={{
              marginTop: 8,
              fontSize: 12,
              color: resendMsg.kind === 'ok' ? GREEN : RED,
              textAlign: 'center',
            }}>
              {resendMsg.text}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function Card({ children }) {
  return (
    <div
      style={{
        padding: '20px 22px',
        borderRadius: 14,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))',
        border: `1px solid ${LINE}`,
      }}
    >
      {children}
    </div>
  )
}

const labelStyle = {
  color: INK_DIM,
  fontSize: 12,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  fontWeight: 600,
}

const inputStyle = {
  width: '100%',
  padding: '14px 14px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.03)',
  color: INK,
  fontSize: 16,
  outline: 'none',
  boxSizing: 'border-box',
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
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
