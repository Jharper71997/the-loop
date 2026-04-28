'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const ACCENT = '#d4a333'
const ACCENT_HI = '#f0c24a'
const SURFACE = '#15151a'
const BORDER = '#2a2a31'
const INK = '#f5f5f7'
const INK_DIM = '#9c9ca3'

export default function EditView({ group, event }) {
  const router = useRouter()
  const [draft, setDraft] = useState(() => ({
    name: event?.name || group?.name || '',
    event_date: event?.event_date || group?.event_date || '',
    pickup_time: event?.pickup_time || group?.pickup_time || '',
    description: event?.description || '',
    cover_image_url: event?.cover_image_url || '',
    capacity: event?.capacity ?? '',
    status: event?.status || 'on_sale',
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [savedAt, setSavedAt] = useState(null)

  function patch(p) { setDraft(prev => ({ ...prev, ...p })) }

  async function onSave() {
    if (!draft.name || !draft.event_date) {
      setError('Name and date are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      let res
      if (event?.id) {
        res = await fetch(`/api/events?event_id=${event.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: {
              name: draft.name,
              event_date: draft.event_date,
              pickup_time: draft.pickup_time || null,
              description: draft.description || null,
              cover_image_url: draft.cover_image_url || null,
              capacity: draft.capacity ? Number(draft.capacity) : null,
              status: draft.status,
            },
          }),
        })
      } else {
        res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: {
              name: draft.name,
              event_date: draft.event_date,
              pickup_time: draft.pickup_time || null,
              description: draft.description || null,
              cover_image_url: draft.cover_image_url || null,
              capacity: draft.capacity ? Number(draft.capacity) : null,
              status: draft.status,
              create_group: false,
            },
            ticket_types: [],
          }),
        })
      }
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) {
        setError(json.error || `Failed (${res.status})`)
        return
      }
      setSavedAt(Date.now())
      // Refresh server data so the sidebar status pill + summary stats update.
      router.refresh()
    } catch (err) {
      setError(err.message || 'Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 800 }}>
      <Header title="Edit event and tickets" />

      <Section title="Event info">
        <Field label="Event name *">
          <input
            type="text"
            value={draft.name}
            onChange={e => patch({ name: e.target.value })}
            placeholder="Brew Loop — Friday Night"
            style={inputStyle}
          />
        </Field>
      </Section>

      <Section title="Dates">
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <Field label="Date *">
            <PickerButton
              type="date"
              value={draft.event_date}
              onChange={v => patch({ event_date: v })}
              format={formatDate}
              placeholder="Pick a date"
            />
          </Field>
          <Field label="Pickup time">
            <PickerButton
              type="time"
              value={draft.pickup_time}
              onChange={v => patch({ pickup_time: v })}
              format={formatTime}
              placeholder="Pick a time"
            />
          </Field>
        </div>
      </Section>

      <Section title="Event page">
        <Field label="Description">
          <textarea
            rows={5}
            value={draft.description}
            onChange={e => patch({ description: e.target.value })}
            placeholder="What riders will see on /book/[id]. Tone matters — keep it short."
            style={{ ...inputStyle, resize: 'vertical', minHeight: 100 }}
          />
        </Field>
        <Field label="Cover image URL (optional)">
          <input
            type="url"
            value={draft.cover_image_url}
            onChange={e => patch({ cover_image_url: e.target.value })}
            placeholder="https://images.squarespace-cdn.com/content/..."
            style={inputStyle}
          />
          <span style={{ fontSize: 11, color: INK_DIM }}>
            Used as the hero image on /events and /book/[id]. Leave blank for the default placeholder.
          </span>
          {draft.cover_image_url && (
            <img
              src={draft.cover_image_url}
              alt="Cover preview"
              style={{ marginTop: 6, width: '100%', maxWidth: 320, aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8, border: `1px solid ${BORDER}` }}
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
          )}
        </Field>
      </Section>

      <Section title="Settings">
        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <Field label="Capacity (optional)">
            <input
              type="number"
              value={draft.capacity}
              onChange={e => patch({ capacity: e.target.value })}
              placeholder="e.g. 30"
              style={inputStyle}
            />
          </Field>
          <Field label="Status">
            <select
              value={draft.status}
              onChange={e => patch({ status: e.target.value })}
              style={inputStyle}
            >
              <option value="on_sale">On sale</option>
              <option value="draft">Draft</option>
              <option value="sold_out">Sold out</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
        </div>
      </Section>

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || !draft.name || !draft.event_date}
          style={{
            ...primaryBtn,
            opacity: saving || !draft.name || !draft.event_date ? 0.55 : 1,
            cursor: saving ? 'wait' : 'pointer',
          }}
        >
          {saving ? 'Saving…' : event?.id ? 'Save changes' : 'Create event'}
        </button>
        {savedAt && !saving && (
          <span style={{ color: '#6fbf7f', fontSize: 12, fontWeight: 600 }}>
            ✓ Saved
          </span>
        )}
      </div>
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

function Section({ title, children }) {
  return (
    <section style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: 18,
      display: 'grid',
      gap: 14,
    }}>
      <h2 style={{
        fontSize: 11,
        color: ACCENT,
        margin: 0,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        fontWeight: 700,
      }}>
        {title}
      </h2>
      {children}
    </section>
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

function PickerButton({ type, value, onChange, placeholder, format }) {
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
    <>
      <button
        type="button"
        onClick={open}
        style={{
          ...inputStyle,
          textAlign: 'left',
          cursor: 'pointer',
          color: empty ? '#6f6f76' : INK,
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
    </>
  )
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch { return iso }
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr); const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
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
