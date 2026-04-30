'use client'

import { useRef, useState } from 'react'

const ACCENT = '#d4a333'
const SURFACE = '#15151a'
const BORDER = '#2a2a31'

const DEFAULT_TICKET_TYPES = [
  { name: 'Stop 1: Angry Ginger', stop_index: 0, price_cents: 2500 },
  { name: "Stop 2: Shirley V's",  stop_index: 1, price_cents: 2500 },
  { name: 'Stop 3: Archies',      stop_index: 2, price_cents: 2500 },
  { name: "Stop 4: Gus's",        stop_index: 3, price_cents: 2500 },
  { name: 'Stop 5: Hideaway',     stop_index: 4, price_cents: 2500 },
]

export default function EventForm({ mode = 'create', initialEvent = null, initialTicketTypes = [], onSavedRedirect }) {
  const [event, setEvent] = useState(initialEvent || {
    name: '',
    event_date: '',
    pickup_time: '20:00',
    description: '',
    capacity: '',
    status: 'on_sale',
  })

  const [ticketTypes, setTicketTypes] = useState(
    initialTicketTypes.length
      ? initialTicketTypes.map(tt => ({ ...tt, _price_dollars: (tt.price_cents / 100).toFixed(2) }))
      : DEFAULT_TICKET_TYPES.map(tt => ({ ...tt, active: true, _price_dollars: (tt.price_cents / 100).toFixed(2) }))
  )

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  function patchEvent(p) { setEvent(prev => ({ ...prev, ...p })) }
  function patchTT(idx, p) { setTicketTypes(prev => prev.map((t, i) => (i === idx ? { ...t, ...p } : t))) }
  function addTT() {
    setTicketTypes(prev => [...prev, {
      name: `Stop ${prev.length + 1}`,
      stop_index: prev.length,
      price_cents: 2500,
      _price_dollars: '25.00',
      active: true,
    }])
  }
  function removeTT(idx) { setTicketTypes(prev => prev.filter((_, i) => i !== idx)) }

  async function onSubmit(e) {
    e.preventDefault()
    if (!event.name || !event.event_date) return
    setSubmitting(true); setError(null)

    const cleanedTTs = ticketTypes.map((t, i) => ({
      ...(t.id ? { id: t.id } : {}),
      name: t.name,
      stop_index: t.stop_index === '' || t.stop_index == null ? null : Number(t.stop_index),
      price_cents: Math.round(parseFloat(t._price_dollars || '0') * 100),
      capacity: t.capacity ? Number(t.capacity) : null,
      active: t.active !== false,
      sort_order: i,
    })).filter(t => t.name && t.price_cents >= 0)

    try {
      let res
      if (mode === 'create') {
        res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: { ...event, capacity: event.capacity ? Number(event.capacity) : null },
            ticket_types: cleanedTTs,
          }),
        })
      } else {
        res = await fetch(`/api/events?event_id=${initialEvent.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: { ...event, capacity: event.capacity ? Number(event.capacity) : null },
            ticket_types: cleanedTTs,
          }),
        })
      }
      const json = await res.json()
      if (!res.ok || json.error) {
        setError(json.error || `Failed (${res.status})`)
        setSubmitting(false)
        return
      }
      const groupId = json.group_id || initialEvent?.group_id
      window.location.href = onSavedRedirect || (groupId ? `/admin/groups/${groupId}` : '/admin/groups')
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
      <Card title="Loop details">
        <Field label="Name" value={event.name} onChange={v => patchEvent({ name: v })} placeholder="Brew Loop — Friday Night" />
        <Row>
          <PickerField
            label="Date"
            type="date"
            value={event.event_date}
            onChange={v => patchEvent({ event_date: v })}
            placeholder="Pick a date"
            format={formatDateLabel}
          />
          <PickerField
            label="Pickup time"
            type="time"
            value={event.pickup_time || ''}
            onChange={v => patchEvent({ pickup_time: v })}
            placeholder="Pick a time"
            format={formatTimeLabel}
          />
        </Row>
        <Field label="Description (optional)" value={event.description || ''} onChange={v => patchEvent({ description: v })} placeholder="Sponsored by ..." />
        <Row>
          <Field label="Capacity (optional)" type="number" value={event.capacity || ''} onChange={v => patchEvent({ capacity: v })} placeholder="e.g. 30" />
          <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#9c9ca3' }}>
            Status
            <select value={event.status} onChange={e => patchEvent({ status: e.target.value })} style={input}>
              <option value="on_sale">On sale</option>
              <option value="draft">Draft</option>
              <option value="sold_out">Sold out</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        </Row>
      </Card>

      <Card title={`Ticket types (${ticketTypes.length})`}>
        <div style={{ display: 'grid', gap: 10 }}>
          {ticketTypes.map((t, idx) => (
            <div key={idx} style={{
              display: 'grid', gap: 8, padding: 10,
              background: '#0e0e12', border: `1px solid ${BORDER}`, borderRadius: 10,
            }}>
              <Row>
                <Field label="Name" value={t.name} onChange={v => patchTT(idx, { name: v })} />
                <Field label="Stop #" type="number" value={t.stop_index ?? ''} onChange={v => patchTT(idx, { stop_index: v })} />
              </Row>
              <Row>
                <Field label="Price ($)" type="number" value={t._price_dollars} onChange={v => patchTT(idx, { _price_dollars: v })} />
                <Field label="Capacity (opt.)" type="number" value={t.capacity || ''} onChange={v => patchTT(idx, { capacity: v })} />
              </Row>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: 13, color: '#bbb', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="checkbox" checked={t.active !== false} onChange={e => patchTT(idx, { active: e.target.checked })} />
                  Active
                </label>
                <button type="button" onClick={() => removeTT(idx)} style={btnGhost}>Remove</button>
              </div>
            </div>
          ))}
        </div>
        <button type="button" onClick={addTT} style={{ ...btnGhost, marginTop: 8, width: '100%' }}>+ Add ticket type</button>
      </Card>

      {error && (
        <div style={{ padding: 10, background: '#3a1a1a', border: '1px solid #f87171', borderRadius: 8, color: '#f87171', fontSize: 13 }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={submitting || !event.name || !event.event_date} style={{
        background: ACCENT, color: '#0a0a0b', border: 0, padding: '12px 20px',
        borderRadius: 10, fontWeight: 700, fontSize: 15,
        opacity: submitting || !event.name || !event.event_date ? 0.5 : 1,
        cursor: submitting ? 'not-allowed' : 'pointer',
      }}>
        {submitting ? 'Saving…' : mode === 'create' ? 'Create Loop' : 'Save changes'}
      </button>
    </form>
  )
}

function Card({ title, children }) {
  return (
    <section style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, display: 'grid', gap: 10 }}>
      <h2 style={{ fontSize: 13, color: ACCENT, margin: 0, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{title}</h2>
      {children}
    </section>
  )
}

function Row({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>{children}</div>
}

function Field({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#9c9ca3' }}>
      {label}
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={input} />
    </label>
  )
}

// Date / time picker rendered as a button that programmatically opens the
// native picker via input.showPicker(). The native <input type="date"> is
// kept in the DOM (offscreen) so the form still has the correctly-typed
// value, but the visible affordance is a styled, obviously-tappable button.
// Fixes the iOS PWA + Android edge cases where tapping a styled native
// date input did nothing.
function PickerField({ label, type, value, onChange, placeholder, format }) {
  const ref = useRef(null)
  const display = value ? format(value) : null
  const empty = !display

  function open() {
    const el = ref.current
    if (!el) return
    if (typeof el.showPicker === 'function') {
      try { el.showPicker(); return } catch {}
    }
    el.focus()
    el.click()
  }

  return (
    <label style={{ display: 'grid', gap: 4, fontSize: 12, color: '#9c9ca3' }}>
      {label}
      <button
        type="button"
        onClick={open}
        style={{
          ...input,
          textAlign: 'left',
          cursor: 'pointer',
          color: empty ? '#6f6f76' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span>{display || placeholder}</span>
        <span aria-hidden style={{ color: ACCENT, fontSize: 14 }}>
          {type === 'time' ? '⏱' : '📅'}
        </span>
      </button>
      {/* Hidden native input — provides the actual picker UI and form value. */}
      <input
        ref={ref}
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
        tabIndex={-1}
        aria-hidden
      />
    </label>
  )
}

function formatDateLabel(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return iso }
}

function formatTimeLabel(hhmm) {
  if (!hhmm) return ''
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr); const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

const input = {
  background: '#0a0a0b',
  border: '1px solid #2a2a31',
  color: '#fff',
  padding: '10px 12px',
  borderRadius: 8,
  fontSize: 14,
  width: '100%',
  boxSizing: 'border-box',
}

const btnGhost = {
  background: 'transparent',
  border: '1px solid #2a2a31',
  color: '#d4a333',
  padding: '8px 12px',
  borderRadius: 8,
  fontSize: 13,
  cursor: 'pointer',
}
