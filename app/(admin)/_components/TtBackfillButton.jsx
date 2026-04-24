'use client'

import { useState } from 'react'

// Triggers the TT backfill one event at a time so each request stays inside
// Vercel's function timeout. Idempotent — safe to re-run.
export default function TtBackfillButton() {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(null) // { done, total }
  const [perEvent, setPerEvent] = useState([])
  const [error, setError] = useState(null)

  async function run() {
    if (running) return
    setRunning(true)
    setError(null)
    setPerEvent([])
    setProgress({ done: 0, total: 0 })

    let eventIds = []
    try {
      const res = await fetch('/api/ticket-tailor-backfill')
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || `list: HTTP ${res.status}`)
        setRunning(false)
        return
      }
      eventIds = json.event_ids || []
    } catch (err) {
      setError(`list: ${err.message}`)
      setRunning(false)
      return
    }

    if (!eventIds.length) {
      setError('No groups have a TT event ID yet — the TT webhook needs to fire at least once before there is anything to backfill.')
      setRunning(false)
      return
    }

    setProgress({ done: 0, total: eventIds.length })

    const results = []
    for (let i = 0; i < eventIds.length; i++) {
      const eid = eventIds[i]
      try {
        const res = await fetch(`/api/ticket-tailor-backfill?event_id=${encodeURIComponent(eid)}`, {
          method: 'POST',
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          results.push({ event_id: eid, orders: 0, replayed: 0, errors: 1, api_error: json.error || `HTTP ${res.status}` })
        } else {
          const pe = (json.per_event && json.per_event[0]) || { event_id: eid, orders: 0, replayed: 0, errors: 0 }
          results.push(pe)
        }
      } catch (err) {
        results.push({ event_id: eid, orders: 0, replayed: 0, errors: 1, api_error: err.message })
      }
      setPerEvent([...results])
      setProgress({ done: i + 1, total: eventIds.length })
    }
    setRunning(false)
  }

  const totals = perEvent.reduce(
    (acc, pe) => ({
      orders: acc.orders + (pe.orders || 0),
      replayed: acc.replayed + (pe.replayed || 0),
      errors: acc.errors + (pe.errors || 0),
    }),
    { orders: 0, replayed: 0, errors: 0 }
  )

  const progressPct = progress && progress.total
    ? Math.round((progress.done / progress.total) * 100)
    : 0

  return (
    <div
      style={{
        marginTop: 14,
        padding: 14,
        background: '#15151a',
        border: '1px solid #2a2a31',
        borderRadius: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#d4a333',
              fontWeight: 700,
            }}
          >
            Ticket Tailor sync
          </div>
          <div style={{ color: '#9c9ca3', fontSize: 12, marginTop: 4 }}>
            Replays every TT order into Orders, one event at a time. Safe to re-run.
          </div>
        </div>
        <button
          onClick={run}
          disabled={running}
          style={{
            padding: '10px 16px',
            borderRadius: 8,
            border: 0,
            background: running
              ? '#2a2a31'
              : 'linear-gradient(180deg, #f0c24a, #d4a333)',
            color: running ? '#9c9ca3' : '#0a0a0b',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            cursor: running ? 'wait' : 'pointer',
            minHeight: 40,
          }}
        >
          {running ? 'Syncing…' : 'Sync now'}
        </button>
      </div>

      {progress && progress.total > 0 && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: '#0a0a0b',
              border: '1px solid #2a2a31',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #d4a333, #f0c24a)',
                transition: 'width 0.2s',
              }}
            />
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: '#9c9ca3',
              display: 'flex',
              justifyContent: 'space-between',
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: '0.04em',
            }}
          >
            <span>
              {progress.done}/{progress.total} events · {totals.replayed}/{totals.orders} orders replayed
              {totals.errors > 0 ? ` · ${totals.errors} err` : ''}
            </span>
            <span>{progressPct}%</span>
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            marginTop: 10,
            padding: '8px 10px',
            borderRadius: 6,
            color: '#e07a7a',
            background: 'rgba(224,122,122,0.08)',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {perEvent.length > 0 && (
        <details
          style={{
            marginTop: 10,
            padding: '8px 10px',
            borderRadius: 6,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid #1e1e23',
            fontSize: 12,
            color: '#c8c8cc',
          }}
          open={totals.errors > 0}
        >
          <summary style={{ cursor: 'pointer', color: '#9c9ca3' }}>Per-event breakdown</summary>
          <div style={{ marginTop: 6, display: 'grid', gap: 6 }}>
            {perEvent.map(pe => (
              <div
                key={pe.event_id}
                style={{
                  display: 'grid',
                  gap: 2,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span style={{ color: '#6f6f76' }}>{pe.event_id}</span>
                  <span>
                    {pe.replayed}/{pe.orders}
                    {pe.errors > 0 ? ` · ${pe.errors} err` : ''}
                  </span>
                </div>
                {pe.api_error && (
                  <div style={{ color: '#e07a7a', fontSize: 10, paddingLeft: 4 }}>
                    API: {pe.api_error}
                  </div>
                )}
                {Array.isArray(pe.handler_errors) && pe.handler_errors.map((he, i) => (
                  <div key={i} style={{ color: '#e07a7a', fontSize: 10, paddingLeft: 4 }}>
                    {he.order_id}: {he.error}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}
