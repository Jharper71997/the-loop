'use client'

import { useEffect, useMemo, useState } from 'react'

// Names kept (OLIVE/SAND) to minimize churn; values are the red theme now.
const INK = '#eef1f3'
const INK_DIM = '#9aa3ab'
const FAINT = '#7c8088'
const OLIVE = '#e5484d'
const OLIVE_HI = '#f2585d'
const SAND = '#c9ccd1'
const SURFACE = '#1a2027'
const LINE = 'rgba(255,255,255,0.10)'
const STATUS_COLOR = { pending: SAND, approved: '#7fc88a', rejected: '#ff8585' }

export default function LoopAdminClient() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actingId, setActingId] = useState(null)
  const [tab, setTab] = useState('requests')
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/loop-admin/verifications')
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || `Failed (${res.status})`); return }
      setRows(json.verifications || [])
    } catch (err) { setError(err.message || 'Network error') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function patch(id, payload) {
    if (actingId) return
    setActingId(id)
    try {
      const res = await fetch(`/api/loop-admin/verifications/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { alert(json.error || `Failed (${res.status})`); return }
      setRows(rs => rs.map(r => r.id === id ? { ...r, ...applied(payload), reviewed_at: payload.action ? new Date().toISOString() : r.reviewed_at } : r))
    } catch (err) { alert(err.message || 'Network error') }
    finally { setActingId(null) }
  }
  function applied(p) {
    const o = {}
    if (p.action) o.status = p.action === 'approve' ? 'approved' : 'rejected'
    if (Object.prototype.hasOwnProperty.call(p, 'admin_note')) o.admin_note = p.admin_note
    if (Object.prototype.hasOwnProperty.call(p, 'flagged')) o.flagged = p.flagged
    return o
  }
  function editNote(r) {
    const next = window.prompt('Internal note for this rider:', r.admin_note || '')
    if (next === null) return
    patch(r.id, { admin_note: next.trim() })
  }

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000
    const byBranch = {}
    let verified = 0, pending = 0, recent = 0
    for (const r of rows) {
      if (r.status === 'approved') { verified++; byBranch[r.branch || 'Other'] = (byBranch[r.branch || 'Other'] || 0) + 1 }
      if (r.status === 'pending') pending++
      if (r.created_at && new Date(r.created_at).getTime() >= weekAgo) recent++
    }
    const topBranch = Object.entries(byBranch).sort((a, b) => b[1] - a[1])[0]
    return { verified, pending, recent, byBranch, topBranch }
  }, [rows])

  const pending = rows.filter(r => r.status === 'pending')
  const riders = useMemo(() => {
    const q = search.trim().toLowerCase()
    const approved = rows.filter(r => r.status === 'approved')
    if (!q) return approved
    return approved.filter(r => `${r.full_name} ${r.email} ${r.phone} ${r.branch} ${r.unit} ${r.rank}`.toLowerCase().includes(q))
  }, [rows, search])

  return (
    <main style={{ padding: '18px 16px 44px', maxWidth: 820, margin: '0 auto', color: INK }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Operations</h1>
        <button onClick={load} style={ghost}>Refresh</button>
      </div>

      {/* Overview stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '16px 0 6px' }}>
        <Stat label="Verified riders" value={stats.verified} />
        <Stat label="Pending" value={stats.pending} accent={stats.pending > 0} />
        <Stat label="New this week" value={stats.recent} />
        <Stat label="Top branch" value={stats.topBranch ? stats.topBranch[1] : 0} sub={stats.topBranch ? stats.topBranch[0] : '—'} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, margin: '14px 0', flexWrap: 'wrap' }}>
        {[['requests', `Requests${stats.pending ? ` (${stats.pending})` : ''}`], ['dispatch', 'Dispatch'], ['scoreboard', 'Scoreboard'], ['riders', 'Riders'], ['passes', 'Passes & Revenue'], ['service', 'Service']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...chip, ...(tab === k ? chipActive : {}) }}>{label}</button>
        ))}
      </div>

      {loading && <div style={{ color: INK_DIM }}>Loading…</div>}
      {error && <div style={{ color: '#ff8585' }}>{error}</div>}

      {!loading && tab === 'requests' && (
        <Section>
          {!pending.length && <Empty>No pending requests. You&apos;re all caught up.</Empty>}
          {pending.map(r => <RiderCard key={r.id} r={r} acting={actingId === r.id}
            onApprove={() => patch(r.id, { action: 'approve' })}
            onReject={() => patch(r.id, { action: 'reject' })}
            onFlag={() => patch(r.id, { flagged: !r.flagged })}
            onNote={() => editNote(r)} mode="request" />)}
        </Section>
      )}

      {!loading && tab === 'riders' && (
        <Section>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search riders by name, unit, contact…"
            style={{ width: '100%', padding: '11px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: `1px solid ${LINE}`, color: INK, fontSize: 14, outline: 'none', marginBottom: 4 }} />
          {!riders.length && <Empty>No verified riders yet.</Empty>}
          {riders.map(r => <RiderCard key={r.id} r={r} acting={actingId === r.id}
            onFlag={() => patch(r.id, { flagged: !r.flagged })} onNote={() => editNote(r)} mode="rider" />)}
        </Section>
      )}

      {!loading && tab === 'dispatch' && <DispatchTab />}

      {!loading && tab === 'scoreboard' && <ScoreboardTab />}

      {!loading && tab === 'passes' && <RevenueTab />}

      {!loading && tab === 'service' && <ServiceTab />}
    </main>
  )
}

function DispatchTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load(initial) {
      if (initial) { setLoading(true) }
      try {
        const res = await fetch('/api/loop-admin/manifest', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) { setError(json.error || `Failed (${res.status})`); return }
        setError(null); setData(json)
      } catch (err) { if (!cancelled) setError(err.message || 'Network error') }
      finally { if (!cancelled && initial) setLoading(false) }
    }
    load(true)
    // Auto-refresh every ~10s, but pause while the tab is backgrounded.
    const id = setInterval(() => { if (!document.hidden) load(false) }, 10000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  if (loading) return <Section><div style={{ color: INK_DIM }}>Loading…</div></Section>
  if (error) return <Section><div style={{ color: '#ff8585' }}>{error}</div></Section>
  if (!data?.group) {
    return <Section><Empty>No active loop. Build this weekend&apos;s route with the weekend script — riders waiting and on board show up here once the loop is live.</Empty></Section>
  }

  const stops = data.stops || []
  const t = data.totals || { waiting: 0, onBoard: 0, stops: 0 }

  return (
    <Section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <Stat label="Waiting" value={t.waiting} accent={t.waiting > 0} />
        <Stat label="On board" value={t.onBoard} />
        <Stat label="Stops" value={t.stops} />
      </div>
      {!stops.some(s => s.waiting.length || s.onBoard.length) && (
        <Empty>No riders booked on this loop yet.</Empty>
      )}
      {stops.map((s) => (
        <div key={s.index ?? 'unassigned'} style={{ ...card, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
              {s.index != null && <span style={{ color: OLIVE_HI, fontWeight: 800, fontSize: 13 }}>{s.index + 1}</span>}
              <span style={{ fontSize: 15, fontWeight: 700 }}>{s.name}</span>
              {s.onBase && <span style={{ color: SAND, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>· on base</span>}
            </div>
            {s.startTime && <span style={{ color: FAINT, fontSize: 12 }}>{s.startTime}</span>}
          </div>
          <div style={{ marginTop: 10, color: INK_DIM, fontSize: 13.5, lineHeight: 1.55 }}>
            <div>
              <span style={{ color: OLIVE_HI, fontWeight: 700 }}>Waiting here ({s.waiting.length}):</span>{' '}
              {s.waiting.length
                ? s.waiting.map((r, i) => <span key={i}>{i ? ', ' : ''}<span style={{ color: INK }}>{r.name}</span></span>)
                : <span style={{ color: FAINT }}>—</span>}
            </div>
            <div style={{ marginTop: 6 }}>
              <span style={{ color: '#7fc88a', fontWeight: 700 }}>On board ({s.onBoard.length}):</span>{' '}
              {s.onBoard.length
                ? s.onBoard.map((r, i) => (
                    <span key={i}>{i ? ', ' : ''}<span style={{ color: INK }}>{r.name}</span> <span style={{ color: FAINT, fontSize: 12 }}>({r.pass})</span></span>
                  ))
                : <span style={{ color: FAINT }}>—</span>}
            </div>
          </div>
        </div>
      ))}
      <div style={{ color: FAINT, fontSize: 12 }}>Auto-refreshes every 10s.</div>
    </Section>
  )
}

function ScoreboardTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load(initial) {
      if (initial) setLoading(true)
      try {
        const res = await fetch('/api/loop-admin/scoreboard', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) { setError(json.error || `Failed (${res.status})`); return }
        setError(null); setData(json)
      } catch (err) { if (!cancelled) setError(err.message || 'Network error') }
      finally { if (!cancelled && initial) setLoading(false) }
    }
    load(true)
    const id = setInterval(() => { if (!document.hidden) load(false) }, 15000)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  if (loading) return <Section><div style={{ color: INK_DIM }}>Loading…</div></Section>
  if (error) return <Section><div style={{ color: '#ff8585' }}>{error}</div></Section>

  const live = data?.live
  const weekend = data?.weekend || { riders: 0, revenueCents: 0, single: 0, day: 0 }
  const cumulative = data?.cumulative || { riders: 0, revenueCents: 0, single: 0, day: 0 }

  if (!live) {
    return (
      <Section>
        <Empty>No active loop running. Cumulative totals below.</Empty>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          <Stat label="Riders all-time" value={cumulative.riders} />
          <Stat label="Single rides" value={cumulative.single} />
          <Stat label="Day passes" value={cumulative.day} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          <Stat label="Revenue all-time" value={formatCents(cumulative.revenueCents)} />
        </div>
      </Section>
    )
  }

  const stopLabel = live.stopCount
    ? `Stop ${live.currentStopIndex != null ? live.currentStopIndex + 1 : '–'}/${live.stopCount}`
    : '—'

  return (
    <Section>
      {/* Live strip */}
      <div style={{ ...card, padding: '16px 18px', borderColor: 'rgba(229,72,77,0.4)', background: 'rgba(229,72,77,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <div style={sectionLabel}>Live · {live.name}</div>
          <span style={{ color: FAINT, fontSize: 12 }}>{live.eventDate || ''}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 14 }}>
          <LiveCell value={live.onBoardNow} label="On board now" accent />
          <LiveCell value={formatCents(live.revenueCents)} label="Collected" />
          <LiveCell value={live.currentStopName || live.nextStopName || '—'} label={live.currentStopName ? 'At stop' : 'Next stop'} small />
          <LiveCell value={stopLabel} label="Progress" />
        </div>
      </div>

      {/* Weekend + cumulative stat grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <Stat label="Riders this weekend" value={weekend.riders} accent={weekend.riders > 0} />
        <Stat label="Riders cumulative" value={cumulative.riders} />
        <Stat label="Revenue this weekend" value={formatCents(weekend.revenueCents)} />
      </div>

      {/* Single vs Day breakdown */}
      <div style={{ ...card, padding: '14px 16px' }}>
        <div style={sectionLabel}>Single vs Day Pass</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px 16px', marginTop: 12, fontSize: 13.5, alignItems: 'baseline' }}>
          <span style={{ color: FAINT, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }} />
          <span style={{ color: FAINT, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'right' }}>Weekend</span>
          <span style={{ color: FAINT, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', textAlign: 'right' }}>All-time</span>

          <span style={{ color: INK_DIM }}>Single Ride</span>
          <span style={{ color: INK, fontWeight: 700, textAlign: 'right' }}>{weekend.single}</span>
          <span style={{ color: INK, fontWeight: 700, textAlign: 'right' }}>{cumulative.single}</span>

          <span style={{ color: INK_DIM }}>Day Pass</span>
          <span style={{ color: INK, fontWeight: 700, textAlign: 'right' }}>{weekend.day}</span>
          <span style={{ color: INK, fontWeight: 700, textAlign: 'right' }}>{cumulative.day}</span>
        </div>
      </div>
      <div style={{ color: FAINT, fontSize: 12 }}>Revenue counts what was actually collected, so comps don&apos;t inflate it. Auto-refreshes every 15s.</div>
    </Section>
  )
}

function LiveCell({ value, label, accent, small }) {
  return (
    <div>
      <div style={{ fontSize: small ? 16 : 26, fontWeight: 800, color: accent ? OLIVE_HI : INK, lineHeight: 1.1, wordBreak: 'break-word' }}>{value}</div>
      <div style={{ color: INK_DIM, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600, marginTop: 6 }}>{label}</div>
    </div>
  )
}

function RevenueTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const res = await fetch('/api/loop-admin/revenue', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) { setError(json.error || `Failed (${res.status})`); return }
        setData(json)
      } catch (err) { if (!cancelled) setError(err.message || 'Network error') }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <Section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <Stat label="Rides sold" value={loading ? '…' : (data?.rides ?? 0)} />
        <Stat label="Day passes" value={loading ? '…' : (data?.day ?? 0)} />
        <Stat label="Revenue" value={loading ? '…' : formatCents(data?.revenue_cents)} />
      </div>
      {error && <div style={{ color: '#ff8585', fontSize: 13 }}>{error}</div>}
      {!loading && !error && (
        (data?.rides ?? 0) === 0
          ? <Empty>No rides sold yet. Single rides and day passes show up here as Marines buy — tagged separately from Brew Loop.</Empty>
          : (
            <div style={{ ...card, padding: '14px 16px', color: INK_DIM, fontSize: 13.5, lineHeight: 1.6 }}>
              <div>Single rides: <strong style={{ color: INK }}>{data.single}</strong></div>
              <div>Day passes: <strong style={{ color: INK }}>{data.day}</strong></div>
              {data.other > 0 && <div>Other: <strong style={{ color: INK }}>{data.other}</strong></div>}
              {data.comps > 0 && <div>Comped: <strong style={{ color: INK }}>{data.comps}</strong></div>}
              <div style={{ marginTop: 6, color: FAINT, fontSize: 12 }}>{data.orders} order{data.orders === 1 ? '' : 's'} · The Loop only</div>
            </div>
          )
      )}
    </Section>
  )
}

function ServiceTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true); setError(null)
      try {
        const res = await fetch('/api/loop-admin/service', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) { setError(json.error || `Failed (${res.status})`); return }
        setData(json)
      } catch (err) { if (!cancelled) setError(err.message || 'Network error') }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
  }, [])

  function updateStop(i, patch) {
    setData(d => ({ ...d, schedule: d.schedule.map((s, idx) => idx === i ? { ...s, ...patch } : s) }))
    setSaved(false)
  }
  function addStop() {
    setData(d => ({ ...d, schedule: [...(d.schedule || []), { name: '', start_time: '', lat: null, lng: null, on_base: false }] }))
    setSaved(false)
  }
  function removeStop(i) {
    setData(d => ({ ...d, schedule: d.schedule.filter((_, idx) => idx !== i) }))
    setSaved(false)
  }
  function updateFare(id, dollars) {
    setData(d => ({ ...d, fares: d.fares.map(f => f.id === id ? { ...f, price_cents: Math.round(Number(dollars || 0) * 100) } : f) }))
    setSaved(false)
  }

  async function save() {
    if (!data?.group?.id) return
    setSaving(true); setError(null); setSaved(false)
    try {
      const res = await fetch('/api/loop-admin/service', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ group_id: data.group.id, event_id: data.event_id, schedule: data.schedule, fares: data.fares }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || `Save failed (${res.status})`); return }
      setSaved(true)
    } catch (err) { setError(err.message || 'Network error') }
    finally { setSaving(false) }
  }

  if (loading) return <Section><div style={{ color: INK_DIM }}>Loading…</div></Section>
  if (error) return <Section><div style={{ color: '#ff8585' }}>{error}</div></Section>
  if (!data?.group) {
    return <Section><Empty>No active loop. Build this weekend&apos;s route with the weekend script, then edit its stops and fares here.</Empty></Section>
  }

  return (
    <Section>
      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <div style={sectionLabel}>The red line · {data.group.name}</div>
          <span style={{ color: FAINT, fontSize: 12 }}>{data.group.event_date || ''}</span>
        </div>
        <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
          {(data.schedule || []).map((s, i) => (
            <div key={i} style={{ display: 'grid', gap: 8, padding: '12px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${LINE}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: OLIVE_HI, fontWeight: 800, fontSize: 13, width: 20 }}>{i + 1}</span>
                <input value={s.name || ''} onChange={e => updateStop(i, { name: e.target.value })} placeholder="Stop name" style={{ ...input, flex: 1 }} />
                <button type="button" onClick={() => removeStop(i)} style={{ ...mini, color: '#ff8585' }}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <input value={s.start_time || ''} onChange={e => updateStop(i, { start_time: e.target.value })} placeholder="09:30" style={input} />
                <input value={s.lat ?? ''} onChange={e => updateStop(i, { lat: e.target.value })} placeholder="lat" inputMode="decimal" style={input} />
                <input value={s.lng ?? ''} onChange={e => updateStop(i, { lng: e.target.value })} placeholder="lng" inputMode="decimal" style={input} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: INK_DIM, fontSize: 13 }}>
                <input type="checkbox" checked={!!s.on_base} onChange={e => updateStop(i, { on_base: e.target.checked })} />
                On-base gate (first pickup)
              </label>
            </div>
          ))}
          <button type="button" onClick={addStop} style={ghost}>+ Add stop</button>
        </div>
      </div>

      <div style={{ ...card, padding: '16px 18px' }}>
        <div style={sectionLabel}>Fares</div>
        <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
          {(data.fares || []).map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{f.name}</span>
              <span style={{ color: INK_DIM }}>$</span>
              <input value={(f.price_cents ?? 0) / 100} onChange={e => updateFare(f.id, e.target.value)} inputMode="decimal" style={{ ...input, width: 90, textAlign: 'right' }} />
            </div>
          ))}
          {(!data.fares || !data.fares.length) && <div style={{ color: INK_DIM, fontSize: 13 }}>No fares on this loop yet.</div>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button type="button" onClick={save} disabled={saving} style={{ ...approve, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save changes'}</button>
        {saved && <span style={{ color: '#7fc88a', fontSize: 13, fontWeight: 700 }}>Saved ✓</span>}
      </div>
      <div style={{ color: FAINT, fontSize: 12 }}>
        Lat/lng place the stop on the live map and feed the red-line drawing. Leave blank for a stop with no pin.
      </div>
    </Section>
  )
}

function RiderCard({ r, acting, onApprove, onReject, onFlag, onNote, mode }) {
  const meta = [r.rank, r.unit, r.branch].filter(Boolean).join(' · ')
  return (
    <div style={{ ...card, padding: '14px 16px', borderColor: r.flagged ? 'rgba(255,176,90,0.5)' : LINE }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>
            {r.full_name || '(no name)'}{r.flagged && <span style={{ color: '#ffb05a', fontSize: 12, marginLeft: 8 }}>⚑ flagged</span>}
          </div>
          <div style={{ color: INK_DIM, fontSize: 13, marginTop: 2 }}>{meta || 'Rider'}</div>
          <div style={{ color: INK_DIM, fontSize: 13, marginTop: 2 }}>{r.email || r.phone || 'no contact'}</div>
          {r.note && <div style={{ color: INK_DIM, fontSize: 12.5, marginTop: 6, fontStyle: 'italic' }}>“{r.note}”</div>}
          {r.admin_note && <div style={{ color: SAND, fontSize: 12.5, marginTop: 6 }}>Note: {r.admin_note}</div>}
          <div style={{ color: FAINT, fontSize: 11, marginTop: 6 }}>
            Requested {fmt(r.created_at)}{r.reviewed_at ? ` · reviewed ${fmt(r.reviewed_at)}` : ''}
          </div>
        </div>
        <span style={{ color: STATUS_COLOR[r.status] || INK_DIM, fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{r.status}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        {mode === 'request' && <>
          <button onClick={onApprove} disabled={acting} style={approve}>{acting ? '…' : 'Approve'}</button>
          <button onClick={onReject} disabled={acting} style={reject}>Reject</button>
        </>}
        <button onClick={onNote} disabled={acting} style={reject}>Note</button>
        <button onClick={onFlag} disabled={acting} style={reject}>{r.flagged ? 'Unflag' : 'Flag'}</button>
      </div>
    </div>
  )
}

function Stat({ label, value, sub, accent }) {
  return (
    <div style={{ ...card, padding: '14px 14px' }}>
      <div style={{ fontFamily: 'inherit', fontSize: 30, fontWeight: 800, color: accent ? OLIVE_HI : INK, lineHeight: 1 }}>{value}</div>
      <div style={{ color: INK_DIM, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, marginTop: 8 }}>{label}</div>
      {sub && <div style={{ color: SAND, fontSize: 12, marginTop: 3 }}>{sub}</div>}
    </div>
  )
}
function Section({ children }) { return <div style={{ display: 'grid', gap: 10 }}>{children}</div> }
function Empty({ children }) { return <div style={{ ...card, padding: '20px 18px', color: INK_DIM, fontSize: 13.5, textAlign: 'center', lineHeight: 1.5 }}>{children}</div> }

function fmt(iso) {
  if (!iso) return ''
  try { return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) }
  catch { return iso }
}
function formatCents(cents) {
  if (cents == null) return '—'
  const d = cents / 100
  return `$${d.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const card = { borderRadius: 14, background: SURFACE, border: `1px solid ${LINE}` }
const sectionLabel = { fontSize: 11, color: SAND, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }
const chip = { padding: '8px 13px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: `1px solid ${LINE}`, color: INK_DIM, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
const chipActive = { background: 'rgba(229,72,77,0.14)', borderColor: 'rgba(229,72,77,0.5)', color: OLIVE_HI }
const ghost = { padding: '8px 14px', borderRadius: 999, background: 'transparent', border: `1px solid ${LINE}`, color: INK, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const approve = { padding: '9px 18px', borderRadius: 10, background: `linear-gradient(180deg, ${OLIVE_HI}, ${OLIVE})`, color: '#fff', fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer' }
const reject = { padding: '9px 14px', borderRadius: 10, background: 'transparent', border: `1px solid ${LINE}`, color: INK_DIM, fontWeight: 600, fontSize: 14, cursor: 'pointer' }
const input = { padding: '9px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: `1px solid ${LINE}`, color: INK, fontSize: 14, outline: 'none', boxSizing: 'border-box', width: '100%' }
const mini = { padding: '6px 10px', borderRadius: 8, background: 'transparent', border: `1px solid ${LINE}`, fontSize: 14, fontWeight: 700, cursor: 'pointer' }
