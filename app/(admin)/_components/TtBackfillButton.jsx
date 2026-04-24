'use client'

import { useState } from 'react'

// Triggers POST /api/ticket-tailor-backfill. Idempotent — safe to run any
// number of times; only new TT orders actually change state.
export default function TtBackfillButton() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  async function run() {
    if (running) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/ticket-tailor-backfill', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`)
      } else {
        setResult(json)
      }
    } catch (err) {
      setError(err.message)
    }
    setRunning(false)
  }

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
            Replays every TT order into Orders. Safe to re-run.
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

      {result && (
        <div
          style={{
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: 6,
            background: result.errors > 0 ? 'rgba(212,163,51,0.06)' : 'rgba(111,191,127,0.06)',
            border: `1px solid ${result.errors > 0 ? 'rgba(212,163,51,0.25)' : 'rgba(111,191,127,0.22)'}`,
            fontSize: 12,
            color: '#c8c8cc',
          }}
        >
          <div style={{ color: '#f5f5f7', fontWeight: 600, marginBottom: 4 }}>
            Processed {result.events_processed} event{result.events_processed === 1 ? '' : 's'} ·{' '}
            {result.replayed} order{result.replayed === 1 ? '' : 's'}
            {result.errors > 0 ? `, ${result.errors} error${result.errors === 1 ? '' : 's'}` : ''}
          </div>
          {Array.isArray(result.per_event) && result.per_event.length > 0 && (
            <details style={{ marginTop: 4 }}>
              <summary style={{ cursor: 'pointer', color: '#9c9ca3' }}>Per-event breakdown</summary>
              <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
                {result.per_event.map(pe => (
                  <div
                    key={pe.event_id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 10,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 11,
                    }}
                  >
                    <span style={{ color: '#6f6f76' }}>{pe.event_id}</span>
                    <span>
                      {pe.replayed}/{pe.orders}
                      {pe.errors > 0 ? ` · ${pe.errors} err` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  )
}
