'use client'

import { useEffect, useState } from 'react'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const SURFACE = '#15151a'
const LINE = 'rgba(255,255,255,0.08)'

const POLL_MS = 15_000

export default function CohortRoll() {
  const [snapshot, setSnapshot] = useState(null)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timer

    async function poll() {
      try {
        const res = await fetch('/api/track/cohort', { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) setErrored(true)
          return
        }
        const json = await res.json()
        if (cancelled) return
        setSnapshot(json || null)
        setErrored(false)
      } catch {
        if (!cancelled) setErrored(true)
      }
    }

    poll()
    timer = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  if (!snapshot || errored) return null
  const stops = Array.isArray(snapshot.stops) ? snapshot.stops : []
  if (!stops.length) return null

  const total = Number.isFinite(snapshot.total) ? snapshot.total : 0

  return (
    <section
      style={{
        background: SURFACE,
        border: `1px solid ${LINE}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: `1px solid ${LINE}`,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div>
          <div
            style={{
              color: GOLD,
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Live cohort
          </div>
          <div style={{ color: INK, fontSize: 14, fontWeight: 600, marginTop: 2 }}>
            {total === 0
              ? 'Riders rolling in soon'
              : `${total} ${total === 1 ? 'friend' : 'friends'} on the Loop tonight`}
          </div>
        </div>
        <span
          style={{
            color: INK_DIM,
            fontSize: 11,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Updates live
        </span>
      </div>

      <div style={{ display: 'grid', gap: 1, background: LINE }}>
        {stops.map(s => <CohortCard key={s.index} stop={s} />)}
      </div>
    </section>
  )
}

function CohortCard({ stop }) {
  const { index, name, count, isCurrent, startTime } = stop
  return (
    <div
      style={{
        background: SURFACE,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        borderLeft: `3px solid ${isCurrent ? GOLD : 'transparent'}`,
      }}
    >
      <span
        aria-hidden
        style={{
          flex: '0 0 auto',
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: `1px solid ${isCurrent ? 'rgba(212,163,51,0.5)' : LINE}`,
          background: isCurrent ? 'rgba(212,163,51,0.12)' : 'rgba(255,255,255,0.02)',
          color: isCurrent ? GOLD_HI : INK_DIM,
          fontSize: 11,
          fontWeight: 800,
          fontFamily: 'ui-monospace, monospace',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          letterSpacing: '0.04em',
        }}
      >
        {String(index + 1).padStart(2, '0')}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            color: isCurrent ? INK : INK,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {name}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
            color: INK_DIM,
            fontSize: 12,
          }}
        >
          {isCurrent && <span style={pulseDot} aria-hidden />}
          <span style={{ color: isCurrent ? INK : INK_DIM, fontWeight: isCurrent ? 600 : 400 }}>
            {labelForCount(count, isCurrent)}
          </span>
          {startTime && (
            <>
              <span aria-hidden style={{ color: LINE }}>·</span>
              <span>Pickup {startTime}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function labelForCount(count, isCurrent) {
  if (!Number.isFinite(count) || count <= 0) return 'No friends here yet'
  if (count === 1) return isCurrent ? '1 friend here now' : '1 friend here'
  return isCurrent ? `${count} friends here now` : `${count} friends here`
}

const pulseDot = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: GOLD,
  boxShadow: `0 0 10px ${GOLD}`,
  display: 'inline-block',
  flex: '0 0 auto',
}
