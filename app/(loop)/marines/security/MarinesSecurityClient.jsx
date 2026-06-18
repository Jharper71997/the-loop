'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Scanner from '@/app/_components/Scanner'
import { C, card, eyebrow } from '../../_theme'

const GREEN = '#5fbf7f'
const POLL_MS = 8000

// The Loop (Marines) door check-in. Two modes on one screen:
//   - "Scan": camera scanner (shared Scanner component) → POST the decoded code
//     to /api/loop-security/checkin/<code>; big ADMIT / reject card + tally.
//   - "Door list": polls /api/loop-security/roster every 8s, searchable, with a
//     manual "Check in" button per rider that hits the same endpoint.
// Red theme. No waiver UI anywhere.
export default function MarinesSecurityClient({ eventName = 'The Loop' }) {
  const [view, setView] = useState('scan') // 'scan' | 'list'

  // --- scanner state ---
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState(null)
  const [tally, setTally] = useState({ admitted: 0, rejected: 0 })

  async function onScan(code) {
    if (!code || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/loop-security/checkin/${encodeURIComponent(code)}`, { method: 'POST' })
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
      // Hold the result card readable for a beat before re-arming.
      setTimeout(() => setBusy(false), 1400)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: C.BG, color: C.INK, padding: '20px 16px 32px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'grid', gap: 16 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div style={eyebrow}>The Loop · Door</div>
            <h1 style={{ color: C.INK, fontSize: 22, fontWeight: 700, margin: '4px 0 0' }}>
              Door check-in
            </h1>
            <div style={{ color: C.INK_DIM, fontSize: 13, marginTop: 2 }}>{eventName}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <Counter label="Admitted" value={tally.admitted} color={GREEN} />
            <Counter label="Rejected" value={tally.rejected} color={C.RED} />
          </div>
        </header>

        <div style={{ display: 'flex', gap: 8 }}>
          <TabButton active={view === 'scan'} onClick={() => setView('scan')} label="Scan" />
          <TabButton active={view === 'list'} onClick={() => setView('list')} label="Door list" />
        </div>

        {view === 'scan' ? (
          <>
            <Scanner
              onScan={onScan}
              busy={busy}
              prompt="Aim at the rider's boarding pass"
            />
            <ResultCard last={last} />
            <p style={{ color: C.INK_DIM, fontSize: 12, textAlign: 'center', margin: 0 }}>
              Green = admit. Red = stop. Continuous scan: hold the camera on the next rider.
            </p>
          </>
        ) : (
          <DoorList />
        )}
      </div>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Door list (roster) mode
// ----------------------------------------------------------------------------
function DoorList() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('')
  const [busyItem, setBusyItem] = useState(null)
  const [flash, setFlash] = useState(null) // { itemId, kind, msg }
  const flashTimer = useRef(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/loop-security/roster', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to load door list'); return }
      setData(json)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, POLL_MS)
    function onVis() { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis) }
  }, [load])

  function showFlash(itemId, kind, msg) {
    setFlash({ itemId, kind, msg })
    if (flashTimer.current) clearTimeout(flashTimer.current)
    flashTimer.current = setTimeout(() => setFlash(null), 2400)
  }

  async function manualCheckIn(rider) {
    if (!rider.ticket_code || busyItem) return
    setBusyItem(rider.order_item_id)
    try {
      const res = await fetch(`/api/loop-security/checkin/${encodeURIComponent(rider.ticket_code)}`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (json.ok) {
        showFlash(rider.order_item_id, 'ok', 'Checked in')
        await load()
      } else if (json.reason === 'already_checked_in') {
        showFlash(rider.order_item_id, 'warn', 'Already checked in')
        await load()
      } else if (json.reason === 'voided') {
        showFlash(rider.order_item_id, 'err', 'Ticket voided')
      } else if (json.reason === 'not_paid') {
        showFlash(rider.order_item_id, 'err', 'Payment pending')
      } else if (json.reason === 'wrong_product') {
        showFlash(rider.order_item_id, 'err', 'Not a Loop ticket')
      } else {
        showFlash(rider.order_item_id, 'err', json.reason || 'Failed')
      }
    } catch (err) {
      showFlash(rider.order_item_id, 'err', err.message)
    } finally {
      setBusyItem(null)
    }
  }

  const allRiders = data?.riders || []
  const filtered = filter
    ? allRiders.filter(r => {
        const hay = `${r.name || ''} ${r.buyer_name || ''}`.toLowerCase()
        return hay.includes(filter.toLowerCase())
      })
    : allRiders

  const missing = filtered.filter(r => !r.checked_in_at)
  const boarded = filtered.filter(r => r.checked_in_at)

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {error && <div style={{ ...card, padding: '14px 16px', color: C.RED, fontSize: 14 }}>{error}</div>}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Tally label="Boarded" value={data.boarded} total={data.total} color={GREEN} />
          <Tally label="Still missing" value={data.missing} total={data.total} color={C.RED_HI} />
        </div>
      )}

      {data && data.total > 0 && (
        <input
          type="search"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Search rider or buyer name…"
          style={{
            padding: '12px 14px', borderRadius: 10, border: `1px solid ${C.LINE}`,
            background: C.SURFACE, color: C.INK, fontSize: 14, outline: 'none',
          }}
        />
      )}

      {data && data.total === 0 && (
        <div style={{ ...card, padding: '14px 16px' }}>
          <div style={{ color: C.INK, fontSize: 15, fontWeight: 600 }}>No paid riders yet.</div>
          <div style={{ color: C.INK_DIM, fontSize: 13, marginTop: 4 }}>
            Once orders clear payment they&apos;ll show up here.
          </div>
        </div>
      )}

      {missing.length > 0 && (
        <Section title={`Not boarded (${missing.length})`}>
          {missing.map(r => (
            <RiderRow
              key={r.order_item_id}
              rider={r}
              busy={busyItem === r.order_item_id}
              flash={flash?.itemId === r.order_item_id ? flash : null}
              onCheckIn={() => manualCheckIn(r)}
            />
          ))}
        </Section>
      )}

      {boarded.length > 0 && (
        <Section title={`Boarded (${boarded.length})`}>
          {boarded.map(r => (
            <RiderRow
              key={r.order_item_id}
              rider={r}
              busy={false}
              flash={flash?.itemId === r.order_item_id ? flash : null}
              onCheckIn={null}
            />
          ))}
        </Section>
      )}

      <p style={{ color: C.INK_DIM, fontSize: 11, textAlign: 'center', margin: '4px 0 0' }}>
        Auto-refreshes every {POLL_MS / 1000}s
      </p>
    </div>
  )
}

// ----------------------------------------------------------------------------
// Pieces
// ----------------------------------------------------------------------------
function TabButton({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flex: 1, padding: '10px 12px', borderRadius: 10,
        border: `1px solid ${active ? C.RED : C.LINE}`,
        background: active ? 'rgba(229,72,77,0.14)' : C.SURFACE,
        color: active ? C.RED_HI : C.INK_DIM,
        fontSize: 13, fontWeight: 700, cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

function Counter({ label, value, color }) {
  return (
    <div style={{ display: 'inline-block', marginLeft: 14, textAlign: 'right' }}>
      <div style={{ color, fontSize: 28, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ color: C.INK_DIM, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  )
}

function ResultCard({ last }) {
  if (!last) {
    return (
      <div style={{ ...card, padding: '18px 20px', textAlign: 'center' }}>
        <span style={{ color: C.INK_DIM, fontSize: 13 }}>Waiting for the first scan…</span>
      </div>
    )
  }

  const admit = !!last.ok
  const palette = admit
    ? { bg: 'rgba(95,191,127,0.12)', border: 'rgba(95,191,127,0.45)', accent: GREEN }
    : { bg: 'rgba(229,72,77,0.12)', border: 'rgba(229,72,77,0.45)', accent: C.RED_HI }

  const headline = admit ? 'ADMIT' : reasonHeadline(last.reason)
  const sub = admit
    ? `${last.rider_name || 'Rider'} · ${last.pass_type || 'Ride'}`
    : reasonSubline(last)

  return (
    <div style={{ padding: '20px 22px', borderRadius: 16, background: palette.bg, border: `1.5px solid ${palette.border}` }}>
      <div style={{ color: palette.accent, fontSize: 12, letterSpacing: '0.24em', textTransform: 'uppercase', fontWeight: 700 }}>
        {admit ? 'CHECK-IN OK' : 'NOT ADMITTED'}
      </div>
      <div style={{ color: C.INK, fontSize: 28, fontWeight: 800, marginTop: 4, lineHeight: 1.05 }}>
        {headline}
      </div>
      {sub && <div style={{ color: C.INK_DIM, fontSize: 14, marginTop: 6 }}>{sub}</div>}
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
    case 'not_paid': return 'PAYMENT PENDING'
    case 'voided': return 'TICKET VOIDED'
    case 'wrong_product': return 'NOT A LOOP TICKET'
    case 'unknown_code': return 'UNKNOWN CODE'
    case 'unknown_ticket': return 'TICKET MISSING'
    case 'forbidden': return 'NO ACCESS'
    case 'network': return 'NETWORK'
    default: return 'STOP'
  }
}

function reasonSubline(last) {
  if (last.reason === 'already_checked_in' && last.checked_in_at) {
    return `Already scanned at ${new Date(last.checked_in_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`
  }
  if (last.reason === 'not_paid') return `${last.rider_name || 'Rider'}'s order hasn't cleared payment.`
  if (last.reason === 'voided') return `${last.rider_name || 'This rider'}'s ticket was voided. Do not let them board.`
  if (last.reason === 'wrong_product') return 'This ticket is for a different product, not The Loop.'
  if (last.reason === 'unknown_code') return 'No matching ticket in the system.'
  if (last.reason === 'unknown_ticket') return 'QR is registered but the ticket record is missing.'
  if (last.reason === 'forbidden') return 'Re-enter the access code to continue.'
  if (last.reason === 'network') return last.detail || 'Try again.'
  return null
}

function Section({ title, children }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ color: C.WARM, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Tally({ label, value, total, color }) {
  return (
    <div style={{ padding: '12px 14px', borderRadius: 12, background: C.SURFACE, border: `1px solid ${C.LINE}` }}>
      <div style={{ color, fontSize: 24, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value} <span style={{ color: C.INK_DIM, fontSize: 14, fontWeight: 600 }}>/ {total}</span>
      </div>
      <div style={{ color: C.INK_DIM, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}

function RiderRow({ rider, busy, flash, onCheckIn }) {
  const checkedIn = !!rider.checked_in_at
  return (
    <div
      style={{
        padding: '12px 14px', borderRadius: 12,
        background: checkedIn ? 'rgba(95,191,127,0.06)' : C.SURFACE,
        border: `1px solid ${checkedIn ? 'rgba(95,191,127,0.28)' : C.LINE}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: C.INK, fontSize: 15, fontWeight: 700 }}>
            {rider.name || (rider.unclaimed ? 'Unclaimed seat' : 'Guest')}
          </span>
          <span style={{ color: C.WARM, fontSize: 11, fontWeight: 700 }}>{rider.pass_type}</span>
          {checkedIn && rider.on_board && (
            <span style={{ color: GREEN, fontSize: 11, fontWeight: 700 }}>● on board</span>
          )}
        </div>
        <div style={{ color: C.INK_DIM, fontSize: 12, marginTop: 2 }}>
          {rider.buyer_name && rider.buyer_name !== rider.name ? `Bought by ${rider.buyer_name}` : null}
          {checkedIn && (
            <span>{rider.buyer_name && rider.buyer_name !== rider.name ? ' · ' : ''}Checked in {formatTimeAgo(rider.checked_in_at)}</span>
          )}
          {rider.unclaimed && 'Friend hasn\'t claimed their seat yet'}
        </div>
        {flash && (
          <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: flash.kind === 'ok' ? GREEN : flash.kind === 'warn' ? C.WARM : C.RED }}>
            {flash.msg}
          </div>
        )}
      </div>
      {!checkedIn && rider.ticket_code && onCheckIn && (
        <button
          type="button"
          onClick={onCheckIn}
          disabled={busy}
          style={{
            padding: '10px 14px', borderRadius: 10,
            background: `linear-gradient(180deg, ${C.RED_HI}, ${C.RED})`,
            color: '#fff', border: 0, fontWeight: 800, fontSize: 12,
            cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1, whiteSpace: 'nowrap',
          }}
        >
          {busy ? 'Checking in…' : 'Check in'}
        </button>
      )}
      {!checkedIn && !rider.ticket_code && rider.unclaimed && (
        <span style={{ color: C.INK_DIM, fontSize: 11, fontStyle: 'italic' }}>no QR</span>
      )}
    </div>
  )
}

function formatTimeAgo(iso) {
  if (!iso) return ''
  const sec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  return `${h}h ago`
}
