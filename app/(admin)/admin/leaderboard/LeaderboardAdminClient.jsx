'use client'

import { useEffect, useState } from 'react'

export default function LeaderboardAdminClient({ bars = [] }) {
  const [board, setBoard] = useState(null)
  const [roster, setRoster] = useState(null)
  const [error, setError] = useState(null)
  const [busySlug, setBusySlug] = useState(null)
  const [editingSlug, setEditingSlug] = useState(null)
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/leaderboard').then(r => r.json()),
      fetch('/api/admin/bartenders').then(r => r.json()),
    ]).then(([b, r]) => {
      if (cancelled) return
      setBoard(b)
      setRoster(r.bartenders || [])
    }).catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [])

  async function patch(slug, payload) {
    setBusySlug(slug)
    try {
      const res = await fetch('/api/admin/bartenders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, ...payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `update failed (${res.status})`)
      setRoster(prev => prev.map(b => b.slug === slug ? { ...b, ...data.bartender } : b))
    } catch (e) {
      alert(e.message)
    } finally {
      setBusySlug(null)
    }
  }

  async function deleteBartender(slug, name) {
    if (!confirm(`Delete ${name}? This removes them from the roster permanently. Use Active toggle instead if you want to preserve history.`)) return
    setBusySlug(slug)
    try {
      const res = await fetch(`/api/admin/bartenders?slug=${encodeURIComponent(slug)}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `delete failed (${res.status})`)
      setRoster(prev => prev.filter(b => b.slug !== slug))
    } catch (e) {
      alert(e.message)
    } finally {
      setBusySlug(null)
    }
  }

  async function createBartender({ first_name, bar_slug }) {
    const res = await fetch('/api/admin/bartenders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name, bar_slug }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || `create failed (${res.status})`)
    setRoster(prev => [data.bartender, ...prev])
    setAdding(false)
  }

  if (error) return <main><h1>Leaderboard</h1><p className="muted">{error}</p></main>
  if (!board || !roster) {
    return <main><h1>Leaderboard</h1><div className="scan-bar card">Loading…</div></main>
  }

  const standings = board.standings || []
  const signupUrl = '/bartender-signup'
  const leaderboardUrl = '/leaderboard'

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h1>Leaderboard</h1>
        <span className="tag-status">{board.month} · {board.days_remaining}d left</span>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="hud-heading">Standings · this month</div>
        {standings.length === 0 ? (
          <div className="muted">No bartenders signed up yet. Share the signup link below.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            <HeaderRow cells={['#', 'Name', 'Bar', 'Slug', 'Tickets', 'Status']} />
            {standings.map((row, idx) => (
              <div key={row.slug} className="row" style={rowStyle}>
                <span className="mono" style={{ color: '#d4a333' }}>{idx + 1}</span>
                <span>{row.name}</span>
                <span className="muted">{row.bar}</span>
                <span className="mono tiny" style={{ color: '#9c9ca3' }}>{row.slug}</span>
                <span className="mono" style={{ color: row.qualifies ? '#d4a333' : '#e8e8ea' }}>{row.tickets}</span>
                <span className="tiny mono" style={{ color: row.qualifies ? '#34d399' : '#9c9ca3' }}>
                  {row.qualifies ? 'QUALIFIES' : `${10 - row.tickets} TO GO`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="hud-heading">Share links</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <CopyableLine label="Signup (text this to bartenders)" path={signupUrl} addCode />
          <CopyableLine label="Public leaderboard" path={leaderboardUrl} addToken />
        </div>
        <div className="tiny muted" style={{ marginTop: 10 }}>
          Tokens come from <code>BARTENDER_SIGNUP_CODE</code> and <code>LEADERBOARD_TOKEN</code> env vars.
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div className="hud-heading">Roster · {roster.filter(b => b.active).length} active / {roster.length} total</div>
          <button onClick={() => setAdding(true)} style={btnPrimary}>+ Add bartender</button>
        </div>

        {adding && (
          <AddRow bars={bars} onCancel={() => setAdding(false)} onSave={createBartender} />
        )}

        {roster.length === 0 ? (
          <div className="muted" style={{ marginTop: 10 }}>No signups yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            <HeaderRow cells={['Name', 'Bar', 'Slug', 'Joined', 'QR', 'Active', 'Actions']} cols={7} />
            {roster.map(b => editingSlug === b.slug ? (
              <EditRow
                key={b.slug}
                bartender={b}
                bars={bars}
                onCancel={() => setEditingSlug(null)}
                onSave={async payload => {
                  await patch(b.slug, payload)
                  setEditingSlug(null)
                }}
                busy={busySlug === b.slug}
              />
            ) : (
              <div key={b.slug} className="row" style={{ ...rowStyle, gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                <span style={{ opacity: b.active ? 1 : 0.5 }}>{b.display_name}</span>
                <span className="muted">{b.bar}</span>
                <span className="mono tiny" style={{ color: '#9c9ca3' }}>{b.slug}</span>
                <span className="tiny muted">{formatDate(b.created_at)}</span>
                <span>
                  {b.qr_image_url ? (
                    <a href={b.qr_image_url} target="_blank" rel="noreferrer" style={{ color: '#d4a333', fontSize: 12 }}>
                      view
                    </a>
                  ) : <span className="muted tiny">—</span>}
                </span>
                <button
                  onClick={() => patch(b.slug, { active: !b.active })}
                  disabled={busySlug === b.slug}
                  style={{
                    background: 'transparent',
                    color: b.active ? '#d4a333' : '#6f6f76',
                    border: `1px solid ${b.active ? '#d4a333' : '#3a3a41'}`,
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    cursor: busySlug === b.slug ? 'wait' : 'pointer',
                  }}
                >
                  {b.active ? 'Active' : 'Inactive'}
                </button>
                <span style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditingSlug(b.slug)} style={btnGhost}>Edit</button>
                  <button onClick={() => deleteBartender(b.slug, b.display_name)} disabled={busySlug === b.slug} style={btnDanger}>Delete</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function AddRow({ bars, onCancel, onSave }) {
  const [firstName, setFirstName] = useState('')
  const [barSlug, setBarSlug] = useState(bars[0]?.slug || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function submit() {
    if (!firstName.trim() || !barSlug) return
    setBusy(true)
    setErr(null)
    try {
      await onSave({ first_name: firstName.trim(), bar_slug: barSlug })
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8, padding: '10px 4px', borderBottom: '1px solid rgba(255,255,255,0.05)', marginTop: 6 }}>
      <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.14em' }}>New bartender</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          autoFocus
          placeholder="First name"
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          style={inputStyle}
        />
        <select value={barSlug} onChange={e => setBarSlug(e.target.value)} style={selectStyle}>
          {bars.map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
        </select>
        <button onClick={submit} disabled={busy} style={btnPrimary}>{busy ? 'Saving…' : 'Save'}</button>
        <button onClick={onCancel} disabled={busy} style={btnGhost}>Cancel</button>
      </div>
      {err && <div className="tiny" style={{ color: '#e07a7a' }}>{err}</div>}
    </div>
  )
}

function EditRow({ bartender, bars, onCancel, onSave, busy }) {
  const [name, setName] = useState(bartender.display_name)
  const [barSlug, setBarSlug] = useState(() => {
    const match = bars.find(b => b.name === bartender.bar)
    return match?.slug || bars[0]?.slug || ''
  })

  function submit() {
    const payload = {}
    if (name.trim() && name.trim() !== bartender.display_name) payload.display_name = name.trim()
    const currentSlug = bars.find(b => b.name === bartender.bar)?.slug
    if (barSlug && barSlug !== currentSlug) payload.bar_slug = barSlug
    if (Object.keys(payload).length === 0) {
      onCancel()
      return
    }
    onSave(payload)
  }

  return (
    <div style={{ display: 'grid', gap: 8, padding: '10px 4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.14em' }}>
        Editing {bartender.slug}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
        <select value={barSlug} onChange={e => setBarSlug(e.target.value)} style={selectStyle}>
          {bars.map(b => <option key={b.slug} value={b.slug}>{b.name}</option>)}
        </select>
        <button onClick={submit} disabled={busy} style={btnPrimary}>{busy ? 'Saving…' : 'Save'}</button>
        <button onClick={onCancel} disabled={busy} style={btnGhost}>Cancel</button>
      </div>
      <div className="tiny muted">Slug stays the same — changing it would break ticket attribution.</div>
    </div>
  )
}

function HeaderRow({ cells, cols = 6 }) {
  return (
    <div className="row tiny" style={{
      ...rowStyle,
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      color: '#6f6f76',
      textTransform: 'uppercase',
      letterSpacing: '0.14em',
    }}>
      {cells.map((c, i) => <span key={i}>{c}</span>)}
    </div>
  )
}

function CopyableLine({ label, path, addCode = false, addToken = false }) {
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])

  let display = `${origin}${path}`
  if (addCode) display += '?code=YOUR_SIGNUP_CODE'
  if (addToken) display += '?t=YOUR_LEADERBOARD_TOKEN'

  async function copy() {
    try {
      await navigator.clipboard.writeText(display)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div>
      <div className="tiny" style={{ color: '#9c9ca3', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <code style={{
          flex: '1 1 240px',
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: 12,
          color: '#e8e8ea',
          background: '#0d0d10',
          border: '1px solid #2a2a31',
          padding: '6px 10px',
          borderRadius: 6,
          wordBreak: 'break-all',
        }}>
          {display}
        </code>
        <button
          onClick={copy}
          style={{
            background: 'transparent',
            color: '#d4a333',
            border: '1px solid #d4a333',
            borderRadius: 6,
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return iso.slice(0, 10)
  }
}

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  gap: 12,
  alignItems: 'center',
  padding: '8px 4px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
}

const inputStyle = {
  background: '#0d0d10',
  color: '#e8e8ea',
  border: '1px solid #2a2a31',
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 13,
  flex: '1 1 140px',
  minWidth: 120,
}

const selectStyle = {
  ...inputStyle,
  flex: '1 1 180px',
  cursor: 'pointer',
}

const btnPrimary = {
  background: 'linear-gradient(180deg, #f0c24a, #d4a333)',
  color: '#0a0a0b',
  border: 0,
  borderRadius: 6,
  padding: '6px 14px',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.06em',
  cursor: 'pointer',
}

const btnGhost = {
  background: 'transparent',
  color: '#9c9ca3',
  border: '1px solid #3a3a41',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  cursor: 'pointer',
}

const btnDanger = {
  ...btnGhost,
  color: '#e07a7a',
  borderColor: '#5c2a2a',
}
