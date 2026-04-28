'use client'

import { useState } from 'react'
import Scanner from '../_components/Scanner'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const BG = '#0a0a0b'
const SURFACE = '#15151a'
const LINE = 'rgba(255,255,255,0.08)'
const GREEN = '#6fbf7f'
const RED = '#e07a7a'

export default function SecurityClient() {
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(null)
  const [tally, setTally] = useState({ admitted: 0, rejected: 0 })

  async function onScan(code) {
    if (!code || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/checkin/${encodeURIComponent(code)}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      const result = { ...data, code, status: res.status }
      setLast(result)
      setTally(t => result.ok
        ? { ...t, admitted: t.admitted + 1 }
        : { ...t, rejected: t.rejected + 1 })
    } catch (err) {
      setLast({ ok: false, reason: 'network', detail: err?.message, code })
      setTally(t => ({ ...t, rejected: t.rejected + 1 }))
    } finally {
      // Hold the scanner paused for a beat so the result card is readable.
      setTimeout(() => setBusy(false), 1400)
    }
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: BG,
        color: INK,
        padding: '20px 16px 32px',
      }}
    >
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'grid', gap: 16 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div
              style={{
                color: GOLD,
                fontSize: 11,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              Brew Loop · Security
            </div>
            <h1 style={{ color: INK, fontSize: 22, fontWeight: 700, margin: '4px 0 0' }}>
              Door scanner
            </h1>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Counter label="Admitted" value={tally.admitted} color={GREEN} />
            <Counter label="Rejected" value={tally.rejected} color={RED} />
          </div>
        </header>

        <Scanner
          onScan={onScan}
          busy={busy}
          prompt="Aim at the rider's boarding pass"
        />

        <ResultCard last={last} />

        <p style={{ color: INK_DIM, fontSize: 12, textAlign: 'center', margin: 0 }}>
          Green = admit. Red = stop. Continuous scan: hold the camera on the next rider.
        </p>
      </div>
    </div>
  )
}

function Counter({ label, value, color }) {
  return (
    <div style={{ display: 'inline-block', marginLeft: 14, textAlign: 'right' }}>
      <div style={{ color, fontSize: 28, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ color: INK_DIM, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  )
}

function ResultCard({ last }) {
  if (!last) {
    return (
      <div style={emptyCard}>
        <span style={{ color: INK_DIM, fontSize: 13 }}>Waiting for the first scan…</span>
      </div>
    )
  }

  const tone = last.ok ? 'admit' : 'reject'
  const palette = tone === 'admit'
    ? { bg: 'rgba(111,191,127,0.12)', border: 'rgba(111,191,127,0.45)', accent: GREEN }
    : { bg: 'rgba(224,122,122,0.10)', border: 'rgba(224,122,122,0.40)', accent: RED }

  const headline = tone === 'admit'
    ? 'ADMIT'
    : reasonHeadline(last.reason)
  const sub = tone === 'admit'
    ? `${last.rider_name || 'Rider'} · ${last.event_name || 'Brew Loop'}`
    : reasonSubline(last)

  return (
    <div
      style={{
        padding: '20px 22px',
        borderRadius: 16,
        background: palette.bg,
        border: `1.5px solid ${palette.border}`,
      }}
    >
      <div
        style={{
          color: palette.accent,
          fontSize: 12,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
          fontWeight: 700,
        }}
      >
        {tone === 'admit' ? 'CHECK-IN OK' : 'NOT ADMITTED'}
      </div>
      <div style={{ color: INK, fontSize: 28, fontWeight: 800, marginTop: 4, lineHeight: 1.05 }}>
        {headline}
      </div>
      {sub && (
        <div style={{ color: INK_DIM, fontSize: 14, marginTop: 6 }}>{sub}</div>
      )}
      {last.code && (
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 10, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.2em' }}>
          {last.code.toUpperCase()}
        </div>
      )}
    </div>
  )
}

function reasonHeadline(reason) {
  switch (reason) {
    case 'already_checked_in': return 'ALREADY USED'
    case 'waiver_unsigned': return 'WAIVER UNSIGNED'
    case 'not_paid': return 'PAYMENT PENDING'
    case 'voided': return 'TICKET VOIDED'
    case 'unknown_code': return 'UNKNOWN CODE'
    case 'unknown_ticket': return 'TICKET MISSING'
    case 'forbidden': return 'NO ACCESS'
    case 'unauthenticated': return 'SIGN IN'
    case 'network': return 'NETWORK'
    default: return 'STOP'
  }
}

function reasonSubline(last) {
  if (last.reason === 'already_checked_in' && last.checked_in_at) {
    return `Already scanned at ${new Date(last.checked_in_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
  }
  if (last.reason === 'waiver_unsigned') {
    return `${last.rider_name || 'Rider'} hasn't signed the waiver. Have them sign on their phone before boarding.`
  }
  if (last.reason === 'not_paid') {
    return `${last.rider_name || 'Rider'}'s order hasn't cleared payment.`
  }
  if (last.reason === 'voided') {
    return `${last.rider_name || 'This rider'}'s ticket was voided. Do not let them board.`
  }
  if (last.reason === 'unknown_code') return 'No matching ticket in the system.'
  if (last.reason === 'unknown_ticket') return 'QR is registered but the ticket record is missing.'
  if (last.reason === 'forbidden') return 'This account isn\'t on the security allowlist.'
  if (last.reason === 'unauthenticated') return 'Sign in to /login first.'
  if (last.reason === 'network') return last.detail || 'Try again.'
  return null
}

const emptyCard = {
  padding: '18px 20px',
  borderRadius: 16,
  background: SURFACE,
  border: `1px solid ${LINE}`,
  textAlign: 'center',
}
