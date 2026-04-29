'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const GOLD = '#d4a333'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const INK_MUTED = '#8a8a90'
const BG = '#0a0a0b'
const SURFACE = '#15151a'
const LINE = 'rgba(255,255,255,0.08)'
const GREEN = '#6fbf7f'

export default function DoorListEvents() {
  const [events, setEvents] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/security/events', { cache: 'no-store' })
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setError(json.error || 'Failed to load events')
          return
        }
        setEvents(json.events || [])
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div style={{ minHeight: '100dvh', background: BG, color: INK, padding: '20px 16px 32px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'grid', gap: 16 }}>
        <header>
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
            Door list
          </h1>
          <div style={{ color: INK_DIM, fontSize: 13, marginTop: 4 }}>
            Pick a Loop to see who&apos;s riding.
          </div>
        </header>

        <div style={{ display: 'flex', gap: 8 }}>
          <Link
            href="/security"
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: `1px solid ${LINE}`,
              color: INK_DIM,
              background: 'transparent',
              fontSize: 12,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            ← Camera scanner
          </Link>
        </div>

        {error && (
          <Card>
            <div style={{ color: '#e07a7a', fontSize: 14 }}>{error}</div>
          </Card>
        )}

        {events === null && !error && (
          <Card>
            <div style={{ color: INK_DIM, fontSize: 13 }}>Loading events…</div>
          </Card>
        )}

        {events && events.length === 0 && (
          <Card>
            <div style={{ color: INK, fontWeight: 600, fontSize: 16 }}>
              No upcoming Loops in the next 7 days.
            </div>
            <div style={{ color: INK_DIM, fontSize: 13, marginTop: 6 }}>
              Once a new event is scheduled and on sale it&apos;ll show up here.
            </div>
          </Card>
        )}

        {events && events.map(ev => (
          <Link
            key={ev.id}
            href={`/security/door-list/${ev.id}`}
            style={{
              display: 'block',
              padding: '16px 18px',
              borderRadius: 14,
              background: SURFACE,
              border: `1px solid ${LINE}`,
              textDecoration: 'none',
              color: INK,
            }}
          >
            <div
              style={{
                color: GOLD,
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              {formatDate(ev.event_date)} · {formatTime(ev.pickup_time)}
            </div>
            <div style={{ color: INK, fontSize: 16, fontWeight: 700, marginTop: 4 }}>
              {ev.name}
            </div>
            {ev.pickup_spot && (
              <div style={{ color: INK_DIM, fontSize: 13, marginTop: 4 }}>
                Pickup: {ev.pickup_spot}
              </div>
            )}
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <Progress checkedIn={ev.checked_in_count} paid={ev.paid_count} />
              <div style={{ fontSize: 13, color: INK, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {ev.checked_in_count} <span style={{ color: INK_MUTED, fontWeight: 500 }}>/ {ev.paid_count} boarded</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Card({ children }) {
  return (
    <div style={{
      padding: '16px 18px', borderRadius: 14, background: SURFACE, border: `1px solid ${LINE}`,
    }}>
      {children}
    </div>
  )
}

function Progress({ checkedIn, paid }) {
  const pct = paid > 0 ? Math.min(100, Math.round((checkedIn / paid) * 100)) : 0
  return (
    <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: GREEN }} />
    </div>
  )
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
