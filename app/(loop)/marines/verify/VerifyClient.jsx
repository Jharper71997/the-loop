'use client'

import { useState } from 'react'

// Names kept (OLIVE/SAND) to avoid churn; values are now the red theme.
const INK = '#eef1f3'
const INK_DIM = '#9aa3ab'
const OLIVE = '#e5484d'
const OLIVE_HI = '#f2585d'
const SAND = '#c9ccd1'
const SURFACE = '#1a2027'
const LINE = 'rgba(255,255,255,0.10)'

const BRANCHES = ['Marine Corps', 'Navy', 'Army', 'Air Force', 'Coast Guard', 'Space Force']

export default function VerifyClient() {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [branch, setBranch] = useState('Marine Corps')
  const [rank, setRank] = useState('')
  const [unit, setUnit] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!firstName.trim() || (!email.trim() && !phone.trim())) {
      setError('Add your name and at least an email or phone.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/marines/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          branch,
          rank: rank.trim(),
          unit: unit.trim(),
          note: note.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.error || `Could not submit (${res.status})`); return }
      setDone(true)
    } catch (err) {
      setError(err.message || 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <main style={{ padding: '16px 14px 28px' }}>
        <div style={{ maxWidth: 460, margin: '0 auto', ...card, padding: '28px 22px', textAlign: 'center' }}>
          <div style={{ color: SAND, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>Request received</div>
          <h1 style={{ color: INK, fontSize: 24, fontWeight: 800, margin: '10px 0 8px' }}>You're in the queue</h1>
          <p style={{ color: INK_DIM, fontSize: 14.5, lineHeight: 1.5, margin: 0 }}>
            We'll confirm your military ID and unlock your pass. You'll get a text or email the moment
            you're cleared to ride. Have your ID ready when you board.
          </p>
          <a href="/marines" style={{ ...ghostCta, marginTop: 18, display: 'inline-block' }}>Back to The Loop</a>
        </div>
      </main>
    )
  }

  return (
    <main style={{ padding: '16px 14px 28px' }}>
      <div style={{ maxWidth: 460, margin: '0 auto', display: 'grid', gap: 14 }}>
        <div>
          <div style={{ color: SAND, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>The Loop</div>
          <h1 style={{ color: INK, fontSize: 26, fontWeight: 800, margin: '8px 0 6px', letterSpacing: '-0.01em' }}>Verify to ride</h1>
          <p style={{ color: INK_DIM, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            Quick one-time ID check so we know you're cleared to ride. Takes a minute. After this you're set for every ride.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ ...card, padding: '18px 16px', display: 'grid', gap: 12 }}>
          <Row>
            <Field label="First name"><input style={input} value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="given-name" /></Field>
            <Field label="Last name"><input style={input} value={lastName} onChange={e => setLastName(e.target.value)} autoComplete="family-name" /></Field>
          </Row>
          <Field label="Email"><input style={input} type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" /></Field>
          <Field label="Phone"><input style={input} type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="(910) 555 0123" /></Field>
          <Field label="Branch">
            <select style={input} value={branch} onChange={e => setBranch(e.target.value)}>
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
          <Row>
            <Field label="Rank (optional)"><input style={input} value={rank} onChange={e => setRank(e.target.value)} placeholder="e.g. LCpl" /></Field>
            <Field label="Unit (optional)"><input style={input} value={unit} onChange={e => setUnit(e.target.value)} placeholder="e.g. 2/8" /></Field>
          </Row>
          <Field label="Anything we should know? (optional)">
            <textarea style={{ ...input, minHeight: 64, resize: 'vertical' }} value={note} onChange={e => setNote(e.target.value)} placeholder="Unit, when you usually ride, etc." />
          </Field>

          {error && <div style={{ color: '#ff8585', fontSize: 13 }}>{error}</div>}

          <button type="submit" disabled={submitting} style={{ ...primaryCta, opacity: submitting ? 0.6 : 1, cursor: submitting ? 'default' : 'pointer', border: 'none' }}>
            {submitting ? 'Submitting…' : 'Submit for verification'}
          </button>
          <div style={{ color: INK_DIM, fontSize: 11.5, lineHeight: 1.4, textAlign: 'center' }}>
            We use this only to confirm you're military and to text you when your pass is ready.
          </div>
        </form>
      </div>
    </main>
  )
}

function Row({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div> }
function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ color: INK_DIM, fontSize: 12, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  )
}

const card = { borderRadius: 14, background: SURFACE, border: `1px solid ${LINE}` }
const input = { width: '100%', padding: '11px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: `1px solid ${LINE}`, color: INK, fontSize: 15, outline: 'none' }
const primaryCta = { padding: '13px 22px', borderRadius: 10, background: `linear-gradient(180deg, ${OLIVE_HI}, ${OLIVE})`, color: '#fff', fontWeight: 800, fontSize: 15 }
const ghostCta = { padding: '12px 18px', borderRadius: 999, background: 'transparent', color: INK, border: `1px solid ${LINE}`, fontWeight: 600, textDecoration: 'none', fontSize: 14 }
