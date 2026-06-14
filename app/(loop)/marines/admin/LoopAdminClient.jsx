'use client'

import { useEffect, useMemo, useState } from 'react'

const INK = '#eef1f3'
const INK_DIM = '#9aa3ab'
const FAINT = '#7c8088'
const OLIVE = '#8a9a4f'
const OLIVE_HI = '#aebb6a'
const SAND = '#c8b88f'
const SURFACE = '#1a2027'
const LINE = 'rgba(255,255,255,0.10)'
const STATUS_COLOR = { pending: SAND, approved: '#7fc88a', rejected: '#ff8585' }

const SCHEDULE = [['Friday', '9:00 – 5:00'], ['Saturday', '9:00 – 5:00'], ['Sunday', '9:00 – 5:00']]

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
        {[['requests', `Requests${stats.pending ? ` (${stats.pending})` : ''}`], ['riders', 'Riders'], ['passes', 'Passes & Revenue'], ['service', 'Service']].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...chip, ...(tab === k ? chipActive : {}) }}>{label}</button>
        ))}
      </div>

      {loading && <div style={{ color: INK_DIM }}>Loading…</div>}
      {error && <div style={{ color: '#ff8585' }}>{error}</div>}

      {!loading && tab === 'requests' && (
        <Section>
          {!pending.length && <Empty>No pending requests. You're all caught up.</Empty>}
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

      {!loading && tab === 'passes' && (
        <Section>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <Stat label="Passes sold" value="—" />
            <Stat label="Active passes" value="—" />
            <Stat label="Revenue" value="—" />
          </div>
          <Empty>Pass sales and revenue light up here once verified riders can buy passes (pending prices + the verification method).</Empty>
        </Section>
      )}

      {!loading && tab === 'service' && (
        <Section>
          <div style={{ ...card, padding: '16px 18px' }}>
            <div style={sectionLabel}>Schedule</div>
            <div style={{ marginTop: 10, display: 'grid', gap: 8 }}>
              {SCHEDULE.map(([d, h]) => (
                <div key={d} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ fontWeight: 600 }}>{d}</span><span style={{ color: SAND }}>{h}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...card, padding: '16px 18px' }}>
            <div style={sectionLabel}>Route</div>
            <p style={{ color: INK_DIM, fontSize: 13.5, lineHeight: 1.5, margin: '8px 0 0' }}>
              Base gate through your sponsor locations and back. The stop list + live map turn on once the
              route is set and the shuttle is broadcasting position.
            </p>
          </div>
        </Section>
      )}
    </main>
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
          <div style={{ color: INK_DIM, fontSize: 13, marginTop: 2 }}>{meta || 'Military'}</div>
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

const card = { borderRadius: 14, background: SURFACE, border: `1px solid ${LINE}` }
const sectionLabel = { fontSize: 11, color: SAND, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 700 }
const chip = { padding: '8px 13px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: `1px solid ${LINE}`, color: INK_DIM, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }
const chipActive = { background: 'rgba(138,154,79,0.14)', borderColor: 'rgba(138,154,79,0.5)', color: OLIVE_HI }
const ghost = { padding: '8px 14px', borderRadius: 999, background: 'transparent', border: `1px solid ${LINE}`, color: INK, fontSize: 13, fontWeight: 600, cursor: 'pointer' }
const approve = { padding: '9px 18px', borderRadius: 10, background: `linear-gradient(180deg, ${OLIVE_HI}, ${OLIVE})`, color: '#13160c', fontWeight: 800, fontSize: 14, border: 'none', cursor: 'pointer' }
const reject = { padding: '9px 14px', borderRadius: 10, background: 'transparent', border: `1px solid ${LINE}`, color: INK_DIM, fontWeight: 600, fontSize: 14, cursor: 'pointer' }
