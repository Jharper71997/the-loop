'use client'

import { useEffect, useRef, useState } from 'react'
import EnableNotifications from '../../_components/EnableNotifications'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const INK_MUTED = '#8a8a90'
const BG = '#0a0a0b'
const SURFACE = '#15151a'
const LINE = 'rgba(255,255,255,0.08)'
const GREEN = '#6fbf7f'

export default function TicketView({
  code,
  qrDataUrl,
  ticketUrl,
  riderName,
  eventName,
  eventDate,
  pickupTime,
  isPaid,
  isVoided,
  waiverSigned,
  contactId,
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
          if (cancelled) {
            wl.release()
            return
          }
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
      if (document.visibilityState === 'visible' && !wakeLockRef.current) {
        acquireWake()
      }
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
    const text = `${riderName} — Brew Loop ticket\n${ticketUrl}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Brew Loop ticket', text, url: ticketUrl })
      } catch {}
    } else if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(ticketUrl)
        alert('Ticket link copied')
      } catch {}
    }
  }

  const dateLabel = formatDate(eventDate)
  const timeLabel = formatTime(pickupTime)
  const checkedIn = !!checkedInAt

  if (isVoided) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: BG,
          color: INK,
          padding: '24px 16px 48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 36 }}>×</div>
          <h1 style={{ color: INK, fontSize: 22, fontWeight: 700, margin: 0 }}>
            This ticket has been voided
          </h1>
          <p style={{ color: INK_DIM, fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            It&apos;s no longer valid for boarding. If you think this was a mistake, text us at{' '}
            <a href="sms:+16362661801" style={{ color: GOLD, textDecoration: 'none' }}>
              (636) 266-1801
            </a>
            .
          </p>
          <a href="/events" style={primaryBtn}>Browse upcoming Loops</a>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: BG,
        color: INK,
        padding: '24px 16px 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ maxWidth: 460, width: '100%', display: 'grid', gap: 18 }}>
        <header style={{ textAlign: 'center', paddingTop: 8 }}>
          <div
            style={{
              color: GOLD,
              fontSize: 11,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}
          >
            Brew Loop · Boarding pass
          </div>
          <h1 style={{ color: INK, fontSize: 22, fontWeight: 700, margin: '6px 0 0' }}>
            {riderName}
          </h1>
          <div style={{ color: INK_DIM, fontSize: 14, marginTop: 4 }}>
            {eventName}
            {dateLabel ? ` · ${dateLabel}` : ''}
            {timeLabel ? ` · ${timeLabel}` : ''}
          </div>
        </header>

        {/* QR card — white background so the camera reads it cleanly even at
            low brightness. */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 22,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxShadow: '0 30px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(212,163,51,0.4)',
          }}
        >
          <img
            src={qrDataUrl}
            alt="Ticket QR code"
            style={{ width: '100%', maxWidth: 320, height: 'auto', display: 'block' }}
          />
          <div
            style={{
              marginTop: 10,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12,
              letterSpacing: '0.2em',
              color: '#3a3a44',
              textTransform: 'uppercase',
            }}
          >
            {code}
          </div>
        </div>

        {/* Status row: paid + checked-in + waiver. */}
        <div style={{ display: 'grid', gap: 10 }}>
          <StatusPill
            ok={isPaid}
            label={isPaid ? 'Paid' : 'Payment pending'}
            sub={isPaid ? 'Your seat is locked in.' : 'Once payment clears this ticket goes green.'}
          />
          <StatusPill
            ok={waiverSigned}
            label={waiverSigned ? 'Waiver signed' : 'Waiver not signed'}
            sub={
              waiverSigned
                ? 'Nothing else needed before pickup.'
                : 'Sign before you board. 30 seconds.'
            }
            cta={
              !waiverSigned && contactId
                ? { href: `/waiver/${contactId}`, label: 'Sign now' }
                : null
            }
          />
          {checkedIn && (
            <StatusPill
              ok={true}
              label="Checked in"
              sub={`Scanned at ${formatDateTime(checkedInAt)}`}
            />
          )}
        </div>

        {/* Action row */}
        <div style={{ display: 'grid', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={onShare}
            style={primaryBtn}
          >
            {shareSupported ? 'Share with rider' : 'Copy ticket link'}
          </button>
        </div>

        <EnableNotifications contactId={contactId} />

        {brightHint && (
          <p style={{ color: INK_MUTED, fontSize: 12, textAlign: 'center', margin: 0 }}>
            Tip: turn your screen brightness up before scanning.
          </p>
        )}

        <p style={{ color: INK_MUTED, fontSize: 12, textAlign: 'center', margin: '4px 0 0' }}>
          Show this screen to security at the bar door.
        </p>
      </div>
    </div>
  )
}

function StatusPill({ ok, label, sub, cta }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '12px 14px',
        borderRadius: 12,
        background: ok ? 'rgba(111,191,127,0.08)' : 'rgba(212,163,51,0.1)',
        border: `1px solid ${ok ? 'rgba(111,191,127,0.32)' : 'rgba(212,163,51,0.4)'}`,
      }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 999,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: ok ? GREEN : GOLD_HI,
          color: '#0a0a0b',
          fontWeight: 800,
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        {ok ? '✓' : '!'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: INK, fontWeight: 600, fontSize: 14 }}>{label}</div>
        {sub && (
          <div style={{ color: INK_DIM, fontSize: 12, marginTop: 2 }}>{sub}</div>
        )}
      </div>
      {cta && (
        <a
          href={cta.href}
          style={{
            padding: '8px 14px',
            borderRadius: 10,
            background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
            color: '#0a0a0b',
            fontWeight: 700,
            fontSize: 13,
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          {cta.label}
        </a>
      )}
    </div>
  )
}

const primaryBtn = {
  padding: '14px 20px',
  borderRadius: 12,
  background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
  color: '#0a0a0b',
  border: 0,
  fontWeight: 700,
  fontSize: 15,
  cursor: 'pointer',
  width: '100%',
  boxShadow: '0 10px 30px rgba(212,163,51,0.25)',
}

const ghostBtn = {
  padding: '14px 20px',
  borderRadius: 12,
  background: SURFACE,
  color: INK,
  border: `1px solid ${LINE}`,
  fontWeight: 600,
  fontSize: 14,
  textDecoration: 'none',
  textAlign: 'center',
  display: 'block',
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch {
    return iso
  }
}

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

function formatDateTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Indiana/Indianapolis',
    })
  } catch {
    return iso
  }
}
