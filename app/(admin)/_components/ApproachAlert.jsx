'use client'

import { useEffect, useRef, useState } from 'react'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const SURFACE = '#15151a'
const LINE = 'rgba(255,255,255,0.08)'
const GREEN = '#6fbf7f'

// Hybrid "5 minutes away" prompt — shown on BOTH the driver and security
// screens. The server watches the live shuttle pings and tells us which bar
// the shuttle is actually rolling up on (handles off-route, since it's by real
// distance, not schedule order). A human taps Send so a drive-by never fires a
// false alert. Either screen confirming pushes the waiting riders; the push
// tag coalesces so a double-tap can't double-buzz anyone.
//
// Re-alerts naturally on later cycles: once the shuttle pulls away the
// candidate clears, which resets the dismissed flag, so the next time it
// approaches that same bar the prompt comes back for whoever is still waiting.
export default function ApproachAlert({ eventId }) {
  const [candidate, setCandidate] = useState(null)
  const [dismissed, setDismissed] = useState(null) // stop_index muted for THIS approach
  const [sending, setSending] = useState(false)
  const [sentNote, setSentNote] = useState(null) // { stop_index, riders }
  const pollRef = useRef(null)

  useEffect(() => {
    if (!eventId) return
    let cancelled = false

    async function poll() {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch(`/api/shuttle/approaching?event_id=${encodeURIComponent(eventId)}`, { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        const c = json?.candidate || null
        setCandidate(c)
        // Shuttle has moved on (or nothing approaching) — clear the mute so the
        // next approach (next cycle, or a different bar) prompts again.
        if (!c) { setDismissed(null); setSentNote(null) }
      } catch {}
    }

    poll()
    pollRef.current = setInterval(poll, 12000)
    return () => { cancelled = true; clearInterval(pollRef.current) }
  }, [eventId])

  async function send() {
    if (!candidate || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/shuttle/approaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, stop_index: candidate.stop_index }),
      })
      const json = await res.json().catch(() => ({}))
      if (json?.ok) {
        setSentNote({ stop_index: candidate.stop_index, riders: json.sent ?? candidate.riders })
      }
    } catch {}
    finally {
      // Mute this approach either way so we don't nag; it re-arms when the
      // shuttle pulls away.
      setDismissed(candidate.stop_index)
      setSending(false)
    }
  }

  if (!eventId) return null

  // Just-sent confirmation, shown until the shuttle moves on.
  if (sentNote && (!candidate || candidate.stop_index === sentNote.stop_index)) {
    return (
      <div style={{
        background: 'rgba(111,191,127,0.10)', border: `1px solid rgba(111,191,127,0.45)`,
        borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>✓</span>
        <div style={{ color: INK, fontSize: 13, fontWeight: 600 }}>
          Heads-up sent{sentNote.riders ? ` to ${sentNote.riders} rider${sentNote.riders === 1 ? '' : 's'}` : ''}.
        </div>
      </div>
    )
  }

  if (!candidate || candidate.stop_index === dismissed) return null

  const riders = candidate.riders || 0

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(212,163,51,0.16), rgba(212,163,51,0.06))',
      border: `1.5px solid rgba(212,163,51,0.5)`,
      borderRadius: 14, padding: '14px 16px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 20 }}>🚐</span>
        <div style={{ color: GOLD, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 800 }}>
          About {candidate.eta_min} min from
        </div>
      </div>
      <div style={{ color: INK, fontSize: 19, fontWeight: 800, lineHeight: 1.15 }}>
        {candidate.bar_name}
      </div>
      <div style={{ color: INK_DIM, fontSize: 13, marginTop: 3 }}>
        {riders > 0
          ? `${riders} rider${riders === 1 ? '' : 's'} waiting here. Send the heads-up so they head outside.`
          : 'No riders booked here are still waiting.'}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          type="button"
          onClick={send}
          disabled={sending || riders === 0}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: 10,
            background: riders === 0 ? 'rgba(255,255,255,0.06)' : `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
            color: riders === 0 ? INK_DIM : '#0a0a0b',
            border: 0,
            fontWeight: 800,
            fontSize: 14,
            cursor: riders === 0 ? 'default' : 'pointer',
          }}
        >
          {sending ? 'Sending…' : riders === 0 ? 'No one to alert' : `Send heads-up`}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(candidate.stop_index)}
          style={{
            padding: '12px 16px',
            borderRadius: 10,
            background: 'transparent',
            color: INK,
            border: `1px solid ${LINE}`,
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Not now
        </button>
      </div>
    </div>
  )
}
