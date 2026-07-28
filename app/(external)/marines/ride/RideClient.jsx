'use client'

import { useState } from 'react'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const INK_MUTED = '#8a8a90'
const LINE = 'rgba(255,255,255,0.08)'
const SURFACE = '#15151a'
const RED = '#e07a7a'
const GREEN = '#6fbf7f'

const FARES = [
  { id: 'single', name: 'Single Ride', price: '$10', note: 'One boarding. Ride to your stop and hop off.' },
  { id: 'day', name: 'Day Pass', price: '$20', note: 'Hop on and off all day, as many loops as you want.', featured: true },
]

export default function RideClient({ firstName }) {
  const [picked, setPicked] = useState('day')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  async function onBuy() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/marines/ride-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pass_type: picked }),
      })
      const json = await res.json()
      if (!res.ok || !json.url) {
        if (json.error === 'verification_required') {
          window.location.href = '/marines/verify'
          return
        }
        setError(json.error || 'Could not start checkout. Try again.')
        setSubmitting(false)
        return
      }
      window.location.href = json.url
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <main style={{ padding: '16px 14px 28px' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'grid', gap: 16 }}>
        <div>
          <div style={{ ...eyebrow, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: GREEN }}>&#10003;</span> Verified
          </div>
          <h1 style={{ color: INK, fontSize: 26, fontWeight: 800, margin: '8px 0 6px', letterSpacing: '-0.01em' }}>
            Grab a ride{firstName ? `, ${firstName}` : ''}.
          </h1>
          <p style={{ color: INK_DIM, fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            Pick your fare. Board The Loop at the on-base gate and ride the loop around town.
          </p>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {FARES.map(f => {
            const active = picked === f.id
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setPicked(f.id)}
                style={{
                  textAlign: 'left', cursor: 'pointer', padding: '16px 16px', borderRadius: 14,
                  background: active ? 'rgba(212,163,51,0.12)' : SURFACE,
                  border: `1px solid ${active ? GOLD : LINE}`,
                  boxShadow: active ? '0 10px 30px rgba(212,163,51,0.14)' : 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                }}
              >
                <div>
                  <div style={{ color: active ? GOLD_HI : INK, fontSize: 15, fontWeight: 800 }}>{f.name}</div>
                  <div style={{ color: INK_DIM, fontSize: 12.5, marginTop: 2, lineHeight: 1.4 }}>{f.note}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ color: GOLD_HI, fontSize: 22, fontWeight: 800 }}>{f.price}</span>
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${active ? GOLD : 'rgba(255,255,255,0.25)'}`,
                    background: active ? GOLD : 'transparent',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    color: '#0a0a0b', fontSize: 13, fontWeight: 900,
                  }}>{active ? '✓' : ''}</span>
                </div>
              </button>
            )
          })}
        </div>

        {error && (
          <div style={{ color: RED, fontSize: 13, padding: '8px 12px', background: 'rgba(224,122,122,0.08)', borderRadius: 8 }}>
            {error}
          </div>
        )}

        <button type="button" onClick={onBuy} disabled={submitting} style={{ ...primaryCta, border: 0, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
          {submitting ? 'Starting checkout…' : `Pay ${picked === 'day' ? '$20' : '$10'} and ride`}
        </button>
        <p style={{ color: INK_MUTED, fontSize: 11, textAlign: 'center', margin: 0 }}>
          Secure checkout. Card only. You&rsquo;ll get your pass right after.
        </p>
      </div>
    </main>
  )
}

const eyebrow = { color: GOLD, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }
const primaryCta = { display: 'block', textAlign: 'center', padding: '16px 22px', borderRadius: 12, background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`, color: '#0a0a0b', fontWeight: 800, fontSize: 16, textDecoration: 'none', boxShadow: '0 10px 30px rgba(212,163,51,0.25)' }
