'use client'

import { useEffect, useState } from 'react'

export default function LeaderboardAdminClient() {
  const [board, setBoard] = useState(null)
  const [roster, setRoster] = useState(null)
  const [error, setError] = useState(null)
  const [busySlug, setBusySlug] = useState(null)

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

  async function toggleActive(slug, active) {
    setBusySlug(slug)
    try {
      await fetch('/api/admin/bartenders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, active }),
      })
      setRoster(prev => prev.map(b => b.slug === slug ? { ...b, active } : b))
    } finally {
      setBusySlug(null)
    }
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
        <div className="hud-heading">Roster · {roster.filter(b => b.active).length} active / {roster.length} total</div>
        {roster.length === 0 ? (
          <div className="muted">No signups yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            <HeaderRow cells={['Name', 'Bar', 'Slug', 'Joined', 'QR', 'Active']} />
            {roster.map(b => (
              <div key={b.slug} className="row" style={rowStyle}>
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
                  onClick={() => toggleActive(b.slug, !b.active)}
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
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function HeaderRow({ cells }) {
  return (
    <div className="row tiny" style={{ ...rowStyle, color: '#6f6f76', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
      {cells.map((c, i) => <span key={i}>{c}</span>)}
    </div>
  )
}

function CopyableLine({ label, path, addCode = false, addToken = false }) {
  const [copied, setCopied] = useState(false)
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])

  // We don't expose the env values to the client. The full URL with code/token
  // is only known if the user already has them in their clipboard or pastes them
  // in. We display the path + a hint; the actual share link is constructed by
  // pasting the env value into the placeholder.
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
