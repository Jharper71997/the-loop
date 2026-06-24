'use client'

import { useEffect, useRef, useState } from 'react'
import { C } from '../../../_theme'

const GREEN = '#5fc97a'

// The Loop boarding pass — gold-themed fork of the Brew Loop TicketView. No
// waiver, no security chat. Keeps the screen awake + share so the rider can
// flash the QR to the driver at the gate.
export default function LoopTicketView({
  code,
  qrDataUrl,
  ticketUrl,
  riderName,
  passType,
  eventName,
  eventDate,
  pickupTime,
  pickupSpot,
  isPaid,
  isVoided,
  checkedInAt,
}) {
  const wakeLockRef = useRef(null)
  const [shareSupported, setShareSupported] = useState(false)
  const [brightHint, setBrightHint] = useState(false)

  useEffect(() => {
    setShareSupported(typeof navigator !== 'undefined' && !!navigator.share)

    let cancelled = false
    async function acquireWake() {
      try {
        if ('wakeLock' in navigator) {
          const wl = await navigator.wakeLock.request('screen')
          if (cancelled) { wl.release(); return }
          wakeLockRef.current = wl
        } else {
          setBrightHint(true)
        }
      } catch {
        setBrightHint(true)
      }
    }
    acquireWake()

    function onVis() {
      if (document.visibilityState === 'visible' && !wakeLockRef.current) acquireWake()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      if (wakeLockRef.current) {
        try { wakeLockRef.current.release() } catch {}
        wakeLockRef.current = null
      }
    }
  }, [])

  async function onShare() {
    const text = `${riderName} — The Loop pass\n${ticketUrl}`
    if (navigator.share) {
      try { await navigator.share({ title: 'The Loop pass', text, url: ticketUrl }) } catch {}
    } else if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(ticketUrl); alert('Pass link copied') } catch {}
    }
  }

  const dateLabel = formatDate(eventDate)
  const timeLabel = formatTime(pickupTime)
  const checkedIn = !!checkedInAt

  if (isVoided) {
    return (
      <div className="external-shell" style={{ minHeight: '100dvh', background: C.BG, color: C.INK, padding: '24px 16px 48px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 36 }}>×</div>
          <h1 style={{ color: C.INK, fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.015em' }}>This pass has been voided</h1>
          <p style={{ color: C.INK_DIM, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            It&apos;s no longer valid for boarding. If this looks wrong, see your loop staff.
          </p>
          <a href="/marines" style={primaryBtn}>Back to The Loop</a>
        </div>
      </div>
    )
  }

  return (
    <div className="external-shell" style={{ minHeight: '100dvh', background: C.BG, color: C.INK, padding: '24px 16px 48px',
      display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ maxWidth: 460, width: '100%', display: 'grid', gap: 18 }}>
        <header style={{ textAlign: 'center', paddingTop: 8 }}>
          <div style={{ color: C.GOLD, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
            The Loop · Boarding pass
          </div>
          <h1 style={{ color: C.INK, fontSize: 24, fontWeight: 700, margin: '8px 0 0', letterSpacing: '-0.015em' }}>{riderName}</h1>
          <div style={{ color: C.INK_DIM, fontSize: 14, marginTop: 4 }}>
            {eventName}{dateLabel ? ` · ${dateLabel}` : ''}
          </div>
          {passType && (
            <div style={{ display: 'inline-block', marginTop: 10, padding: '4px 12px', borderRadius: 999,
              background: 'rgba(212,163,51,0.14)', border: `1px solid ${C.GOLD}`, color: C.GOLD_HI,
              fontSize: 12, fontWeight: 800, letterSpacing: '0.04em' }}>
              {passType}
            </div>
          )}
        </header>

        {(pickupSpot || timeLabel) && (
          <div style={{ background: 'rgba(212,163,51,0.08)', border: `1px solid rgba(212,163,51,0.35)`,
            borderRadius: 14, padding: '14px 16px', display: 'grid', gap: 4 }}>
            <div style={{ color: C.GOLD, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
              Board at
            </div>
            <div style={{ color: C.INK, fontSize: 18, fontWeight: 700 }}>{pickupSpot || 'Gate pickup'}</div>
            {timeLabel && (
              <div style={{ color: C.INK_DIM, fontSize: 14 }}>{timeLabel}{dateLabel ? ` · ${dateLabel}` : ''}</div>
            )}
          </div>
        )}

        {/* White QR card so the camera reads it cleanly at low brightness. */}
        <div style={{ background: '#ffffff', borderRadius: 22, padding: 18, display: 'flex',
          flexDirection: 'column', alignItems: 'center',
          boxShadow: '0 30px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(212,163,51,0.4)' }}>
          <img src={qrDataUrl} alt="Pass QR code" style={{ width: '100%', maxWidth: 320, height: 'auto', display: 'block' }} />
          <div style={{ marginTop: 10, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 12, letterSpacing: '0.2em', color: '#3a3a44', textTransform: 'uppercase' }}>
            {code}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <StatusPill
            ok={isPaid}
            label={isPaid ? 'Paid' : 'Payment pending'}
            sub={isPaid ? 'Your seat is locked in.' : 'Once payment clears this pass goes green.'}
          />
          {checkedIn && (
            <StatusPill ok={true} label="Checked in" sub={`Scanned at ${formatDateTime(checkedInAt)}`} />
          )}
        </div>

        <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
          <button type="button" onClick={onShare} style={primaryBtn}>
            {shareSupported ? 'Share this pass' : 'Copy pass link'}
          </button>
        </div>

        {brightHint && (
          <p style={{ color: C.INK_DIM, fontSize: 12, textAlign: 'center', margin: 0 }}>
            Tip: turn your screen brightness up before scanning.
          </p>
        )}

        <p style={{ color: C.INK_DIM, fontSize: 12, textAlign: 'center', margin: '4px 0 0' }}>
          Show this screen to the driver when you board. ID required to ride.
        </p>
      </div>
    </div>
  )
}

function StatusPill({ ok, label, sub }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', borderRadius: 12,
      background: ok ? 'rgba(95,201,122,0.08)' : 'rgba(212,163,51,0.1)',
      border: `1px solid ${ok ? 'rgba(95,201,122,0.32)' : 'rgba(212,163,51,0.4)'}` }}>
      <span style={{ width: 26, height: 26, borderRadius: 999, display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', background: ok ? GREEN : C.GOLD_HI, color: '#0a0a0b', fontWeight: 800,
        fontSize: 14, flexShrink: 0 }}>
        {ok ? '✓' : '!'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.INK, fontWeight: 600, fontSize: 14 }}>{label}</div>
        {sub && <div style={{ color: C.INK_DIM, fontSize: 12, marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}

const primaryBtn = {
  padding: '14px 20px',
  borderRadius: 12,
  background: `linear-gradient(180deg, ${C.GOLD_HI}, ${C.GOLD})`,
  color: '#0a0a0b',
  border: 0,
  fontWeight: 800,
  fontSize: 15,
  cursor: 'pointer',
  width: '100%',
  textDecoration: 'none',
  textAlign: 'center',
  display: 'block',
  boxShadow: '0 10px 30px rgba(212,163,51,0.25)',
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'America/New_York' })
  } catch { return iso }
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr); const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

function formatDateTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })
  } catch { return iso }
}
