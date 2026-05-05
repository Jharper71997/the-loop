'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

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

// Fallback center if we have no position and no stops (Jacksonville NC).
const JACKSONVILLE_NC = { lat: 34.7541, lng: -77.4302 }

export default function DriverClient({ groupId = null, loopName = null, eventDate = null, pickupTime = null, stops = [] }) {
  const [running, setRunning] = useState(false)
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const [pingCount, setPingCount] = useState(0)
  const [lastPingAt, setLastPingAt] = useState(null)
  const [tickHack, setTickHack] = useState(0)

  const watchIdRef = useRef(null)
  const lastPostRef = useRef({ at: 0, lat: null, lng: null })
  const wakeLockRef = useRef(null)

  // Leaflet map state. Booted once on mount; the driver marker + center
  // updates each time `position` changes.
  const mapContainerRef = useRef(null)
  const mapStateRef = useRef({ map: null, L: null, driverMarker: null, didFollow: false })
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    // Re-render every second so "x seconds ago" stays fresh.
    const t = setInterval(() => setTickHack(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Boot the Leaflet map once. Same tile + style choices as /track so the
  // driver and rider views feel like the same map.
  useEffect(() => {
    let cancelled = false
    let map

    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapContainerRef.current) return

      const fitTargets = stops
        .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
        .map(s => [s.lat, s.lng])

      map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
      }).setView(
        fitTargets[0] || [JACKSONVILLE_NC.lat, JACKSONVILLE_NC.lng],
        13,
      )

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      L.control.attribution({ prefix: false })
        .addAttribution('&copy; OpenStreetMap')
        .addTo(map)

      // Numbered gold pins for tonight's stops, same look as /track.
      stops
        .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
        .forEach(s => {
          const icon = L.divIcon({
            className: 'jbl-stop-pin',
            html: stopPinHtml(s.index + 1),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          })
          L.marker([s.lat, s.lng], { icon })
            .bindPopup(`<strong>${escapeHtml(s.name)}</strong>${s.startTime ? `<br/>${escapeHtml(formatPickup(s.startTime))}` : ''}`)
            .addTo(map)
        })

      if (fitTargets.length > 1) {
        map.fitBounds(fitTargets, { padding: [40, 40] })
      }

      mapStateRef.current = { map, L, driverMarker: null, didFollow: false }
      setMapReady(true)
    })()

    return () => {
      cancelled = true
      if (map) map.remove()
      mapStateRef.current = { map: null, L: null, driverMarker: null, didFollow: false }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync driver marker with the live position. First fix recenters the map;
  // subsequent updates just move the marker so the driver can pan around
  // without us yanking the view back every couple seconds.
  useEffect(() => {
    const { map, L } = mapStateRef.current
    if (!map || !L || !mapReady || !position) return

    const latlng = [position.lat, position.lng]
    if (!mapStateRef.current.driverMarker) {
      const icon = L.divIcon({
        className: 'jbl-driver-icon',
        html: driverIconHtml(),
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      })
      mapStateRef.current.driverMarker = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(map)
    } else {
      mapStateRef.current.driverMarker.setLatLng(latlng)
    }

    if (!mapStateRef.current.didFollow) {
      map.setView(latlng, Math.max(map.getZoom(), 15), { animate: true })
      mapStateRef.current.didFollow = true
    }
  }, [position, mapReady])

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

    // Send a final "off duty" ping so the dispatch view fades the marker.
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
            group_id: groupId,
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
          lat, lng, speed: speedMph, heading, group_id: groupId, is_active: true,
        }),
      })
      if (res.ok) {
        lastPostRef.current = { at: now, lat, lng }
        setPingCount(n => n + 1)
        setLastPingAt(now)
        setError(null)
      } else {
        const body = await res.json().catch(() => ({}))
        const reason = body.reason || `Ping rejected (${res.status})`
        setError(body.detail ? `${reason}: ${body.detail}` : reason)
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
          {loopName && (
            <div style={{ color: INK_DIM, fontSize: 13, marginTop: 4 }}>
              {loopName}
              {eventDate ? ` · ${formatLoopDate(eventDate)}` : ''}
              {pickupTime ? ` · ${formatPickup(pickupTime)} pickup` : ''}
            </div>
          )}
          {!groupId && (
            <div style={{ color: '#e07a7a', fontSize: 12, marginTop: 6 }}>
              No on-sale Loop scheduled. Pings will save without a group link.
            </div>
          )}
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
                {running ? 'Sharing position' : 'Shuttle is off duty'}
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

          {position && stops.length > 0 && <NextStopCard position={position} stops={stops} eventDate={eventDate} />}

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

        {/* Live map — driver's own marker + tonight's stop pins. Same Leaflet
            base as the public /track view so the two feel like one map. */}
        <div
          ref={mapContainerRef}
          style={{
            width: '100%',
            aspectRatio: '4/3',
            maxHeight: '55dvh',
            minHeight: 280,
            borderRadius: 16,
            overflow: 'hidden',
            background: '#0d0d10',
            border: `1px solid ${LINE}`,
          }}
        />

        <p style={{ color: INK_DIM, fontSize: 12, textAlign: 'center', margin: 0 }}>
          Keep this screen on while driving. Position is shared with the dispatch view.
        </p>
      </div>

      <style>{`
        .jbl-stop-pin > div { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .leaflet-container { background: #0d0d10; }
        .leaflet-popup-content-wrapper {
          background: #15151a; color: #f5f5f7;
          border: 1px solid rgba(255,255,255,0.08); border-radius: 10px;
        }
        .leaflet-popup-tip { background: #15151a; }
        .leaflet-control-attribution {
          background: rgba(10,10,11,0.6) !important; color: #9c9ca3 !important;
        }
        .leaflet-control-attribution a { color: ${GOLD} !important; }
      `}</style>
    </div>
  )
}

