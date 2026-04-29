'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const INK_MUTED = '#8a8a90'
const BG = '#0a0a0b'
const SURFACE = '#15151a'
const LINE = 'rgba(255,255,255,0.08)'
const GREEN = '#6fbf7f'
const RED = '#e07a7a'

const POLL_MS = 8000

export default function RosterClient({ eventId }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('') // search-by-name
  const [busyItem, setBusyItem] = useState(null)
  const [flash, setFlash] = useState(null) // { itemId, kind, msg }
  const flashTimer = useRef(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/security/roster/${encodeURIComponent(eventId)}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Failed to load roster')
        return
      }
      setData(json)
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [eventId])

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
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
      const res = await fetch(`/api/checkin/${encodeURIComponent(rider.ticket_code)}`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (json.ok) {
        showFlash(rider.order_item_id, 'ok', 'Checked in')
        await load()
      } else if (json.reason === 'already_checked_in') {
        showFlash(rider.order_item_id, 'warn', 'Already checked in')
        await load()
      } else if (json.reason === 'waiver_unsigned') {
        showFlash(rider.order_item_id, 'err', 'Waiver not signed')
      } else if (json.reason === 'voided') {
        showFlash(rider.order_item_id, 'err', 'Ticket voided')
      } else if (json.reason === 'not_paid') {
        showFlash(rider.order_item_id, 'err', 'Payment pending')
      } else {
        showFlash(rider.order_item_id, 'err', json.reason || 'Failed')
      }
    } catch (err) {
      showFlash(rider.order_item_id, 'err', err.message)
    } finally {
      setBusyItem(null)
    }
  }

  const event = data?.event
  const allRiders = data?.riders || []
  const filtered = filter
    ? allRiders.filter(r => {
        const hay = `${r.full_name || ''} ${r.buyer_name || ''} ${r.first_name || ''} ${r.last_name || ''}`.toLowerCase()
        return hay.includes(filter.toLowerCase())
      })
    : allRiders

  const notCheckedIn = filtered.filter(r => !r.checked_in_at)
  const checkedIn = filtered.filter(r => r.checked_in_at)

  return (
    <div style={{ minHeight: '100dvh', background: BG, color: INK, padding: '20px 16px 32px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', display: 'grid', gap: 14 }}>
        <header>
          <div
            style={{
              color: GOLD, fontSize: 11, letterSpacing: '0.2em',
              textTransform: 'uppercase', fontWeight: 700,
            }}
          >
            Brew Loop · Door list
          </div>
          {event ? (
            <>
              <h1 style={{ color: INK, fontSize: 20, fontWeight: 700, margin: '4px 0 0' }}>
                {event.name}
              </h1>
              <div style={{ color: INK_DIM, fontSize: 13, marginTop: 2 }}>
                {formatDate(event.event_date)}
                {event.pickup_time ? ` · ${formatTime(event.pickup_time)}` : ''}
                {event.pickup_spot ? ` · ${event.pickup_spot}` : ''}
              </div>
            </>
          ) : (
            <h1 style={{ color: INK_DIM, fontSize: 20, margin: '4px 0 0' }}>Loading…</h1>
          )}
        </header>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href="/security/door-list" style={ghostBtn}>← All events</Link>
          <Link href="/security" style={ghostBtn}>Camera scanner</Link>
          <button type="button" onClick={load} style={ghostBtn}>Refresh</button>
        </div>

        {error && (
          <div style={{ ...card, color: RED, fontSize: 14 }}>{error}</div>
        )}

        {data && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
          }}>
            <Tally label="Boarded" value={data.checked_in_count} total={data.paid_count} color={GREEN} />
            <Tally label="Still missing" value={data.paid_count - data.checked_in_count} total={data.paid_count} color={GOLD_HI} />
          </div>
        )}

        {data && data.paid_count > 0 && (
          <input
            type="search"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Search rider or buyer name…"
            style={{
              padding: '12px 14px',
              borderRadius: 10,
              border: `1px solid ${LINE}`,
              background: SURFACE,
              color: INK,
              fontSize: 14,
              outline: 'none',
            }}
          />
        )}

        {data && data.paid_count === 0 && (
          <div style={card}>
            <div style={{ color: INK, fontSize: 15, fontWeight: 600 }}>No paid riders yet.</div>
            <div style={{ color: INK_DIM, fontSize: 13, marginTop: 4 }}>
              Once orders clear payment they&apos;ll show up here.
            </div>
          </div>
        )}

        {notCheckedIn.length > 0 && (
          <Section title={`Not boarded (${notCheckedIn.length})`}>
            {notCheckedIn.map(r => (
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

        {checkedIn.length > 0 && (
          <Section title={`Boarded (${checkedIn.length})`}>
            {checkedIn.map(r => (
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

        <p style={{ color: INK_MUTED, fontSize: 11, textAlign: 'center', margin: '4px 0 0' }}>
          Auto-refreshes every {POLL_MS / 1000}s · Pull to refresh on iOS works too
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          color: INK_MUTED, fontSize: 11, letterSpacing: '0.16em',
          textTransform: 'uppercase', fontWeight: 700,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function Tally({ label, value, total, color }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 12, background: SURFACE, border: `1px solid ${LINE}`,
    }}>
      <div style={{ color, fontSize: 24, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value} <span style={{ color: INK_MUTED, fontSize: 14, fontWeight: 600 }}>/ {total}</span>
      </div>
      <div style={{ color: INK_DIM, fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', marginTop: 4 }}>
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
        padding: '12px 14px',
        borderRadius: 12,
        background: checkedIn ? 'rgba(111,191,127,0.06)' : SURFACE,
        border: `1px solid ${checkedIn ? 'rgba(111,191,127,0.28)' : LINE}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: INK, fontSize: 15, fontWeight: 700 }}>
            {rider.full_name || (rider.unclaimed ? 'Unclaimed seat' : 'Guest')}
          </span>
          {rider.waiver_signed
            ? <span style={{ color: GREEN, fontSize: 11, fontWeight: 700 }}>✓ waiver</span>
            : <span style={{ color: RED, fontSize: 11, fontWeight: 700 }}>! waiver</span>}
        </div>
        <div style={{ color: INK_MUTED, fontSize: 12, marginTop: 2 }}>
          {rider.buyer_name && rider.buyer_name !== rider.full_name
            ? `Bought by ${rider.buyer_name}`
            : null}
          {rider.checked_in_at && (
            <span>{rider.buyer_name && rider.buyer_name !== rider.full_name ? ' · ' : ''}Checked in {formatTimeAgo(rider.checked_in_at)} ({rider.checked_in_via || 'manual'})</span>
          )}
          {rider.unclaimed && 'Friend hasn\'t claimed their seat yet'}
        </div>
        {flash && (
          <div style={{
            marginTop: 4, fontSize: 12, fontWeight: 700,
            color: flash.kind === 'ok' ? GREEN : flash.kind === 'warn' ? GOLD_HI : RED,
          }}>
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
            padding: '10px 14px',
            borderRadius: 10,
            background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
            color: '#0a0a0b',
            border: 0,
            fontWeight: 800,
            fontSize: 12,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.6 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {busy ? 'Checking in…' : 'Check in'}
        </button>
      )}
      {!checkedIn && !rider.ticket_code && rider.unclaimed && (
        <span style={{ color: INK_MUTED, fontSize: 11, fontStyle: 'italic' }}>no QR</span>
      )}
    </div>
  )
}

const card = {
  padding: '14px 16px', borderRadius: 12, background: SURFACE, border: `1px solid ${LINE}`,
}

const ghostBtn = {
  padding: '8px 12px', borderRadius: 8, border: `1px solid ${LINE}`,
  color: INK_DIM, background: 'transparent', fontSize: 12, fontWeight: 600,
  textDecoration: 'none', cursor: 'pointer',
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
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

function formatTimeAgo(iso) {
  if (!iso) return ''
  const sec = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  return `${h}h ago`
}
