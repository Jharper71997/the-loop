'use client'

import { useEffect, useRef, useState } from 'react'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const BG = '#0a0a0b'
const SURFACE = '#15151a'
const LINE = 'rgba(255,255,255,0.08)'
const GREEN = '#6fbf7f'
const RED = '#e07a7a'

// Minimum distance between pings we actually POST. Stops us from hammering
// the API while parked waiting at a stop.
const MIN_POST_INTERVAL_MS = 8000
const MIN_DELTA_METERS = 5

export default function DriverClient() {
  const [running, setRunning] = useState(false)
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const [pingCount, setPingCount] = useState(0)
  const [lastPingAt, setLastPingAt] = useState(null)
  const [tickHack, setTickHack] = useState(0)

  const watchIdRef = useRef(null)
  const lastPostRef = useRef({ at: 0, lat: null, lng: null })
  const wakeLockRef = useRef(null)

  useEffect(() => {
    // Re-render every second so "x seconds ago" stays fresh.
    const t = setInterval(() => setTickHack(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    return () => stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function start() {
    setError(null)
    if (!navigator.geolocation) {
      setError('This device doesn\'t expose geolocation.')
      return
    }

    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      }
    } catch {}

    const id = navigator.geolocation.watchPosition(onPosition, onGeoError, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 30000,
    })
    watchIdRef.current = id
    setRunning(true)
  }

  async function stop() {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (wakeLockRef.current) {
      try { wakeLockRef.current.release() } catch {}
      wakeLockRef.current = null
    }

    // Send a final "off duty" ping so /track fades the marker.
    if (position) {
      try {
        await fetch('/api/shuttle/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat: position.lat,
            lng: position.lng,
            speed: position.speed,
            heading: position.heading,
            is_active: false,
          }),
        })
      } catch {}
    }

    setRunning(false)
  }

  async function onPosition(pos) {
    const lat = pos.coords.latitude
    const lng = pos.coords.longitude
    const speedMps = pos.coords.speed
    const heading = pos.coords.heading
    const speedMph = Number.isFinite(speedMps) ? speedMps * 2.23694 : null

    setPosition({ lat, lng, speed: speedMph, heading })

    const now = Date.now()
    const since = now - lastPostRef.current.at
    const deltaM = haversine(
      lastPostRef.current.lat, lastPostRef.current.lng,
      lat, lng
    )
    if (since < MIN_POST_INTERVAL_MS && deltaM < MIN_DELTA_METERS) return

    try {
      const res = await fetch('/api/shuttle/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat, lng, speed: speedMph, heading, is_active: true,
        }),
      })
      if (res.ok) {
        lastPostRef.current = { at: now, lat, lng }
        setPingCount(n => n + 1)
        setLastPingAt(now)
        setError(null)
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body.reason || `Ping rejected (${res.status})`)
      }
    } catch (err) {
      setError(`Ping failed: ${err?.message || 'network'}`)
    }
  }

  function onGeoError(err) {
    setError(err?.message || 'Location unavailable. Allow location access in browser settings.')
  }

  const ageSec = lastPingAt ? Math.floor((Date.now() - lastPingAt) / 1000) : null

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: BG,
        color: INK,
        padding: '20px 16px 32px',
      }}
    >
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'grid', gap: 16 }}>
        <header>
          <div style={{
            color: GOLD,
            fontSize: 11,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 700,
          }}>
            Brew Loop · Driver
          </div>
          <h1 style={{ color: INK, fontSize: 26, fontWeight: 800, margin: '4px 0 0' }}>
            {running ? 'Live' : 'Off duty'}
          </h1>
        </header>

        <div
          style={{
            padding: '24px 22px',
            borderRadius: 18,
            background: running ? 'rgba(111,191,127,0.10)' : SURFACE,
            border: `1.5px solid ${running ? 'rgba(111,191,127,0.45)' : LINE}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <span
              style={{
                width: 14, height: 14, borderRadius: '50%',
                background: running ? GREEN : '#3a3a44',
                boxShadow: running ? '0 0 14px rgba(111,191,127,0.7)' : 'none',
              }}
            />
            <div>
              <div style={{ color: INK, fontSize: 16, fontWeight: 700 }}>
                {running ? 'Pinging /track' : 'Shuttle is off duty'}
              </div>
              <div style={{ color: INK_DIM, fontSize: 12 }}>
                {running
                  ? `${pingCount} ping${pingCount === 1 ? '' : 's'} sent · last ${ageSec != null ? `${ageSec}s ago` : 'pending'}`
                  : 'Tap Start to share live position with riders.'}
              </div>
            </div>
          </div>

          {position && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <Stat label="Lat" value={position.lat?.toFixed(5)} />
              <Stat label="Lng" value={position.lng?.toFixed(5)} />
              <Stat label="Speed" value={position.speed != null ? `${position.speed.toFixed(0)} mph` : '—'} />
              <Stat label="Heading" value={position.heading != null ? `${Math.round(position.heading)}°` : '—'} />
            </div>
          )}

          {error && (
            <div style={{
              color: RED, fontSize: 12, padding: '8px 12px',
              background: 'rgba(224,122,122,0.08)', borderRadius: 8, marginBottom: 12,
            }}>
              {error}
            </div>
          )}

          {running ? (
            <button
              type="button"
              onClick={stop}
              style={{ ...primaryBtn, background: 'transparent', color: INK, border: `1.5px solid ${RED}` }}
            >
              End route
            </button>
          ) : (
            <button type="button" onClick={start} style={primaryBtn}>
              Start route
            </button>
          )}
        </div>

        <p style={{ color: INK_DIM, fontSize: 12, textAlign: 'center', margin: 0 }}>
          Keep this screen on while driving. Riders see your position on /track.
        </p>
      </div>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${LINE}`,
      }}
    >
      <div style={{ color: INK_DIM, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ color: INK, fontSize: 16, fontWeight: 700, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  )
}

const primaryBtn = {
  padding: '16px 22px',
  borderRadius: 12,
  background: `linear-gradient(180deg, ${GOLD_HI}, ${GOLD})`,
  color: '#0a0a0b',
  border: 0,
  fontWeight: 800,
  fontSize: 16,
  cursor: 'pointer',
  width: '100%',
  boxShadow: '0 10px 30px rgba(212,163,51,0.25)',
}

// Haversine distance in meters between two lat/lng pairs.
function haversine(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return Infinity
  const R = 6371000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