function stopPinHtml(n) {
  return `
    <div style="
      width:28px;height:28px;border-radius:50%;
      background:#15151a;border:2px solid ${GOLD};
      color:${GOLD_HI};font-size:12px;font-weight:800;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 14px rgba(0,0,0,0.55);
    ">${n}</div>
  `
}

function driverIconHtml() {
  return `
    <div style="
      width:44px;height:44px;border-radius:50%;
      background: radial-gradient(circle at 35% 30%, rgba(240,194,74,0.95), rgba(212,163,51,0.85));
      border:2px solid #0a0a0b;
      box-shadow:0 0 0 4px rgba(212,163,51,0.35), 0 8px 22px rgba(0,0,0,0.5);
      background-image: url('/brand/badge-black.png');
      background-size: contain; background-position: center; background-repeat: no-repeat;
      animation: jbl-driver-pulse 1.8s ease-in-out infinite;
    "></div>
    <style>
      @keyframes jbl-driver-pulse {
        0%,100% { box-shadow: 0 0 0 4px rgba(212,163,51,0.35), 0 8px 22px rgba(0,0,0,0.5); }
        50%     { box-shadow: 0 0 0 10px rgba(212,163,51,0.05), 0 8px 22px rgba(0,0,0,0.5); }
      }
    </style>
  `
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c])
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

function formatLoopDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch { return iso }
}

function formatPickup(hhmm) {
  if (!hhmm) return ''
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr); const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
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

// Schedule-order destination: target stop 1 first, then 2, then 3, etc.
// Picks the first stop whose start_time is still in the future. Off days
// (testing) fall back to stop 1 so the card always has something useful.
function pickNextStopByOrder(stops, now, eventDate) {
  const placed = stops.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
  if (!placed.length) return null

  if (eventDate) {
    const today = todayLocalISO(now)
    if (eventDate !== today) return placed[0]
  }

  const withTimes = placed.filter(s => s.startTime)
  if (!withTimes.length) return placed[0]

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const upcoming = withTimes.find(s => {
    const [h, m] = String(s.startTime).split(':').map(Number)
    if (!Number.isFinite(h) || !Number.isFinite(m)) return false
    return (h * 60 + m) > nowMin
  })
  return upcoming || placed[placed.length - 1]
}

function todayLocalISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function NextStopCard({ position, stops, eventDate }) {
  const dest = pickNextStopByOrder(stops, new Date(), eventDate)
  if (!dest) return null

  const meters = haversine(position.lat, position.lng, dest.lat, dest.lng)
  const distanceMi = meters / 1609.344
  const arrived = meters < 60
  const actualSpeed = Number(position.speed)
  const moving = Number.isFinite(actualSpeed) && actualSpeed > 5
  // Fall back to a 25 mph city-driving assumption when the device isn't
  // reporting speed (parked at a stop, or stationary during testing) so the
  // card always shows a useful "X min away" instead of going blank.
  const speedForEta = moving ? actualSpeed : 25
  const etaMin = arrived ? null : Math.max(1, Math.round((distanceMi / speedForEta) * 60))
  const etaIsEstimate = !arrived && !moving

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        background: 'linear-gradient(180deg, rgba(212,163,51,0.14), rgba(212,163,51,0.05))',
        border: `1px solid rgba(212,163,51,0.45)`,
        borderRadius: 12,
        marginBottom: 14,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'rgba(212,163,51,0.18)',
          border: `1px solid ${GOLD}`,
          color: GOLD_HI,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, fontWeight: 800,
          flex: '0 0 auto',
        }}
      >
        →
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: GOLD, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
          {arrived ? 'At stop' : `Next stop · #${dest.index + 1}`}
        </div>
        <div style={{ color: INK, fontSize: 16, fontWeight: 800, marginTop: 2, lineHeight: 1.15 }}>
          {dest.name}
        </div>
        {dest.startTime && (
          <div style={{ color: INK_DIM, fontSize: 12, marginTop: 2 }}>
            Scheduled {formatPickup(dest.startTime)}
          </div>
        )}
      </div>
      <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
        {arrived ? (
          <div style={{ color: GOLD_HI, fontSize: 13, fontWeight: 800 }}>Arrived</div>
        ) : (
          <>
            <div style={{ color: INK_DIM, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
              {etaIsEstimate ? 'ETA · est' : 'ETA'}
            </div>
            <div style={{ color: INK, fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {etaMin} min
            </div>
            <div style={{ color: INK_DIM, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginTop: 4 }}>Distance</div>
            <div style={{ color: INK, fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {distanceMi < 0.1 ? `${Math.round(meters * 3.28084)} ft` : `${distanceMi.toFixed(1)} mi`}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
