'use client'

import { useEffect, useState } from 'react'

const ACCENT = '#d4a333'
const SURFACE = '#15151a'
const BORDER = '#2a2a31'

export default function WaiverForm({ contactId }) {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [typedName, setTypedName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/waiver?contact_id=${encodeURIComponent(contactId)}`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return
        if (json.error) setLoadError(json.error)
        else setData(json)
      })
      .catch(e => { if (!cancelled) setLoadError(e.message) })
    return () => { cancelled = true }
  }, [contactId])

  async function onSubmit(e) {
    e.preventDefault()
    if (!typedName.trim() || submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/waiver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact_id: contactId, typed_name: typedName.trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        setSubmitError(json.error || `Sign failed (${res.status})`)
        setSubmitting(false)
        return
      }
      setDone(true)
    } catch (err) {
      setSubmitError(err.message)
      setSubmitting(false)
    }
  }

  if (loadError) {
    return <Card>Failed to load waiver: {loadError}</Card>
  }
  if (!data) {
    return <Card>Loading…</Card>
  }
  if (done || data.already_signed) {
    return (
      <Card>
        <div style={{ fontSize: 30, textAlign: 'center' }}>✓</div>
        <h2 style={{ color: ACCENT, textAlign: 'center', margin: '8px 0' }}>Waiver signed</h2>
        <p style={{ color: '#bbb', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
          Thanks{data.contact_name ? `, ${data.contact_name}` : ''}. You're cleared to ride.
        </p>
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <a href="/my-tickets" style={primaryBtn}>My tickets</a>
        </div>
      </Card>
    )
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
      <Card>
        <h1 style={{ color: ACCENT, margin: 0, fontSize: 22 }}>Sign your waiver</h1>
        {data.contact_name && (
          <p style={{ color: '#bbb', margin: '6px 0 0', fontSize: 14 }}>For {data.contact_name}</p>
        )}
        <p style={{ color: '#9c9ca3', margin: '10px 0 0', fontSize: 13 }}>
          Read the waiver below, then type your full legal name to sign.
        </p>
      </Card>

      <Card>
        <pre style={{
          whiteSpace: 'pre-wrap',
          fontFamily: 'inherit',
          fontSize: 13,
          color: '#ddd',
          margin: 0,
          maxHeight: 360,
          overflowY: 'auto',
        }}>
          {data.waiver.body_md}
        </pre>
      </Card>

      <Card>
        <label style={{ fontSize: 13, color: '#bbb' }}>
          Type your full legal name
        </label>
        <input
          value={typedName}
          onChange={e => setTypedName(e.target.value)}
          placeholder="Your full legal name"
          style={{
            background: '#0a0a0b',
            border: `1px solid ${BORDER}`,
            color: '#fff',
            padding: '10px 12px',
            borderRadius: 8,
            fontSize: 14,
            width: '100%',
            boxSizing: 'border-box',
            marginTop: 6,
          }}
        />
        {typedName && (
          <div style={{ fontSize: 11, color: '#9c9ca3', marginTop: 6 }}>
            Signed by {typedName} · {new Date().toLocaleDateString('en-US')}
          </div>
        )}
      </Card>

      {submitError && (
        <Card style={{ borderColor: '#f87171', background: '#3a1a1a' }}>
          <div style={{ color: '#f87171', fontSize: 13 }}>{submitError}</div>
        </Card>
      )}

      <button
        type="submit"
        disabled={!typedName.trim() || submitting}
        style={{
          ...primaryBtn,
          opacity: !typedName.trim() || submitting ? 0.5 : 1,
          cursor: !typedName.trim() || submitting ? 'not-allowed' : 'pointer',
          width: '100%',
        }}
      >
        {submitting ? 'Signing…' : 'Sign waiver'}
      </button>
    </form>
  )
}

function Card({ children, style }) {
  return (
    <section style={{
      background: SURFACE,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: 14,
      ...style,
    }}>
      {children}
    </section>
  )
}

const primaryBtn = {
  display: 'inline-block',
  background: ACCENT,
  color: '#0a0a0b',
  border: 0,
  padding: '12px 20px',
  borderRadius: 10,
  fontWeight: 700,
  fontSize: 15,
  textDecoration: 'none',
  cursor: 'pointer',
}
