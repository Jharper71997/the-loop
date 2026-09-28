'use client'

import { useState } from 'react'

// Door pickup organizer: the link their group uses to pay their own seats.
export default function CopyJoinLink({ url, slot }) {
  const [copied, setCopied] = useState(false)
  const text = `I booked us a ride to Oktoberfest${slot ? ` (${slot.replace(/\s*·\s*Zone\s*\d/i, '')} pickup)` : ''}. Grab your $10 seat here: ${url}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {}
  }

  return (
    <div style={{
      marginTop: 32, padding: '20px 20px 22px', borderRadius: 16,
      background: 'rgba(212,163,51,0.08)', border: '1px solid rgba(212,163,51,0.4)',
    }}>
      <div style={{ color: '#f0c24a', fontWeight: 800, fontSize: 17 }}>Now send this to your group</div>
      <p style={{ color: '#d6d6dc', fontSize: 14.5, lineHeight: 1.55, margin: '8px 0 14px' }}>
        Each friend opens it, pays their own $10, and rides with you from the same address.
        We need 4 or more in the group.
      </p>
      <div style={{
        padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.35)',
        color: '#f5f5f7', fontSize: 13.5, wordBreak: 'break-all', marginBottom: 12,
      }}>
        {url}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={copy} style={btn}>{copied ? 'Copied' : 'Copy message'}</button>
        <a href={`sms:?&body=${encodeURIComponent(text)}`} style={{ ...btn, textDecoration: 'none' }}>Text it</a>
      </div>
    </div>
  )
}

const btn = {
  display: 'inline-block', padding: '11px 20px', borderRadius: 999, border: 0, cursor: 'pointer',
  background: 'linear-gradient(180deg, #f0c24a, #d4a333)', color: '#111', fontWeight: 800, fontSize: 14,
}
