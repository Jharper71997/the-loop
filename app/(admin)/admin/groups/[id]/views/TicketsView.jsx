'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ACCENT = '#d4a333'
const ACCENT_HI = '#f0c24a'
const SURFACE = '#15151a'
const BORDER = '#2a2a31'
const INK = '#f5f5f7'
const INK_DIM = '#9c9ca3'

export default function TicketsView({ event, ticketTypes, stops }) {
  const router = useRouter()
  const [editing, setEditing] = useState(null) // null | 'new' | ticket_type id

  function openNew() {
    if (!event?.id) {
      alert('Set up the event first (Edit event and tickets) before adding ticket types.')
      return
    }
    setEditing('new')
  }

  if (!event?.id) {
    return (
      <div style={{ display: 'grid', gap: 16, maxWidth: 800 }}>
        <Header title="Tickets and items" />
        <div style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          color: INK_DIM,
          fontSize: 14,
        }}>
          Add the event basics in <strong style={{ color: INK }}>Edit event and tickets</strong> first.
          Once that's saved you can come back here to define ticket types.
        </div>
      </div>
    )
  }

  const sorted = [...ticketTypes].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <Header title="Tickets and items" />
        <button type="button" onClick={openNew} style={primaryBtn}>
          + Add ticket type
        </button>
      </div>

      {sorted.length === 0 ? (
        <div style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 24,
          textAlign: 'center',
          color: INK_DIM,
          fontSize: 14,
        }}>
          No ticket types yet. Tap <strong style={{ color: INK }}>Add ticket type</strong> to create one.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {sorted.map(tt => (
            <TicketRow key={tt.id} tt={tt} stops={stops} onEdit={() => setEditing(tt.id)} />
          ))}
        </div>
      )}

      {editing && (
        <TicketModal
          eventId={event.id}
          ticket={editing === 'new' ? null : sorted.find(t => t.id === editing)}
          stops={stops}
          existingCount={sorted.length}
          onClose={(changed) => {
            setEditing(null)
            if (changed) router.refresh()
          }}
        />
      )}
    </div>
  )
}

function Header({ title }) {
  return (
    <h1 style={{
      fontSize: 22,
      color: INK,
      margin: 0,
      fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    }}>
      {title}
    </h1>
  )
}

