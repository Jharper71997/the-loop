'use client'

import { useEffect, useState } from 'react'
import { C } from '../../../_theme'

// Flexible Surf City route builder. A weekend can hold MANY loops (Fri night;
// Sat day + transition + night; Sun day), each its own group with its own
// ordered stop set and per-stop pricing. Stops are first-class: pick a bar (or
// type a name), set time, price, optional capacity + coords. Loads/saves via
// /api/surf-admin/loops. This is the capability Brew's rigid "clone last
// weekend" builder lacks.

const LINE = C.LINE
const GOLD = C.GOLD

function blankStop() {
  return { name: '', bar_slug: '', lat: null, lng: null, start_time: '', price_dollars: '', capacity: '' }
}
function blankLoop() {
  return {
    groupId: null, eventId: null, name: '', event_date: '', pickup_time: '',
    status: 'draft', stops: [blankStop()], _dirty: true,
  }
}

const centsToDollars = c => (Number.isFinite(Number(c)) ? (Number(c) / 100).toString() : '')
const dollarsToCents = d => {
  const n = Number(d)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export default function BuilderClient({ bars = [] }) {
  const [loops, setLoops] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savingIdx, setSavingIdx] = useState(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/surf-admin/loops')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Failed (${res.status})`)
      const fromApi = (data.loops || []).map(l => ({
        groupId: l.groupId, eventId: l.eventId, name: l.name || '',
        event_date: l.event_date || '', pickup_time: l.pickup_time || '',
        status: l.status || 'draft',
        stops: (l.stops || []).map(s => ({
          name: s.name || '', bar_slug: '', lat: s.lat, lng: s.lng,
          start_time: s.start_time || '', price_dollars: centsToDollars(s.price_cents),
          capacity: s.capacity == null ? '' : String(s.capacity),
        })),
        _dirty: false,
      }))
      setLoops(fromApi)
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function patchLoop(i, patch) {
    setLoops(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch, _dirty: true } : l))
  }
  function patchStop(i, j, patch) {
    setLoops(ls => ls.map((l, idx) => {
      if (idx !== i) return l
      const stops = l.stops.map((s, sj) => sj === j ? { ...s, ...patch } : s)
      return { ...l, stops, _dirty: true }
    }))
  }
  function addStop(i) { setLoops(ls => ls.map((l, idx) => idx === i ? { ...l, stops: [...l.stops, blankStop()], _dirty: true } : l)) }
  function removeStop(i, j) { setLoops(ls => ls.map((l, idx) => idx === i ? { ...l, stops: l.stops.filter((_, sj) => sj !== j), _dirty: true } : l)) }
  function moveStop(i, j, dir) {
    setLoops(ls => ls.map((l, idx) => {
      if (idx !== i) return l
      const k = j + dir
      if (k < 0 || k >= l.stops.length) return l
      const stops = [...l.stops]
      ;[stops[j], stops[k]] = [stops[k], stops[j]]
      return { ...l, stops, _dirty: true }
    }))
  }
  function addLoop() { setLoops(ls => [blankLoop(), ...ls]) }

  function onPickBar(i, j, slug) {
    const bar = bars.find(b => b.slug === slug)
    if (!bar) { patchStop(i, j, { bar_slug: '', name: '' }); return }
    patchStop(i, j, { bar_slug: bar.slug, name: bar.name, lat: bar.lat, lng: bar.lng })
  }

  function toPayload(l) {
    return {
      name: l.name, event_date: l.event_date, pickup_time: l.pickup_time || null,
      status: l.status,
      stops: l.stops
        .filter(s => s.name.trim())
        .map(s => ({
          name: s.name.trim(), bar_slug: s.bar_slug || null,
          lat: s.lat == null || s.lat === '' ? null : Number(s.lat),
          lng: s.lng == null || s.lng === '' ? null : Number(s.lng),
          start_time: s.start_time || null,
          price_cents: dollarsToCents(s.price_dollars),
          capacity: s.capacity === '' ? null : Math.round(Number(s.capacity)),
        })),
    }
  }

  async function save(i) {
    const l = loops[i]
    if (!l.name.trim() || !l.event_date) { setError('Loop needs a name and a date.'); return }
    setSavingIdx(i); setError(null)
    try {
      const payload = toPayload(l)
      let res
      if (l.groupId) {
        res = await fetch(`/api/surf-admin/loops?group_id=${encodeURIComponent(l.groupId)}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loop: payload }),
        })
      } else {
        res = await fetch('/api/surf-admin/loops', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ loops: [payload] }),
        })
      }
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Save failed (${res.status})`)
      await load()
    } catch (e) { setError(e.message) }
    finally { setSavingIdx(null) }
  }

  async function del(i) {
    const l = loops[i]
    if (!l.groupId) { setLoops(ls => ls.filter((_, idx) => idx !== i)); return }
    if (!confirm(`Delete "${l.name}"? This removes the loop, its event, and its tickets.`)) return
    setSavingIdx(i); setError(null)
    try {
      const res = await fetch(`/api/surf-admin/loops?group_id=${encodeURIComponent(l.groupId)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Delete failed (${res.status})`)
      await load()
    } catch (e) { setError(e.message) }
    finally { setSavingIdx(null) }
  }

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: '24px 16px 80px', display: 'grid', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>Surf City · Route builder</div>
          <h1 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 800, color: C.INK }}>Build the weekend</h1>
        </div>
        <button onClick={addLoop} style={btn(true)}>+ New loop</button>
      </div>

      {error && <div style={{ color: '#ff8585', fontSize: 14, padding: '10px 12px', border: '1px solid rgba(255,80,80,0.3)', borderRadius: 10 }}>{error}</div>}
      {loading && <div style={{ color: C.INK_DIM }}>Loading…</div>}

      {!loading && loops.length === 0 && (
        <div style={{ color: C.INK_DIM }}>No loops yet. Click <b style={{ color: C.INK }}>+ New loop</b> to add the first one.</div>
      )}

      {loops.map((l, i) => (
        <section key={l.groupId || `new-${i}`} style={{ borderRadius: 14, background: C.SURFACE, border: `1px solid ${LINE}`, padding: 16, display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
            <Field label="Loop name"><input value={l.name} onChange={e => patchLoop(i, { name: e.target.value })} placeholder="Sat Night Loop" style={inp} /></Field>
            <Field label="Date"><input type="date" value={l.event_date} onChange={e => patchLoop(i, { event_date: e.target.value })} style={inp} /></Field>
            <Field label="Start time"><input type="time" value={l.pickup_time} onChange={e => patchLoop(i, { pickup_time: e.target.value })} style={inp} /></Field>
            <Field label="Status">
              <select value={l.status} onChange={e => patchLoop(i, { status: e.target.value })} style={inp}>
                <option value="draft">Draft (staged)</option>
                <option value="on_sale">On sale</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <div style={{ color: C.WARM, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700 }}>Stops</div>
            {l.stops.map((s, j) => (
              <div key={j} style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: 10, background: C.SURFACE_HI, display: 'grid', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
                  <Field label={`Stop ${j + 1} bar`}>
                    <select value={s.bar_slug} onChange={e => onPickBar(i, j, e.target.value)} style={inp}>
                      <option value="">— pick / custom —</option>
                      {bars.map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Name"><input value={s.name} onChange={e => patchStop(i, j, { name: e.target.value })} placeholder="Velvet" style={inp} /></Field>
                  <Field label="Time"><input type="time" value={s.start_time} onChange={e => patchStop(i, j, { start_time: e.target.value })} style={inp} /></Field>
                  <Field label="Price ($)"><input type="number" min="0" step="1" value={s.price_dollars} onChange={e => patchStop(i, j, { price_dollars: e.target.value })} placeholder="15" style={inp} /></Field>
                  <Field label="Cap (opt)"><input type="number" min="0" value={s.capacity} onChange={e => patchStop(i, j, { capacity: e.target.value })} placeholder="—" style={inp} /></Field>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, alignItems: 'end' }}>
                  <Field label="Lat (opt)"><input value={s.lat ?? ''} onChange={e => patchStop(i, j, { lat: e.target.value })} placeholder="34.43" style={inp} /></Field>
                  <Field label="Lng (opt)"><input value={s.lng ?? ''} onChange={e => patchStop(i, j, { lng: e.target.value })} placeholder="-77.54" style={inp} /></Field>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => moveStop(i, j, -1)} style={btn(false)} aria-label="Move up">↑</button>
                    <button onClick={() => moveStop(i, j, 1)} style={btn(false)} aria-label="Move down">↓</button>
                    <button onClick={() => removeStop(i, j)} style={btn(false)} aria-label="Remove stop">✕</button>
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => addStop(i)} style={{ ...btn(false), justifySelf: 'start' }}>+ Add stop</button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
            <button onClick={() => del(i)} style={{ ...btn(false), color: '#ff8585', borderColor: 'rgba(255,80,80,0.3)' }}>Delete loop</button>
            <button onClick={() => save(i)} disabled={savingIdx === i} style={{ ...btn(true), opacity: savingIdx === i ? 0.6 : 1 }}>
              {savingIdx === i ? 'Saving…' : (l.groupId ? 'Save changes' : 'Create loop')}
            </button>
          </div>
        </section>
      ))}
    </main>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 4 }}>
      <span style={{ fontSize: 10.5, color: C.INK_DIM, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  )
}

const inp = {
  width: '100%', padding: '9px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)',
  border: `1px solid ${C.LINE}`, color: C.INK, fontSize: 14, outline: 'none',
}
function btn(primary) {
  return {
    padding: '9px 14px', borderRadius: 9, cursor: 'pointer', fontWeight: 700, fontSize: 13,
    border: primary ? 'none' : `1px solid ${C.LINE}`,
    background: primary ? `linear-gradient(180deg, ${C.GOLD_HI}, ${C.GOLD})` : 'transparent',
    color: primary ? '#0a0a0b' : C.INK,
  }
}
