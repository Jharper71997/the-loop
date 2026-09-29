'use client'

import { useEffect, useState } from 'react'

export default function LeaderboardAdminClient({ signupCode = '', leaderboardToken = '' }) {
  const [board, setBoard] = useState(null)
  const [roster, setRoster] = useState(null)
  const [error, setError] = useState(null)
  const [busySlug, setBusySlug] = useState(null)
  const [editingSlug, setEditingSlug] = useState(null)
  const [adding, setAdding] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  // Paid orders per seller slug, with the buyer, for checking payouts.
  const [sales, setSales] = useState(null)
  const [openSlug, setOpenSlug] = useState(null)

  async function manualRefresh() {
    setRefreshing(true)
    try {
      await refetchAll({ fresh: true })
    } catch (e) {
      alert(e.message)
    } finally {
      setRefreshing(false)
    }
  }

  async function refetchAll({ fresh = false } = {}) {
    const board = await fetch(`/api/leaderboard${fresh ? '?fresh=1' : ''}`).then(r => r.json())
    const r = await fetch('/api/admin/bartenders').then(r => r.json())
    const s = await fetch('/api/admin/seller-sales').then(r => r.json()).catch(() => null)
    setBoard(board)
    setRoster(r.bartenders || [])
    setSales(s?.sales || {})
  }

  useEffect(() => {
    let cancelled = false
    refetchAll().catch(e => { if (!cancelled) setError(e.message) })
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
      refetchAll({ fresh: true }).catch(() => {})
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
      refetchAll({ fresh: true }).catch(() => {})
    } catch (e) {
      alert(e.message)
    } finally {
      setBusySlug(null)
    }
  }

  async function createBartender({ first_name, last_name, bar_slug }) {
    const res = await fetch('/api/admin/bartenders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name, last_name, bar_slug }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || `create failed (${res.status})`)
    setRoster(prev => [data.bartender, ...prev])
    setAdding(false)
    refetchAll({ fresh: true }).catch(() => {})
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span className="tag-status">{board.month} · {board.days_remaining}d left</span>
          <button onClick={manualRefresh} disabled={refreshing} style={btnPrimary}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div className="hud-heading">Standings · this month</div>
          {board.updated_at && (
            <div className="tiny muted">Updated {formatTime(board.updated_at)}</div>
          )}
        </div>
        {standings.length === 0 ? (
          <div className="muted">No sellers signed up yet. Share the signup link below.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            <HeaderRow cells={['#', 'Name', 'Tickets', 'Collected', `Commission ${Math.round((board.commission_rate || 0) * 100)}%`]} cols={5} />
            {standings.map((row, idx) => (
              <div key={row.slug}>
              <div className="row" style={{ ...rowStyle, gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                <span className="mono" style={{ color: '#8a5f0a' }}>{idx + 1}</span>
                <span>
                  {(sales?.[row.slug] || []).length > 0 ? (
                    <button
                      onClick={() => setOpenSlug(openSlug === row.slug ? null : row.slug)}
                      style={{ background: 'none', border: 0, padding: 0, color: '#8a5f0a', cursor: 'pointer', textDecoration: 'underline', font: 'inherit', textAlign: 'left' }}
                    >
                      {openSlug === row.slug ? '▾' : '▸'} {row.name}
                    </button>
                  ) : row.name}
                </span>
                <span className="mono" style={{ color: '#17130f' }}>{row.tickets}</span>
                <span className="mono">{formatMoney(row.revenue_cents)}</span>
                <span className="mono" style={{ color: '#0f7a4e' }}>{formatMoney(row.commission_cents)}</span>
              </div>
              {openSlug === row.slug && <SellerSales orders={sales?.[row.slug] || []} rate={board.commission_rate || 0} />}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="hud-heading">Share links</div>
        <div style={{ display: 'grid', gap: 10 }}>
          <CopyableLine label="Signup (text this to anyone selling)" path={signupCode ? `${signupUrl}?code=${encodeURIComponent(signupCode)}` : signupUrl} />
          <CopyableLine label="Public leaderboard" path={leaderboardToken ? `${leaderboardUrl}?t=${encodeURIComponent(leaderboardToken)}` : leaderboardUrl} />
        </div>
        <div className="tiny muted" style={{ marginTop: 10 }}>
          Tokens come from <code>BARTENDER_SIGNUP_CODE</code> and <code>LEADERBOARD_TOKEN</code> env vars.
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div className="hud-heading">Roster · {roster.filter(b => b.active).length} active / {roster.length} total</div>
          <button onClick={() => setAdding(true)} style={btnPrimary}>+ Add seller</button>
        </div>

        {adding && (
          <AddRow onCancel={() => setAdding(false)} onSave={createBartender} />
        )}

        {roster.length === 0 ? (
          <div className="muted" style={{ marginTop: 10 }}>No signups yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
            <HeaderRow cells={['Name', 'Code', 'Joined', 'Link / QR', 'Active', 'Actions']} cols={6} />
            {roster.map(b => editingSlug === b.slug ? (
              <EditRow
                key={b.slug}
                bartender={b}
                onCancel={() => setEditingSlug(null)}
                onSave={async payload => {
                  await patch(b.slug, payload)
                  setEditingSlug(null)
                }}
                busy={busySlug === b.slug}
              />
            ) : (
              <div key={b.slug} className="row" style={{ ...rowStyle, gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
                <span style={{ opacity: b.active ? 1 : 0.5 }}>{b.display_name}</span>
                <span className="mono tiny" style={{ color: '#6e6154' }}>{b.share_code || '—'}</span>
                <span className="tiny muted">{formatDate(b.created_at)}</span>
                <span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {b.referral_url && <CopyLinkButton url={b.referral_url} />}
                  {b.qr_image_url ? (
                    <a href={b.qr_image_url} download={`brewloop-${b.slug}.png`} style={{ color: '#8a5f0a', fontSize: 12 }}>
                      QR
                    </a>
                  ) : null}
                </span>
                <button
                  onClick={() => patch(b.slug, { active: !b.active })}
                  disabled={busySlug === b.slug}
                  style={{
                    background: 'transparent',
                    color: b.active ? '#8a5f0a' : '#7d7060',
                    border: `1px solid ${b.active ? '#d4a333' : '#d7c6a4'}`,
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

function AddRow({ onCancel, onSave }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  async function submit() {
    if (!firstName.trim() || !lastName.trim()) return
    setBusy(true)
    setErr(null)
    try {
      await onSave({ first_name: firstName.trim(), last_name: lastName.trim(), bar_slug: '' })
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8, padding: '10px 4px', borderBottom: '1px solid rgba(23,19,15,0.05)', marginTop: 6 }}>
      <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.14em' }}>New seller</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          autoFocus
          placeholder="First name"
          value={firstName}
          onChange={e => setFirstName(e.target.value)}
          style={inputStyle}
        />
        <input
          placeholder="Last name"
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          style={inputStyle}
        />
        <button onClick={submit} disabled={busy} style={btnPrimary}>{busy ? 'Saving…' : 'Save'}</button>
        <button onClick={onCancel} disabled={busy} style={btnGhost}>Cancel</button>
      </div>
      {err && <div className="tiny" style={{ color: '#b3311f' }}>{err}</div>}
    </div>
  )
}

function EditRow({ bartender, onCancel, onSave, busy }) {
  const [name, setName] = useState(bartender.display_name)

  function submit() {
    const payload = {}
    if (name.trim() && name.trim() !== bartender.display_name) payload.display_name = name.trim()
    if (Object.keys(payload).length === 0) {
      onCancel()
      return
    }
    onSave(payload)
  }

  return (
    <div style={{ display: 'grid', gap: 8, padding: '10px 4px', borderBottom: '1px solid rgba(23,19,15,0.05)' }}>
      <div className="tiny muted" style={{ textTransform: 'uppercase', letterSpacing: '0.14em' }}>
        Editing {bartender.slug}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
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
      color: '#7d7060',
      textTransform: 'uppercase',
      letterSpacing: '0.14em',
    }}>
      {cells.map((c, i) => <span key={i}>{c}</span>)}
    </div>
  )
}

function CopyableLine({ label, path }) {
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])

  const display = `${origin}${path}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(display)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div>
      <div className="tiny" style={{ color: '#6e6154', marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <code style={{
          flex: '1 1 240px',
          fontFamily: 'inherit',
          fontSize: 12,
          color: '#17130f',
          background: '#ffffff',
          border: '1px solid #e8ddc8',
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
            color: '#8a5f0a',
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

// Who paid under one seller this month: one line per order.
function SellerSales({ orders, rate }) {
  return (
    <div style={{ margin: '2px 0 10px 24px', padding: '8px 12px', borderLeft: '2px solid #d4a333', display: 'grid', gap: 4 }}>
      <HeaderRow cells={['Paid', 'Buyer', 'Phone', 'Loop', 'Tickets', 'Collected', 'Commission']} cols={7} />
      {orders.map(o => (
        <div key={o.id} className="row tiny" style={{ ...rowStyle, gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', padding: '4px' }}>
          <span className="muted">{formatDate(o.paid_at)}</span>
          <span>{o.buyer_name || '—'}</span>
          <span className="mono">{o.buyer_phone || o.buyer_email || '—'}</span>
          <span className="muted">{o.event_name || '—'}{o.event_date ? ` · ${formatDate(o.event_date + 'T12:00:00')}` : ''}</span>
          <span className="mono">{o.tickets}</span>
          <span className="mono">{formatMoney(o.collected_cents)}</span>
          <span className="mono" style={{ color: '#0f7a4e' }}>{formatMoney(Math.round(o.collected_cents * rate))}</span>
        </div>
      ))}
    </div>
  )
}

function CopyLinkButton({ url }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }
  return (
    <button onClick={copy} title={url} style={{ background: 'none', border: 0, padding: 0, color: '#8a5f0a', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
      {copied ? 'Copied' : 'Copy link'}
    </button>
  )
}

function formatMoney(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`
}

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return iso.slice(0, 10)
  }
}

function formatTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } catch {
    return iso
  }
}

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
  gap: 12,
  alignItems: 'center',
  padding: '8px 4px',
  borderBottom: '1px solid rgba(23,19,15,0.05)',
}

const inputStyle = {
  background: '#ffffff',
  color: '#17130f',
  border: '1px solid #e8ddc8',
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
  color: '#231903',
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
  color: '#6e6154',
  border: '1px solid #d7c6a4',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.06em',
  cursor: 'pointer',
}

const btnDanger = {
  ...btnGhost,
  color: '#b3311f',
  borderColor: '#f7cfc6',
}