function TicketRow({ tt, stops, onEdit }) {
  const stopName = tt.stop_index != null && stops[tt.stop_index]?.name
  const isActive = tt.active !== false
  return (
    <button
      type="button"
      onClick={onEdit}
      style={{
        width: '100%',
        textAlign: 'left',
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: '14px 16px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        color: INK,
        fontFamily: 'inherit',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 15 }}>{tt.name}</strong>
          {!isActive && <Pill color="#9c9ca3" bg="rgba(255,255,255,0.04)" label="Off sale" />}
          {isActive && <Pill color="#6fbf7f" bg="rgba(111,191,127,0.12)" label="On sale" />}
        </div>
        <div style={{ fontSize: 12, color: INK_DIM, marginTop: 4, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <span>${(tt.price_cents / 100).toFixed(2)}</span>
          {tt.capacity != null && <span>{tt.capacity} seats</span>}
          {stopName && <span>Stop {tt.stop_index + 1} · {stopName}</span>}
        </div>
      </div>
      <span style={{ color: ACCENT, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
        Edit →
      </span>
    </button>
  )
}

function Pill({ color, bg, label }) {
  return (
    <span style={{
      fontSize: 10,
      letterSpacing: '0.18em',
      textTransform: 'uppercase',
      fontWeight: 700,
      padding: '3px 8px',
      borderRadius: 999,
      background: bg,
      border: `1px solid ${color}40`,
      color,
    }}>
      {label}
    </span>
  )
}

function TicketModal({ eventId, ticket, stops, existingCount, onClose }) {
  const isNew = !ticket
  const [draft, setDraft] = useState(() => ({
    id: ticket?.id || null,
    name: ticket?.name || `Stop ${existingCount + 1}`,
    price_dollars: ticket ? (ticket.price_cents / 100).toFixed(2) : '25.00',
    capacity: ticket?.capacity ?? '',
    stop_index: ticket?.stop_index ?? '',
    active: ticket?.active !== false,
    sort_order: ticket?.sort_order ?? existingCount,
  }))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState(null)

  function patch(p) { setDraft(prev => ({ ...prev, ...p })) }

  async function onSave() {
    if (!draft.name || !draft.price_dollars) {
      setError('Name and price are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const ttRow = {
        ...(draft.id ? { id: draft.id } : {}),
        name: draft.name,
        price_cents: Math.round(parseFloat(draft.price_dollars || '0') * 100),
        stop_index: draft.stop_index === '' || draft.stop_index == null ? null : Number(draft.stop_index),
        capacity: draft.capacity ? Number(draft.capacity) : null,
        active: draft.active,
        sort_order: draft.sort_order,
      }
      const res = await fetch(`/api/events?event_id=${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_types: [ttRow] }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) {
        setError(json.error || `Failed (${res.status})`)
        return
      }
      onClose(true)
    } catch (err) {
      setError(err.message || 'Network error')
    } finally {
      setSaving(false)
    }
  }

  async function onRetire() {
    if (!ticket?.id) return
    if (!confirm(`Retire "${ticket.name}"? It stays in the database but disappears from the booking page.`)) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/events?event_id=${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket_types: [{ id: ticket.id, active: false }],
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json.error || `Failed (${res.status})`)
        return
      }
      onClose(true)
    } catch (err) {
      setError(err.message || 'Network error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => onClose(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: 16,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: SURFACE,
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
          padding: 22,
          width: '100%',
          maxWidth: 480,
          maxHeight: 'calc(100vh - 32px)',
          overflowY: 'auto',
          display: 'grid',
          gap: 14,
          boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <h2 style={{ fontSize: 18, color: INK, margin: 0, fontWeight: 700 }}>
            {isNew ? 'New ticket type' : 'Edit ticket type'}
          </h2>
          <button
            type="button"
            onClick={() => onClose(false)}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 0,
              color: INK_DIM,
              fontSize: 22,
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <Field label="Ticket name *">
          <input
            type="text"
            value={draft.name}
            onChange={e => patch({ name: e.target.value })}
            style={inputStyle}
            autoFocus
          />
        </Field>

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Price ($) *">
            <input
              type="number"
              step="0.01"
              min="0"
              value={draft.price_dollars}
              onChange={e => patch({ price_dollars: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="Capacity">
            <input
              type="number"
              min="0"
              value={draft.capacity}
              onChange={e => patch({ capacity: e.target.value })}
              placeholder="Unlimited"
              style={inputStyle}
            />
          </Field>
        </div>

        {stops.length > 0 && (
          <Field label="Stop">
            <select
              value={draft.stop_index === '' ? '' : String(draft.stop_index)}
              onChange={e => patch({ stop_index: e.target.value === '' ? '' : Number(e.target.value) })}
              style={inputStyle}
            >
              <option value="">— Not tied to a stop —</option>
              {stops.map((s, i) => (
                <option key={i} value={i}>
                  Stop {i + 1} · {s.name || `Stop ${i + 1}`}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Status">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <ToggleButton
              active={draft.active}
              onClick={() => patch({ active: true })}
              label="On sale"
              activeColor="#6fbf7f"
            />
            <ToggleButton
              active={!draft.active}
              onClick={() => patch({ active: false })}
              label="Off sale"
              activeColor="#9c9ca3"
            />
          </div>
        </Field>

        {error && (
          <div style={{
            padding: 10,
            background: 'rgba(255,80,80,0.08)',
            border: '1px solid rgba(255,80,80,0.32)',
            borderRadius: 8,
            color: '#ff8b8b',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !draft.name}
            style={{
              ...primaryBtn,
              flex: 1,
              opacity: saving || !draft.name ? 0.55 : 1,
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : isNew ? 'Create ticket type' : 'Save changes'}
          </button>
          {!isNew && (
            <button
              type="button"
              onClick={onRetire}
              disabled={deleting}
              style={{
                background: 'transparent',
                color: '#e07a7a',
                border: `1px solid ${BORDER}`,
                padding: '12px 16px',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 13,
                cursor: deleting ? 'wait' : 'pointer',
              }}
            >
              {deleting ? 'Retiring…' : 'Retire'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{
        fontSize: 11,
        color: INK_DIM,
        letterSpacing: '0.06em',
        fontWeight: 600,
      }}>
        {label}
      </span>
      {children}
    </label>
  )
}

function ToggleButton({ active, onClick, label, activeColor }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '10px 14px',
        borderRadius: 10,
        background: active ? `${activeColor}1a` : 'transparent',
        border: `1px solid ${active ? activeColor : BORDER}`,
        color: active ? activeColor : INK_DIM,
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}

const inputStyle = {
  width: '100%',
  background: '#0a0a0b',
  border: `1px solid ${BORDER}`,
  color: INK,
  padding: '12px 14px',
  borderRadius: 10,
  fontSize: 15,
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const primaryBtn = {
  background: `linear-gradient(180deg, ${ACCENT_HI}, ${ACCENT})`,
  color: '#0a0a0b',
  border: 0,
  padding: '12px 22px',
  borderRadius: 10,
  fontWeight: 800,
  fontSize: 14,
  letterSpacing: '0.04em',
  cursor: 'pointer',
}
