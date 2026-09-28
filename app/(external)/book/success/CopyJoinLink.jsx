'use client'

import { useState } from 'react'

// Door pickup organizer: a personal pay link for each friend they listed (their
// seat is held), plus the open group link for anyone they add later.
export default function CopyJoinLink({ url, slot, friends = [] }) {
  const [copied, setCopied] = useState(false)
  const when = slot ? ` (${slot.replace(/\s*·\s*Zone\s*\d/i, '')} pickup)` : ''
  const message = link => `I booked us a ride to Oktoberfest${when}. Your seat is held, pay your $10 here: ${link}`
  const groupText = `I booked us a ride to Oktoberfest${when}. Grab your $10 seat here: ${url}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(groupText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {}
  }

  return (
    <div style={{
      marginTop: 32, padding: '20px 20px 22px', borderRadius: 16,
      background: 'rgba(212,163,51,0.08)', border: '1px solid rgba(212,163,51,0.4)',
    }}>
      {friends.length > 0 && (
        <>
          <div style={{ color: '#f0c24a', fontWeight: 800, fontSize: 17 }}>Text each friend their link</div>
          <p style={{ color: '#d6d6dc', fontSize: 14.5, lineHeight: 1.55, margin: '8px 0 14px' }}>
            Their seat is held. Each one pays their own $10 and signs their own waiver.
          </p>
          <div style={{ display: 'grid', gap: 10, marginBottom: 22 }}>
            {friends.map(f => (
              <div key={f.url} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ color: '#f5f5f7', fontWeight: 700 }}>{f.name}</span>
                <a href={`sms:${f.phone || ''}?&body=${encodeURIComponent(message(f.url))}`} style={{ ...btn, textDecoration: 'none' }}>
                  Text {f.name.split(' ')[0]}
                </a>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ color: '#f0c24a', fontWeight: 800, fontSize: friends.length ? 15 : 17 }}>
        {friends.length ? 'Adding someone else?' : 'Share with your group'}
      </div>
      <p style={{ color: '#d6d6dc', fontSize: 14, lineHeight: 1.55, margin: '8px 0 12px' }}>
        Anyone with this link can pay their own $10 and ride with your group, while seats last.
      </p>
      <div style={{
        padding: '10px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.35)',
        color: '#f5f5f7', fontSize: 13.5, wordBreak: 'break-all', marginBottom: 12,
      }}>
        {url}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" onClick={copy} style={btn}>{copied ? 'Copied' : 'Copy message'}</button>
        <a href={`sms:?&body=${encodeURIComponent(groupText)}`} style={{ ...btn, textDecoration: 'none' }}>Text it</a>
      </div>
    </div>
  )
}

const btn = {
  display: 'inline-block', padding: '11px 20px', borderRadius: 999, border: 0, cursor: 'pointer',
  background: 'linear-gradient(180deg, #f0c24a, #d4a333)', color: '#111', fontWeight: 800, fontSize: 14,
}
