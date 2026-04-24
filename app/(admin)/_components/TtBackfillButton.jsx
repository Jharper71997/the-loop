'use client'

import { useEffect, useState } from 'react'

// TT sync panel. Runs a health check on mount so Jacob sees the state of
// the TT integration at a glance, then lets him kick a per-event backfill.
export default function TtBackfillButton() {
  const [status, setStatus] = useState(null)
  const [statusError, setStatusError] = useState(null)
  const [statusLoading, setStatusLoading] = useState(false)

  const [running, setRunning] = useState(false)
  const [stage, setStage] = useState('') // user-visible activity label
  const [progress, setProgress] = useState(null)
  const [perEvent, setPerEvent] = useState([])
  const [error, setError] = useState(null)

  async function loadStatus() {
    setStatusLoading(true)
    setStatusError(null)
    try {
      const res = await fetch('/api/ticket-tailor-status')
      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('application/json')) {
        const txt = await res.text().catch(() => '')
        setStatusError(`Unexpected response (HTTP ${res.status}). First 100 chars: ${txt.slice(0, 100)}`)
        setStatusLoading(false)
        return
      }
      const json = await res.json()
      if (!res.ok) {
        setStatusError(json.error || `HTTP ${res.status}`)
      } else {
        setStatus(json)
      }
    } catch (err) {
      setStatusError(err.message)
    }
    setStatusLoading(false)
  }

  useEffect(() => {
    loadStatus()
  }, [])

  async function run() {
    if (running) return
    setRunning(true)
    setError(null)
    setPerEvent([])
    setProgress(null)
    setStage('Fetching event list…')

    let eventIds = []
    try {
      const res = await fetch('/api/ticket-tailor-backfill')
      const ct = res.headers.get('content-type') || ''
      if (!ct.includes('application/json')) {
        const txt = await res.text().catch(() => '')
        setError(`list: got non-JSON (HTTP ${res.status}). First 200 chars: ${txt.slice(0, 200)}`)
        setRunning(false)
        setStage('')
        return
      }
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || `list: HTTP ${res.status}`)
        setRunning(false)
        setStage('')
        return
      }
      eventIds = json.event_ids || []
    } catch (err) {
      setError(`list: ${err.message}`)
      setRunning(false)
      setStage('')
      return
    }

    if (!eventIds.length) {
      setError('No groups have a TT event ID yet — the TT webhook needs to fire at least once before there is anything to backfill.')
      setRunning(false)
      setStage('')
      return
    }

    setProgress({ done: 0, total: eventIds.length })
    setStage(`Replaying ${eventIds.length} event${eventIds.length === 1 ? '' : 's'}…`)

    const results = []
    for (let i = 0; i < eventIds.length; i++) {
      const eid = eventIds[i]
      try {
        const res = await fetch(`/api/ticket-tailor-backfill?event_id=${encodeURIComponent(eid)}`, {
          method: 'POST',
        })
        const ct = res.headers.get('content-type') || ''
        if (!ct.includes('application/json')) {
          const txt = await res.text().catch(() => '')
          results.push({
            event_id: eid,
            orders: 0, replayed: 0, errors: 1,
            api_error: `non-JSON HTTP ${res.status}: ${txt.slice(0, 120)}`,
          })
        } else {
          const json = await res.json()
          if (!res.ok) {
            results.push({ event_id: eid, orders: 0, replayed: 0, errors: 1, api_error: json.error || `HTTP ${res.status}` })
          } else {
            const pe = (json.per_event && json.per_event[0]) || { event_id: eid, orders: 0, replayed: 0, errors: 0 }
            results.push(pe)
          }
        }
      } catch (err) {
        results.push({ event_id: eid, orders: 0, replayed: 0, errors: 1, api_error: err.message })
      }
      setPerEvent([...results])
      setProgress({ done: i + 1, total: eventIds.length })
    }
    setRunning(false)
    setStage('')
    loadStatus()
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

      <StatusPanel status={status} error={statusError} loading={statusLoading} onRefresh={loadStatus} />

      {stage && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#f0c24a', fontFamily: "'JetBrains Mono', monospace" }}>
          {stage}
        </div>
      )}

      {progress && progress.total > 0 && (
        <div style={{ marginTop: 10 }}>
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

function StatusPanel({ status, error, loading, onRefresh }) {
  if (loading && !status) {
    return (
      <div style={{ marginTop: 10, fontSize: 11, color: '#6f6f76', fontFamily: "'JetBrains Mono', monospace" }}>
        Checking TT integration status…
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        marginTop: 10,
        padding: '8px 10px',
        borderRadius: 6,
        color: '#e07a7a',
        background: 'rgba(224,122,122,0.08)',
        fontSize: 12,
      }}>
        Status check failed: {error}
        <button onClick={onRefresh} style={statusBtnLink}>retry</button>
      </div>
    )
  }

  if (!status) return null

  const checks = [
    {
      label: 'API key',
      ok: status.api_key_set && status.api_key_probe?.ok === true,
      detail: !status.api_key_set
        ? 'not set on this environment'
        : status.api_key_probe?.ok
          ? 'valid'
          : `rejected: ${status.api_key_probe?.error || 'unknown'}`,
    },
    {
      label: 'Groups w/ TT event ID',
      ok: status.groups_with_tt > 0,
      detail: String(status.groups_with_tt),
    },
    {
      label: 'TT webhooks last 24h',
      ok: status.webhooks_24h > 0,
      detail: String(status.webhooks_24h),
    },
    {
      label: 'Last webhook',
      ok: !!status.last_webhook,
      detail: status.last_webhook
        ? `${status.last_webhook.event_type} · ${status.last_webhook.status}${status.last_webhook.error ? ' · ' + status.last_webhook.error.slice(0, 60) : ''} · ${relTime(status.last_webhook.received_at)}`
        : 'never received',
    },
    {
      label: 'TT orders in DB',
      ok: status.tt_orders_in_db > 0,
      detail: String(status.tt_orders_in_db),
    },
  ]

  return (
    <div style={{
      marginTop: 10,
      padding: '10px 12px',
      borderRadius: 6,
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid #1e1e23',
      fontSize: 12,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
      }}>
        <span style={{
          color: '#9c9ca3',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          letterSpacing: '0.2em',
          textTransform: 'uppercase',
        }}>
          Integration status
        </span>
        <button onClick={onRefresh} style={statusBtnLink}>refresh</button>
      </div>
      <div style={{ display: 'grid', gap: 4 }}>
        {checks.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: c.ok ? '#6fbf7f' : '#e07a7a',
              flexShrink: 0,
            }} />
            <span style={{ color: '#c8c8cc', minWidth: 160 }}>{c.label}</span>
            <span style={{
              color: '#9c9ca3',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              flex: 1,
            }}>
              {c.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const statusBtnLink = {
  background: 'none',
  border: 0,
  color: '#d4a333',
  fontSize: 11,
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'inherit',
}

function relTime(iso) {
  if (!iso) return 'never'
  const then = new Date(iso).getTime()
  const delta = Date.now() - then
  if (delta < 60_000) return 'just now'
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`
  return `${Math.floor(delta / 86_400_000)}d ago`
}
