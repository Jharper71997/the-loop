'use client'

import { useEffect, useState } from 'react'

const KIND_LABELS = {
  attribution: 'Attribution',
  checkin: 'Check-in',
  bar: 'Bar',
  waiver: 'Waiver',
  sponsor: 'Sponsor',
}

export default function QrClient() {
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    kind: 'attribution',
    label: '',
    target_url: '/book',
    utm_source: '',
    utm_medium: 'qr',
    utm_campaign: '',
  })
  const [latest, setLatest] = useState(null)

  async function load() {
    setLoading(true)
    const res = await fetch('/api/qr/list')
    const json = await res.json()
    setCodes(json.codes || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function generate(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      if (json.error) {
        alert(json.error)
      } else {
        setLatest(json)
        setForm(f => ({ ...f, label: '', utm_campaign: '' }))
        await load()
      }
    } finally {
      setBusy(false)
    }
  }

  const totalScans = codes.reduce((s, c) => s + (c.scans_total || 0), 0)
  const totalConv = codes.reduce((s, c) => s + (c.conversions || 0), 0)
  const scans30 = codes.reduce((s, c) => s + (c.scans_30d || 0), 0)

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <h1>QR Codes</h1>
        <span className="tag-status">Live</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
        <Stat label="Codes" value={codes.length} />
        <Stat label="Scans (30d)" value={scans30} />
        <Stat label="Scans (all-time)" value={totalScans} />
        <Stat label="Paid conversions" value={totalConv} />
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'minmax(280px, 380px) 1fr' }}>
        <section className="card">
          <div className="hud-heading">Generate</div>
          <form onSubmit={generate}>
            <label className="muted tiny">Kind</label>
            <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>
              {Object.entries(KIND_LABELS).map(([k, l]) => (
                <option key={k} value={k}>{l}</option>
              ))}
            </select>

            <label className="muted tiny">Label (internal)</label>
            <input
              value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })}
              placeholder="Flyer stack — Angry Ginger Apr 25"
            />

            <label className="muted tiny">Target URL</label>
            <input
              value={form.target_url}
              onChange={e => setForm({ ...form, target_url: e.target.value })}
              placeholder="/book or https://…"
            />

            <label className="muted tiny">utm_source</label>
            <input
              value={form.utm_source}
              onChange={e => setForm({ ...form, utm_source: e.target.value })}
              placeholder="angry_ginger"
            />

            <label className="muted tiny">utm_campaign</label>
            <input
              value={form.utm_campaign}
              onChange={e => setForm({ ...form, utm_campaign: e.target.value })}
              placeholder="apr25_flyers"
            />

            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Generating…' : 'Generate QR'}
            </button>
          </form>

          {latest && (
            <>
              <hr className="divider" />
              <div className="hud-heading">Last generated</div>
              {latest.png_url ? (
                <img
                  src={latest.png_url}
                  alt="QR"
                  style={{ width: '100%', borderRadius: 6, border: '1px solid #1e1e23', background: '#0a0a0b' }}
                />
              ) : (
                <div className="muted tiny">
                  PNG unavailable ({latest.qr_error || 'qrcode.ai'}). Use any QR tool with the redirect URL below.
                </div>
              )}
              <div className="tiny" style={{ marginTop: 8 }}>REDIRECT</div>
              <div className="mono" style={{ fontSize: 12, wordBreak: 'break-all', color: '#d4a333' }}>
                {latest.redirect_url}
              </div>
            </>
          )}
        </section>

        <section className="card">
          <div className="hud-heading">All codes</div>
          {loading && <div className="muted">Loading…</div>}
          {!loading && codes.length === 0 && <div className="muted">No codes yet. Generate one on the left.</div>}
          <div style={{ display: 'grid', gap: 8 }}>
            {codes.map(c => (
              <CodeRow key={c.id} c={c} />
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}

function CodeRow({ c }) {
  const [open, setOpen] = useState(false)
  const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/r/${c.code}` : `/r/${c.code}`

  return (
    <div style={{
      background: '#0e0e12',
      border: '1px solid #1e1e23',
      borderRadius: 8,
      padding: 10,
    }}>
      <div className="row">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="chip chip-gold">{KIND_LABELS[c.kind] || c.kind}</span>
            <strong>{c.label || c.code}</strong>
          </div>
          <div className="tiny mono" style={{ marginTop: 2, color: '#d4a333' }}>
            /r/{c.code}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: 13, color: '#d4a333' }}>
            {c.scans_total} scan{c.scans_total === 1 ? '' : 's'}
          </div>
          <div className="tiny">
            {c.conversions} paid · {c.scans_30d} in 30d
          </div>
        </div>
        <button className="btn-subtle" onClick={() => setOpen(o => !o)}>{open ? 'Hide' : 'Show'}</button>
      </div>
      {open && (
        <div style={{ marginTop: 10, display: 'grid', gap: 8, gridTemplateColumns: c.png_url ? '180px 1fr' : '1fr' }}>
          {c.png_url && (
            <img
              src={c.png_url}
              alt=""
              style={{ width: 180, height: 180, borderRadius: 6, border: '1px solid #1e1e23', background: '#0a0a0b' }}
            />
          )}
          <div className="tiny" style={{ display: 'grid', gap: 4 }}>
            <div>
              <span className="muted">Target: </span>
              <span className="mono" style={{ wordBreak: 'break-all' }}>{c.target_url}</span>
            </div>
            {c.utm_source && <div><span className="muted">utm_source: </span><span className="mono">{c.utm_source}</span></div>}
            {c.utm_campaign && <div><span className="muted">utm_campaign: </span><span className="mono">{c.utm_campaign}</span></div>}
            <div>
              <span className="muted">Redirect: </span>
              <a href={redirectUrl} target="_blank" rel="noreferrer" className="mono" style={{ color: '#d4a333' }}>{redirectUrl}</a>
            </div>
            <div className="muted">Created {new Date(c.created_at).toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="card card-compact">
      <div className="stat">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
