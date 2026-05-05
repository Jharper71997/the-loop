'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

const KIND_COLORS = {
  webhook_error: '#f87171',
  finalize_failed: '#f87171',
  sms_failed: '#f0c24a',
  email_failed: '#f0c24a',
  push_failed: '#f0c24a',
}

export default function NotificationsClient({ initial }) {
  const [rows, setRows] = useState(initial)
  const [filter, setFilter] = useState('open')

  const filtered = useMemo(() => {
    if (filter === 'all') return rows
    if (filter === 'open') return rows.filter(r => !r.resolved_at)
    if (filter === 'resolved') return rows.filter(r => !!r.resolved_at)
    return rows.filter(r => r.kind === filter)
  }, [rows, filter])

  async function markResolved(id) {
    await supabase
      .from('notifications')
      .update({ resolved_at: new Date().toISOString() })
      .eq('id', id)
    setRows(prev => prev.map(r => r.id === id ? { ...r, resolved_at: new Date().toISOString() } : r))
  }

  const kinds = Array.from(new Set(rows.map(r => r.kind)))

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <FilterButton active={filter === 'open'} onClick={() => setFilter('open')}>Open</FilterButton>
        <FilterButton active={filter === 'resolved'} onClick={() => setFilter('resolved')}>Resolved</FilterButton>
        <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterButton>
        <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>·</span>
        {kinds.map(k => (
          <FilterButton key={k} active={filter === k} onClick={() => setFilter(k)}>{k}</FilterButton>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="muted" style={{ textAlign: 'center', padding: '32px 0' }}>No alerts here.</p>
      ) : (
        filtered.map(r => (
          <div key={r.id} className="card" style={{ borderLeft: `3px solid ${KIND_COLORS[r.kind] || '#d4a333'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{
                  color: KIND_COLORS[r.kind] || '#d4a333',
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  marginBottom: 4,
                }}>
                  {r.kind} · {r.severity} · {formatTime(r.created_at)}
                </div>
                <p style={{ margin: 0, color: '#e8e8ea', fontSize: 14, fontWeight: 600 }}>
                  {r.subject || '(no subject)'}
                </p>
                {r.body && (
                  <pre style={{
                    margin: '8px 0 0',
                    padding: 10,
                    background: '#0e0e12',
                    border: '1px solid #1e1e23',
                    borderRadius: 6,
                    color: '#bbb',
                    fontSize: 12,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'ui-monospace, monospace',
                    overflowX: 'auto',
                  }}>{r.body}</pre>
                )}
                {r.context && (
                  <details style={{ marginTop: 8, color: '#8a8a90', fontSize: 11 }}>
                    <summary style={{ cursor: 'pointer' }}>Context</summary>
                    <pre style={{ margin: '6px 0 0', fontFamily: 'ui-monospace, monospace', whiteSpace: 'pre-wrap' }}>
                      {JSON.stringify(r.context, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                {r.notified_at && (
                  <span className="chip" style={{ fontSize: 10 }}>Emailed</span>
                )}
                {r.resolved_at ? (
                  <span className="chip" style={{ fontSize: 10, color: '#6fbf7f', borderColor: '#6fbf7f' }}>Resolved</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => markResolved(r.id)}
                    style={{
                      background: '#1c1c22',
                      color: '#d4a333',
                      border: '1px solid #2a2a2f',
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Mark resolved
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: active ? '#d4a333' : 'transparent',
        color: active ? '#0a0a0b' : '#c8c8cc',
        border: '1px solid #2a2a31',
        padding: '5px 10px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'ui-monospace, monospace',
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </button>
  )
}

function formatTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: 'America/Indiana/Indianapolis',
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    })
  } catch { return iso }
}
