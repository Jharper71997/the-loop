'use client'

// Live map for The Loop (Marines). Fork of the Brew Loop (external)/track
// TrackMap with three deltas: (1) it polls /api/shuttle/current scoped to its
// own group_id so it shows the Loop shuttle, never the Brew Loop bus; (2) it
// draws the red-line polyline connecting the stops in order; (3) red accent +
// a plain marker (no Brew Loop badge). ETA + StopList logic is unchanged.

import { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { haversineMeters } from '@/lib/geo'

const RED = '#e5484d'
const RED_HI = '#f2585d'
const INK = '#f5f5f7'
const INK_DIM = '#b8b8bf'
const SURFACE = '#1a2027'
const LINE = 'rgba(255,255,255,0.10)'

export default function LoopTrackMap({ stops = [], eventDate = null, groupId = null, fallbackCenter }) {
  const containerRef = useRef(null)
  const stateRef = useRef({ map: null, L: null, shuttleMarker: null, stopMarkers: [], line: null })
  const [shuttle, setShuttle] = useState(null)
  const [lastSeenAt, setLastSeenAt] = useState(null)
  const [nextStopHint, setNextStopHint] = useState(null)
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

      // The red line — connect the stops in route order. Drawn first so the
      // numbered stop pins sit on top of it.
      let line = null
      if (fitTargets.length > 1) {
        line = L.polyline(fitTargets, { color: RED, weight: 4, opacity: 0.85 }).addTo(map)
      }

      const stopMarkers = stops
        .filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
        .map(s => {
          const icon = L.divIcon({
            className: 'loop-stop-pin',
            html: stopPinHtml(s.index + 1, s.onBase),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          })
          return L.marker([s.lat, s.lng], { icon })
            .bindPopup(`<strong>${escapeHtml(s.name)}</strong>${s.onBase ? '<br/>On-base pickup' : ''}${s.startTime ? `<br/>${escapeHtml(formatTime(s.startTime))}` : ''}`)
            .addTo(map)
        })

      if (fitTargets.length > 1) {
        map.fitBounds(fitTargets, { padding: [40, 40] })
      }

      stateRef.current = { map, L, shuttleMarker: null, stopMarkers, line }
      setMapReady(true)
    })()

    return () => {
      cancelled = true
      if (map) map.remove()
      stateRef.current = { map: null, L: null, shuttleMarker: null, stopMarkers: [], line: null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Poll the shuttle position — scoped to THIS loop's group_id.
  useEffect(() => {
    let cancelled = false
    let timer
    const url = groupId
      ? `/api/shuttle/current?group_id=${encodeURIComponent(groupId)}`
      : '/api/shuttle/current'

    async function poll() {
      try {
        const res = await fetch(url, { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (cancelled) return
        setShuttle(json?.shuttle || null)
        setNextStopHint(json?.next_stop || null)
        if (json?.last_seen_at) setLastSeenAt(json.last_seen_at)
        else if (json?.shuttle?.recorded_at) setLastSeenAt(json.shuttle.recorded_at)
      } catch {}
    }

    poll()
    timer = setInterval(poll, 10_000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [groupId])

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
        className: 'loop-shuttle-icon',
        html: shuttleIconHtml(),
        iconSize: [40, 40],
        iconAnchor: [20, 20],
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

      <StatusRow shuttle={shuttle} lastSeenAt={lastSeenAt} now={now} stops={stops} eventDate={eventDate} nextStopHint={nextStopHint} />

      {stops.length > 0 && (
        <StopList stops={stops} shuttle={shuttle} eventDate={eventDate} now={now} nextStopHint={nextStopHint} />
      )}

      <style>{`
        .loop-stop-pin > div { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .leaflet-container { background: #0d0d10; }
        .leaflet-popup-content-wrapper {
          background: #1a2027;
          color: #f5f5f7;
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 10px;
        }
        .leaflet-popup-tip { background: #1a2027; }
        .leaflet-control-attribution {
          background: rgba(10,10,11,0.6) !important;
          color: #9c9ca3 !important;
        }
        .leaflet-control-attribution a { color: ${RED} !important; }
      `}</style>
    </>
  )
}

function StatusRow({ shuttle, lastSeenAt, now, stops = [], eventDate = null, nextStopHint = null }) {
  const live = !!shuttle?.is_active
  const ageMin = lastSeenAt ? Math.floor((now - new Date(lastSeenAt).getTime()) / 60000) : null

  const dest = live ? (resolveStopByName(stops, nextStopHint?.bar_name) || pickNextStopByOrder(stops, new Date(now), eventDate)) : null
  const eta = dest ? computeEta(shuttle, dest) : null

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          background: live ? 'rgba(229,72,77,0.08)' : SURFACE,
          border: `1px solid ${live ? 'rgba(229,72,77,0.35)' : LINE}`,
          borderRadius: 12,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 10, height: 10, borderRadius: '50%',
            background: live ? RED : '#3a3a44',
            boxShadow: live ? `0 0 12px ${RED}` : 'none',
            flex: '0 0 auto',
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: live ? RED_HI : INK, fontSize: 13, fontWeight: 700 }}>
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
            background: 'linear-gradient(180deg, rgba(229,72,77,0.14), rgba(229,72,77,0.05))',
            border: `1px solid rgba(229,72,77,0.45)`,
            borderRadius: 12,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(229,72,77,0.18)',
              border: `1px solid ${RED}`,
              color: RED_HI,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800,
              flex: '0 0 auto',
            }}
          >
            →
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: RED, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
              {eta.status === 'arrived' ? 'At stop' : `Next stop · #${dest.index + 1}`}
            </div>
            <div style={{ color: INK, fontSize: 16, fontWeight: 800, marginTop: 2, lineHeight: 1.15 }}>
              {dest.name}
            </div>
          </div>
          <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
            {eta.status === 'arrived' ? (
              <div style={{ color: RED_HI, fontSize: 13, fontWeight: 800 }}>Arrived</div>
            ) : (
              <>
                <div style={{ color: INK_DIM, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>
                  {eta.status === 'estimated' ? 'Arrival · est' : 'Arrival'}
                </div>
                <div style={{ color: INK, fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                  {formatClock(now + eta.etaMin * 60_000)}
                </div>
                <div style={{ color: INK_DIM, fontSize: 11, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>
                  {eta.etaMin} min · {formatDistance(eta.distanceMi, eta.distanceMeters)}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const STOP_LAYOVER_MIN = 10

function StopList({ stops, shuttle, eventDate, now, nextStopHint = null }) {
  const live = !!shuttle?.is_active
  const nextStop = live
    ? (resolveStopByName(stops, nextStopHint?.bar_name) || pickNextStopByOrder(stops, new Date(now), eventDate))
    : null

  const etas = computeMultiStopEtas(stops, shuttle, nextStop)

  return (
    <section
      style={{
        background: SURFACE,
        border: `1px solid ${LINE}`,
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${LINE}` }}>
        <div style={{ color: RED, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>
          Today&rsquo;s stops
        </div>
      </div>
      <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {stops.map(s => {
          const eta = etas.get(s.index)
          const isPast = nextStop && s.index < nextStop.index
          return (
            <li
              key={s.index}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderTop: s.index === 0 ? 'none' : `1px solid ${LINE}`,
                opacity: isPast ? 0.45 : 1,
              }}
            >
              <span
                style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: isPast ? 'rgba(255,255,255,0.04)' : 'rgba(229,72,77,0.12)',
                  border: `1px solid ${isPast ? LINE : 'rgba(229,72,77,0.4)'}`,
                  color: isPast ? INK_DIM : RED_HI,
                  fontSize: 12, fontWeight: 800,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flex: '0 0 auto',
                }}
              >
                {s.index + 1}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: INK, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}{s.onBase ? ' · gate' : ''}
                </div>
                {s.startTime && !eta && (
                  <div style={{ color: INK_DIM, fontSize: 12 }}>Pickup {formatTime(s.startTime)}</div>
                )}
              </div>
              {s.lat == null ? (
                <span style={{ color: INK_DIM, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  No pin
                </span>
              ) : eta ? (
                <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                  {eta.status === 'arrived' ? (
                    <div style={{ color: RED_HI, fontSize: 12, fontWeight: 800 }}>At stop</div>
                  ) : (
                    <>
                      <div style={{ color: RED_HI, fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
                        {formatClock(now + eta.etaMin * 60_000)}
                      </div>
                      <div style={{ color: INK_DIM, fontSize: 11, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>
                        {eta.etaMin} min · {formatDistance(eta.distanceMi, eta.distanceMeters)}
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function computeMultiStopEtas(stops, shuttle, nextStop) {
  const out = new Map()
  if (!shuttle || !nextStop) return out

  const placed = stops.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
  const remaining = placed.filter(s => s.index >= nextStop.index)
  if (!remaining.length) return out

  const actualSpeed = Number(shuttle.speed_mph)
  const moving = Number.isFinite(actualSpeed) && actualSpeed > 5
  const driveMph = moving ? actualSpeed : ASSUMED_DRIVE_MPH

  let cumMin = 0
  let prevLat = shuttle.lat
  let prevLng = shuttle.lng

  for (let i = 0; i < remaining.length; i++) {
    const s = remaining[i]
    const meters = haversineMeters(prevLat, prevLng, s.lat, s.lng)
    const distanceMi = meters / 1609.344
    const driveMin = (distanceMi / driveMph) * 60

    if (i === 0 && meters < 60) {
      out.set(s.index, { status: 'arrived', etaMin: 0, distanceMi, distanceMeters: meters })
    } else {
      const layovers = i * STOP_LAYOVER_MIN
      cumMin += driveMin
      const etaMin = Math.max(1, Math.round(cumMin + layovers))
      out.set(s.index, {
        status: i === 0 && moving ? 'enroute' : 'estimated',
        etaMin,
        distanceMi,
        distanceMeters: meters,
      })
    }

    prevLat = s.lat
    prevLng = s.lng
  }

  return out
}

function resolveStopByName(stops, barName) {
  if (!barName || !Array.isArray(stops)) return null
  const target = String(barName).trim().toLowerCase()
  const placed = stops.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng))
  return placed.find(s => String(s.name || '').trim().toLowerCase() === target) || null
}

function pickNextStopByOrder(stops, now, eventDate) {
  if (!Array.isArray(stops) || stops.length === 0) return null
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

const ASSUMED_DRIVE_MPH = 25

function computeEta(shuttle, dest) {
  const meters = haversineMeters(shuttle.lat, shuttle.lng, dest.lat, dest.lng)
  const distanceMi = meters / 1609.344
  if (meters < 60) return { status: 'arrived', distanceMi, distanceMeters: meters, etaMin: 0 }

  const actualSpeed = Number(shuttle.speed_mph)
  const moving = Number.isFinite(actualSpeed) && actualSpeed > 5
  const speedForEta = moving ? actualSpeed : ASSUMED_DRIVE_MPH
  const etaMin = Math.max(1, Math.round((distanceMi / speedForEta) * 60))
  return { status: moving ? 'enroute' : 'estimated', distanceMi, distanceMeters: meters, etaMin }
}

function formatDistance(distanceMi, meters) {
  if (distanceMi < 0.1) return `${Math.round(meters * 3.28084)} ft`
  return `${distanceMi.toFixed(1)} mi`
}

function stopPinHtml(n, onBase) {
  const border = onBase ? '#fff' : RED
  return `
    <div style="
      width:28px;height:28px;border-radius:50%;
      background:#1a2027;border:2px solid ${border};
      color:${RED_HI};font-size:12px;font-weight:800;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 4px 14px rgba(0,0,0,0.55);
    ">${n}</div>
  `
}

function shuttleIconHtml() {
  return `
    <div style="
      width:40px;height:40px;border-radius:50%;
      background: radial-gradient(circle at 35% 30%, ${RED_HI}, ${RED});
      border:2px solid #0a0a0b;
      box-shadow:0 0 0 4px rgba(229,72,77,0.35), 0 8px 22px rgba(0,0,0,0.5);
      animation: loop-shuttle-pulse 1.8s ease-in-out infinite;
    "></div>
    <style>
      @keyframes loop-shuttle-pulse {
        0%,100% { box-shadow: 0 0 0 4px rgba(229,72,77,0.35), 0 8px 22px rgba(0,0,0,0.5); }
        50%     { box-shadow: 0 0 0 10px rgba(229,72,77,0.05), 0 8px 22px rgba(0,0,0,0.5); }
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

function formatClock(epochMs) {
  if (!Number.isFinite(epochMs)) return ''
  const d = new Date(epochMs)
  const h = d.getHours(); const m = d.getMinutes()
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}
