'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import EnableNotifications from '../../_components/EnableNotifications'
import SecurityChat from '../../_components/SecurityChat'
import { GOLD, GOLD_HI, INK, INK_DIM, INK_MUTE as INK_MUTED } from '@/lib/marketingTheme'
import { grainOverlay, lightPool, litCard, litCardInner } from '@/lib/atmosphere'

// The boarding pass.
//
// This was the last rider-facing page still running its own private palette
// and flat #0a0a0b rectangles, months after the rest of the site moved to
// marketingTheme + atmosphere — so the one page a rider stares at while
// standing outside a bar was also the one that looked least like the company.
// It now uses the same tokens, the same lit plates and the same grain as
// everything else.
//
// It was also missing the route. The page already loaded groups.schedule to
// find the pickup stop and discarded the rest, so a paying rider could not see
// which bars the night hits. That list is the second thing on the page now,
// under the pickup and above the QR.

const BG = '#0a0a0b'
const GREEN = '#6fbf7f'

export default function TicketView({
  code,
  qrDataUrl,
  ticketUrl,
  riderName,
  eventName,
  brand = 'Brew Loop',
  eventsHref = '/events',
  eventDate,
  pickupTime,
  pickupSpot,
  stops = [],
  barsHref = '/bars',
  trackHref = '/track',
  isPaid,
  isVoided,
  waiverSigned,
  contactId,
  checkedInAt,
  supportPhone = '+16362661801',
  supportPhoneDisplay = '(636) 266-1801',
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
    const text = `${riderName} — ${brand} ticket\n${ticketUrl}`
    if (navigator.share) {
      try {
        await navigator.share({ title: `${brand} ticket`, text, url: ticketUrl })
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
            <a href={`sms:${supportPhone}`} style={{ color: GOLD, textDecoration: 'none' }}>
              {supportPhoneDisplay}
            </a>
            .
          </p>
          <a href={eventsHref} style={primaryBtn}>Browse upcoming Loops</a>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: '100dvh',
        background: BG,
        color: INK,
        padding: '24px 16px 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Same depth treatment as the rest of the site. Both layers are inert
          and sit under the content, so nothing here can intercept the tap that
          shares a ticket or the scan of the QR. */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: lightPool('top', 0.16), pointerEvents: 'none' }} />
      <div aria-hidden style={{ ...grainOverlay, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', maxWidth: 460, width: '100%', display: 'grid', gap: 18 }}>
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
            {brand} · Boarding pass
          </div>
          <h1 style={{ color: INK, fontSize: 22, fontWeight: 700, margin: '6px 0 0' }}>
            {riderName}
          </h1>
          <div style={{ color: INK_DIM, fontSize: 14, marginTop: 4 }}>
            {eventName}
            {dateLabel ? ` · ${dateLabel}` : ''}
          </div>
        </header>

        {/* Pickup card — what riders need to know FIRST: where to be and when. */}
        {(pickupSpot || timeLabel) && (
          <div
            style={{
              background: 'rgba(212,163,51,0.08)',
              border: `1px solid rgba(212,163,51,0.35)`,
              borderRadius: 14,
              padding: '14px 16px',
              display: 'grid',
              gap: 4,
            }}
          >
            <div
              style={{
                color: GOLD,
                fontSize: 11,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
            >
              Pickup
            </div>
            <div style={{ color: INK, fontSize: 18, fontWeight: 700 }}>
              {pickupSpot || 'Location TBA'}
            </div>
            {timeLabel && (
              <div style={{ color: INK_DIM, fontSize: 14 }}>
                {timeLabel}{dateLabel ? ` · ${dateLabel}` : ''}
              </div>
            )}
          </div>
        )}

        {/* The route. A rider with a ticket already knows they're going out —
            what they don't know is where. Times are the scheduled ARRIVAL at
            each stop; the route rotates weekend to weekend, so this is the
            night's own schedule and never the static bar directory. */}
        {stops.length > 0 && (
          <div style={litCard({ radius: 16 })}>
            <div style={litCardInner({ radius: 15, pad: 0 })}>
              <div style={{ padding: '14px 16px 10px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ color: GOLD, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
                  Tonight&apos;s route
                </span>
                <Link href={trackHref} style={{ color: INK_DIM, fontSize: 12, textDecoration: 'none' }}>
                  Track the shuttle &rarr;
                </Link>
              </div>

              <ol style={{ listStyle: 'none', margin: 0, padding: '0 16px 6px' }}>
                {stops.map(stop => {
                  const label = (
                    <>
                      <span style={{ color: INK, fontSize: 15, fontWeight: stop.isPickup ? 700 : 600 }}>
                        {stop.name}
                      </span>
                      {stop.isPickup && (
                        <span style={{ color: GOLD, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, marginLeft: 8 }}>
                          Your pickup
                        </span>
                      )}
                    </>
                  )
                  return (
                    <li key={`${stop.order}-${stop.name}`} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '9px 0' }}>
                      <span aria-hidden style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, alignSelf: 'stretch' }}>
                        <span style={{
                          width: 9, height: 9, borderRadius: 999, marginTop: 6,
                          background: stop.isPickup ? GOLD : 'transparent',
                          border: `1.5px solid ${stop.isPickup ? GOLD : 'rgba(255,255,255,0.28)'}`,
                        }} />
                        {stop.order < stops.length - 1 && (
                          <span style={{ flex: 1, width: 1.5, minHeight: 14, background: 'rgba(255,255,255,0.12)', marginTop: 3 }} />
                        )}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        {stop.slug
                          ? <Link href={`${barsHref}/${stop.slug}`} style={{ textDecoration: 'none' }}>{label}</Link>
                          : label}
                      </span>
                      {stop.time && (
                        <span style={{ color: INK_DIM, fontSize: 13, whiteSpace: 'nowrap', marginTop: 1 }}>
                          {formatTime(stop.time)}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ol>

              <p style={{ color: INK_MUTED, fontSize: 12, lineHeight: 1.5, margin: 0, padding: '4px 16px 14px' }}>
                About an hour and 15 minutes at each stop. You&apos;ll get a text roughly 10 minutes
                before the shuttle leaves. The Loop brings you back to where you were picked up.
              </p>
            </div>
          </div>
        )}

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

        {isPaid && contactId && <SecurityChat code={code} />}

        {brightHint && (
          <p style={{ color: INK_MUTED, fontSize: 12, textAlign: 'center', margin: 0 }}>
            Tip: turn your screen brightness up before scanning.
          </p>
        )}

        <p style={{ color: INK_MUTED, fontSize: 12, textAlign: 'center', margin: '4px 0 0' }}>
          Show this screen to the driver when you board the shuttle.
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
