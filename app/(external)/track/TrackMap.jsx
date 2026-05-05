'use client'

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'

const GOLD = '#d4a333'
const GOLD_HI = '#f0c24a'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const SURFACE = '#15151a'
const LINE = 'rgba(255,255,255,0.08)'

export default function TrackMap({ stops = [], fallbackCenter }) {
  const containerRef = useRef(null)
  const stateRef = useRef({ map: null, L: null, shuttleMarker: null, stopMarkers: [] })
  const [shuttle, setShuttle] = useState(null)
  const [lastSeenAt, setLastSeenAt] = useState(null)
  const [mapReady, setMapReady] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Boot the map once.
  useEffect(() => {
    let cancelled = false
    let map

    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current) return

      const fitTargets = stops
        .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
        .map(s => [s.lat, s.lng])

      map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
      }).setView(
        fitTargets[0] || [fallbackCenter.lat, fallbackCenter.lng],
        13,
      )

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
      }).addTo(map)

      L.control.attribution({ prefix: false })
        .addAttribution('&copy; OpenStreetMap')
        .addTo(map)

      // Stop pins for any bars with known coords.
      const stopMarkers = stops
        .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
        .map(s => {
          const icon = L.divIcon({
            className: 'jbl-stop-pin',
            html: stopPinHtml(s.index + 1),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          })
          return L.marker([s.lat, s.lng], { icon })
            .bindPopup(`<strong>${escapeHtml(s.name)}</strong>${s.startTime ? `<br/>${escapeHtml(formatTime(s.startTime))}` : ''}`)
            .addTo(map)
        })

      if (fitTargets.length > 1) {
        map.fitBounds(fitTargets, { padding: [40, 40] })
      }

      stateRef.current = { map, L, shuttleMarker: null, stopMarkers }
      setMapReady(true)
    })()

    return () => {
      cancelled = true
      if (map) map.remove()
      stateRef.current = { map: null, L: null, shuttleMarker: null, stopMarkers: [] }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll the shuttle position.
  useEffect(() => {
    let cancelled = false
    let timer

    async function poll() {
      try {
        const res = await fetch('/api/shuttle/current', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        setShuttle(json?.shuttle || null)
        if (json?.last_seen_at) setLastSeenAt(json.last_seen_at)
        else if (json?.shuttle?.recorded_at) setLastSeenAt(json.shuttle.recorded_at)
      } catch {}
    }

    poll()
    timer = setInterval(poll, 10_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  // Drop / update the shuttle marker as positions come in.
  useEffect(() => {
    const { map, L } = stateRef.current
    if (!map || !L || !mapReady) return

    if (!shuttle) {
      if (stateRef.current.shuttleMarker) {
        stateRef.current.shuttleMarker.remove()
        stateRef.current.shuttleMarker = null
      }
      return
    }

    const latlng = [shuttle.lat, shuttle.lng]
    if (!stateRef.current.shuttleMarker) {
      const icon = L.divIcon({
        className: 'jbl-shuttle-icon',
        html: shuttleIconHtml(),
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      })
      stateRef.current.shuttleMarker = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(map)
      map.setView(latlng, Math.max(map.getZoom(), 14), { animate: true })
    } else {
      stateRef.current.shuttleMarker.setLatLng(latlng)
    }
  }, [shuttle, mapReady])

  return (
    <>
      <div
        ref={containerRef}
        style={{
          width: '100%',
          aspectRatio: '4/3',
          maxHeight: '60dvh',
          minHeight: 280,
          borderRadius: 16,
          overflow: 'hidden',
          background: '#0d0d10',
          border: `1px solid ${LINE}`,
        }}
      />

      <StatusRow shuttle={shuttle} lastSeenAt={lastSeenAt} now={now} stops={stops} />

      {stops.length > 0 && (
        <section
          style={{
            background: SURFACE,
            border: `1px solid ${LINE}`,
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${LINE}` }}>
            <div style={{ color: GOLD, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
              Tonight&rsquo;s stops
            </div>
          </div>
          <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {stops.map(s => (
              <li
                key={s.index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderTop: s.index === 0 ? 'none' : `1px solid ${LINE}`,
                }}
              >
                <span
                  style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'rgba(212,163,51,0.12)',
                    border: `1px solid rgba(212,163,51,0.4)`,
                    color: GOLD_HI,
                    fontSize: 12, fontWeight: 800,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    flex: '0 0 auto',
                  }}
                >
                  {s.index + 1}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: INK, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </div>
                  {s.startTime && (
                    <div style={{ color: INK_DIM, fontSize: 12 }}>{formatTime(s.startTime)}</div>
                  )}
                </div>
                {s.lat == null && (
                  <span style={{ color: INK_DIM, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    No pin
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}

      <style>{`
        .jbl-stop-pin > div { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .leaflet-container { background: #0d0d10; }
        .leaflet-popup-content-wrapper {
          background: #15151a;
          color: #f5f5f7;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
        }
        .leaflet-popup-tip { background: #15151a; }
        .leaflet-control-attribution {
          background: rgba(10,10,11,0.6) !important;
          color: #9c9ca3 !important;
        }
        .leaflet-control-attribution a { color: ${GOLD} !important; }
      `}</style>
    </>
  )
}

function StatusRow({ shuttle, lastSeenAt, now, stops = [] }) {
  const live = !!shuttle?.is_active
  const ageMin = lastSeenAt ? Math.floor((now - new Date(lastSeenAt).getTime()) / 60000) : null

  // Google-Maps-style "next destination" card: pick the stop the shuttle is
  // headed toward and show ETA + distance based on the shuttle's current
  // position + speed.
  const dest = live ? pickNextDestination(shuttle, stops) : null
  const eta = dest ? computeEta(shuttle, dest) : null

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: live ? 'rgba(212,163,51,0.08)' : SURFACE,
          border: `1px solid ${live ? 'rgba(212,163,51,0.35)' : LINE}`,
          borderRadius: 12,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 10, height: 10, borderRadius: '50%',
            background: live ? GOLD : '#3a3a44',
            boxShadow: live ? `0 0 12px ${GOLD}` : 'none',
            flex: '0 0 auto',
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: live ? GOLD_HI : INK, fontSize: 13, fontWeight: 700 }}>
            {live ? 'Shuttle live' : 'Shuttle off duty'}
          </div>
          <div style={{ color: INK_DIM, fontSize: 12 }}>
            {live
              ? `Updated ${ageMin != null && ageMin > 0 ? `${ageMin} min ago` : 'just now'}`
              : (lastSeenAt
                  ? `Last ping ${ageMin != null ? `${ageMin} min ago` : 'recently'}`
                  : 'Pings appear here once the driver goes live.')}
          </div>
        </div>
        {live && shuttle?.speed_mph != null && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: INK_DIM, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
              Speed
            </div>
            <div style={{ color: INK, fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(shuttle.speed_mph)} mph
            </div>
          </div>
        )}
      </div>

      {dest && eta && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 14px',
            background: 'linear-gradient(180deg, rgba(212,163,51,0.14), rgba(212,163,51,0.05))',
            border: `1px solid rgba(212,163,51,0.45)`,
            borderRadius: 12,
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
              {eta.status === 'arrived' ? 'At stop' : 'Next stop'}
            </div>
            <div style={{ color: INK, fontSize: 16, fontWeight: 800, marginTop: 2, lineHeight: 1.15 }}>
              {dest.name}
            </div>
          </div>
          <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
            {eta.status === 'arrived' ? (
              <div style={{ color: GOLD_HI, fontSize: 13, fontWeight: 800 }}>Arrived</div>
            ) : (
              <>
                {eta.status === 'enroute' && (
                  <>
                    <div style={{ color: INK_DIM, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>ETA</div>
                    <div style={{ color: INK, fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                      {eta.etaMin} min
                    </div>
                  </>
                )}
                <div style={{ color: INK_DIM, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700, marginTop: eta.status === 'enroute' ? 4 : 0 }}>Distance</div>
                <div style={{ color: INK, fontSize: eta.status === 'enroute' ? 13 : 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
                  {formatDistance(eta.distanceMi, eta.distanceMeters)}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Pick the stop the shuttle is heading toward. Heuristic: nearest stop with
// real coords; if shuttle is within 60m of that stop (considered "at" it),
// jump to the next stop in schedule order so the card always shows the
// upcoming destination, not the one we just arrived at.
function pickNextDestination(shuttle, stops) {
  if (!shuttle || !Array.isArray(stops) || stops.length === 0) return null
  const placed = stops.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
  if (!placed.length) return null

  let nearest = null
  let nearestMeters = Infinity
  for (const s of placed) {
    const m = haversineMeters(shuttle.lat, shuttle.lng, s.lat, s.lng)
    if (m < nearestMeters) { nearest = s; nearestMeters = m }
  }
  if (!nearest) return null

  if (nearestMeters < 60) {
    // Shuttle is at this stop. Return the next-by-index placed stop instead,
    // unless this is already the last one.
    const after = placed.find(s => s.index > nearest.index)
    return after || nearest
  }
  return nearest
}

function computeEta(shuttle, dest) {
  const meters = haversineMeters(shuttle.lat, shuttle.lng, dest.lat, dest.lng)
  const distanceMi = meters / 1609.344
  const speed = Number(shuttle.speed_mph)
  const moving = Number.isFinite(speed) && speed > 5

  if (meters < 60) return { status: 'arrived', distanceMi, distanceMeters: meters, etaMin: 0 }
  if (!moving) return { status: 'stopped', distanceMi, distanceMeters: meters, etaMin: null }

  const etaMin = Math.max(1, Math.round((distanceMi / speed) * 60))
  return { status: 'enroute', distanceMi, distanceMeters: meters, etaMin }
}

function formatDistance(distanceMi, meters) {
  if (distanceMi < 0.1) return `${Math.round(meters * 3.28084)} ft`
  return `${distanceMi.toFixed(1)} mi`
}

// Haversine distance in meters between two lat/lng pairs.
function haversineMeters(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return Infinity
  const R = 6371000
  const toRad = d => d * Math.PI / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
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

function shuttleIconHtml() {
  return `
    <div style="
      width:44px;height:44px;border-radius:50%;
      background: radial-gradient(circle at 35% 30%, rgba(240,194,74,0.95), rgba(212,163,51,0.85));
      border:2px solid #0a0a0b;
      box-shadow:0 0 0 4px rgba(212,163,51,0.35), 0 8px 22px rgba(0,0,0,0.5);
      background-image: url('/brand/badge-black.png');
      background-size: contain;
      background-position: center;
      background-repeat: no-repeat;
      animation: jbl-shuttle-pulse 1.8s ease-in-out infinite;
    "></div>
    <style>
      @keyframes jbl-shuttle-pulse {
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

function formatTime(hhmm) {
  if (!hhmm) return ''
  const [hStr, mStr] = String(hhmm).split(':')
  const h = Number(hStr); const m = Number(mStr)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}
