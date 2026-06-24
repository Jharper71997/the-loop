'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import 'leaflet/dist/leaflet.css'
import { haversineMeters as haversine } from '@/lib/geo'
import { C } from '../../_theme'

// The Loop driver console. Reuses the Brew Loop driver's GPS plumbing
// (watchPosition + throttled /api/shuttle/ping with the Marines group_id, wake
// lock, localStorage auto-resume) but replaces the route-stop-log UI with a
// live manifest: who's waiting at which stop and who's on board, each with a
// one-tap Board / Alight that writes loop_boardings.

const MIN_POST_INTERVAL_MS = 8000
const MIN_DELTA_METERS = 5
const FALLBACK = { lat: 34.7541, lng: -77.4302 } // Camp Lejeune area
const GREEN = '#6fbf7f'

function runningFlagKey(id) { return `loop:driver:running:${id}` }

export default function LoopDriverClient({
  groupId = null,
  eventId = null,
  loopName = null,
  eventDate = null,
  pickupTime = null,
  stops = [],
  initialManifest = [],
}) {
  const [running, setRunning] = useState(false)
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const [pingCount, setPingCount] = useState(0)
  const [lastPingAt, setLastPingAt] = useState(null)
  const [, setTick] = useState(0)
  const [riders, setRiders] = useState(initialManifest || [])
  const [busyId, setBusyId] = useState(null)

  const watchIdRef = useRef(null)
  const lastPostRef = useRef({ at: 0, lat: null, lng: null })
  const wakeLockRef = useRef(null)
  const mapContainerRef = useRef(null)
  const mapStateRef = useRef({ map: null, L: null, driverMarker: null, didFollow: false })
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  // Live manifest poll.
  const refreshManifest = useCallback(async () => {
    if (!groupId) return
    try {
      const res = await fetch(`/api/loop-driver/manifest?group_id=${encodeURIComponent(groupId)}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      if (Array.isArray(json?.riders)) setRiders(json.riders)
    } catch {}
  }, [groupId])

  useEffect(() => {
    if (!groupId) return
    const t = setInterval(refreshManifest, 15_000)
    return () => clearInterval(t)
  }, [groupId, refreshManifest])

  // Boot the Leaflet map once — the loop line + stops + driver marker.
  useEffect(() => {
    let cancelled = false
    let map
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !mapContainerRef.current) return

      const fit = stops.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng)).map(s => [s.lat, s.lng])
      map = L.map(mapContainerRef.current, { zoomControl: true, attributionControl: false, scrollWheelZoom: true })
        .setView(fit[0] || [FALLBACK.lat, FALLBACK.lng], 13)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
      L.control.attribution({ prefix: false }).addAttribution('&copy; OpenStreetMap').addTo(map)

      if (fit.length > 1) L.polyline(fit, { color: C.GOLD, weight: 4, opacity: 0.85 }).addTo(map)

      stops.filter(s => Number.isFinite(s.lat) && Number.isFinite(s.lng)).forEach(s => {
        const icon = L.divIcon({ className: 'loop-stop-pin', html: stopPinHtml(s.index + 1, s.onBase), iconSize: [28, 28], iconAnchor: [14, 14] })
        L.marker([s.lat, s.lng], { icon })
          .bindPopup(`<strong>${escapeHtml(s.name)}</strong>${s.onBase ? '<br/>On-base pickup' : ''}`)
          .addTo(map)
      })

      if (fit.length > 1) map.fitBounds(fit, { padding: [40, 40] })
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

  // Move the driver marker as the position updates.
  useEffect(() => {
    const { map, L } = mapStateRef.current
    if (!map || !L || !mapReady || !position) return
    const latlng = [position.lat, position.lng]
    if (!mapStateRef.current.driverMarker) {
      const icon = L.divIcon({ className: 'loop-driver-icon', html: driverIconHtml(), iconSize: [40, 40], iconAnchor: [20, 20] })
      mapStateRef.current.driverMarker = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(map)
    } else {
      mapStateRef.current.driverMarker.setLatLng(latlng)
    }
    if (!mapStateRef.current.didFollow) {
      map.setView(latlng, Math.max(map.getZoom(), 15), { animate: true })
      mapStateRef.current.didFollow = true
    }
  }, [position, mapReady])

  // Cleanup on unmount — release watch + wake lock, but never send off-duty
  // (iOS discards backgrounded webviews; off-duty fires only from End route).
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) { try { navigator.geolocation.clearWatch(watchIdRef.current) } catch {}; watchIdRef.current = null }
      if (wakeLockRef.current) { try { wakeLockRef.current.release() } catch {}; wakeLockRef.current = null }
    }
  }, [])

  // Auto-resume after an iOS reload mid-shift.
  useEffect(() => {
    if (!eventId || running || typeof window === 'undefined') return
    try { if (window.localStorage.getItem(runningFlagKey(eventId)) === '1') start() } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId])

  async function start() {
    setError(null)
    if (!navigator.geolocation) { setError('This device doesn\'t expose geolocation.'); return }
    try { if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen') } catch {}
    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, onGeoError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 })
    setRunning(true)
    if (eventId && typeof window !== 'undefined') { try { window.localStorage.setItem(runningFlagKey(eventId), '1') } catch {} }
  }

  async function stop() {
    if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
    if (wakeLockRef.current) { try { wakeLockRef.current.release() } catch {}; wakeLockRef.current = null }
    if (position) {
      try {
        await fetch('/api/shuttle/ping', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: position.lat, lng: position.lng, speed: position.speed, heading: position.heading, group_id: groupId, is_active: false }),
        })
      } catch {}
    }
    setRunning(false)
    if (eventId && typeof window !== 'undefined') { try { window.localStorage.removeItem(runningFlagKey(eventId)) } catch {} }
  }

  async function onPosition(pos) {
    const lat = pos.coords.latitude
    const lng = pos.coords.longitude
    const speedMph = Number.isFinite(pos.coords.speed) ? pos.coords.speed * 2.23694 : null
    const heading = pos.coords.heading
    setPosition({ lat, lng, speed: speedMph, heading })

    const now = Date.now()
    const since = now - lastPostRef.current.at
    const deltaM = haversine(lastPostRef.current.lat, lastPostRef.current.lng, lat, lng)
    if (since < MIN_POST_INTERVAL_MS && deltaM < MIN_DELTA_METERS) return

    try {
      const res = await fetch('/api/shuttle/ping', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, speed: speedMph, heading, group_id: groupId, is_active: true }),
      })
      if (res.ok) {
        lastPostRef.current = { at: now, lat, lng }
        setPingCount(n => n + 1); setLastPingAt(now); setError(null)
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body.detail ? `${body.reason}: ${body.detail}` : (body.reason || `Ping rejected (${res.status})`))
      }
    } catch (err) {
      setError(`Ping failed: ${err?.message || 'network'}`)
    }
  }

  function onGeoError(err) {
    setError(err?.message || 'Location unavailable. Allow location access in browser settings.')
  }

  async function board(rider, action) {
    if (!groupId) return
    setBusyId(rider.order_item_id)
    // Optimistic flip.
    setRiders(prev => prev.map(r => r.order_item_id === rider.order_item_id ? { ...r, on_board: action === 'board' } : r))
    try {
      await fetch('/api/loop-driver/board', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_id: groupId,
          order_item_id: rider.order_item_id,
          contact_id: rider.contact_id,
          stop_index: action === 'board' ? rider.pickup_stop_index : rider.last_stop_index,
          action,
        }),
      })
      await refreshManifest()
    } catch {
      await refreshManifest()
    } finally {
      setBusyId(null)
    }
  }

  const ageSec = lastPingAt ? Math.floor((Date.now() - lastPingAt) / 1000) : null
  const onboard = riders.filter(r => r.on_board)
  const waiting = riders.filter(r => !r.on_board)
  const stopName = i => (Number.isInteger(i) && stops[i]) ? stops[i].name : (Number.isInteger(i) ? `Stop ${i + 1}` : 'Any stop')

  return (
    <div style={{ minHeight: '100dvh', background: '#0d1014', color: C.INK, padding: '20px 16px 32px' }}>
      <div style={{ maxWidth: 520, margin: '0 auto', display: 'grid', gap: 16 }}>
        <header>
          <div style={{ color: C.GOLD, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>The Loop · Driver</div>
          <h1 style={{ color: C.INK, fontSize: 26, fontWeight: 800, margin: '4px 0 0' }}>{running ? 'Live' : 'Off duty'}</h1>
          {loopName && (
            <div style={{ color: C.INK_DIM, fontSize: 13, marginTop: 4 }}>
              {loopName}{eventDate ? ` · ${formatLoopDate(eventDate)}` : ''}{pickupTime ? ` · ${formatTime(pickupTime)} first pickup` : ''}
            </div>
          )}
          {!groupId && (
            <div style={{ color: '#ff8585', fontSize: 12, marginTop: 6 }}>
              No active loop scheduled. Build this weekend{"'"}s route first.
            </div>
          )}
        </header>

        {/* GPS control */}
        <div style={{ padding: '22px 20px', borderRadius: 18, background: running ? 'rgba(111,191,127,0.10)' : C.SURFACE, border: `1.5px solid ${running ? 'rgba(111,191,127,0.45)' : C.LINE}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: running ? GREEN : '#3a3a44', boxShadow: running ? '0 0 14px rgba(111,191,127,0.7)' : 'none' }} />
            <div>
              <div style={{ color: C.INK, fontSize: 16, fontWeight: 700 }}>{running ? 'Sharing position' : 'Shuttle is off duty'}</div>
              <div style={{ color: C.INK_DIM, fontSize: 12 }}>
                {running ? `${pingCount} ping${pingCount === 1 ? '' : 's'} · last ${ageSec != null ? `${ageSec}s ago` : 'pending'}` : 'Tap Start to share live position with riders.'}
              </div>
            </div>
          </div>

          {position && stops.length > 0 && <NextStopCard position={position} stops={stops} eventDate={eventDate} />}

          {error && (
            <div style={{ color: '#ff8585', fontSize: 12, padding: '8px 12px', background: 'rgba(212,163,51,0.08)', borderRadius: 8, marginBottom: 12 }}>{error}</div>
          )}

          {running ? (
            <button type="button" onClick={stop} style={{ ...primaryBtn, background: 'transparent', color: C.INK, border: `1.5px solid ${C.GOLD}` }}>End route</button>
          ) : (
            <button type="button" onClick={start} style={primaryBtn}>Start route</button>
          )}
        </div>

        {/* Manifest */}
        <div style={{ padding: '14px 14px 12px', borderRadius: 18, background: C.SURFACE, border: `1.5px solid ${C.LINE}` }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
            <div style={{ color: C.GOLD, fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>Manifest</div>
            <div style={{ color: C.INK_DIM, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{onboard.length} on board · {riders.length} sold</div>
          </div>

          {riders.length === 0 ? (
            <div style={{ color: C.INK_DIM, fontSize: 13, padding: '10px 2px', lineHeight: 1.45 }}>
              No riders yet. Sales show up here as they buy — you{"'"}ll see who{"'"}s waiting at each stop and can check them on board.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {/* On board */}
              {onboard.length > 0 && (
                <div>
                  <div style={sectionHdr}>On board ({onboard.length})</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {onboard.map(r => (
                      <RiderRow key={r.order_item_id} r={r} busy={busyId === r.order_item_id} onBoard={() => board(r, 'alight')} actionLabel="Alight" actionVariant="ghost" />
                    ))}
                  </div>
                </div>
              )}

              {/* Waiting, grouped by boarding stop */}
              {waiting.length > 0 && (
                <div>
                  <div style={sectionHdr}>Waiting ({waiting.length})</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {groupByStop(waiting).map(({ key, idx, list }) => (
                      <div key={key}>
                        <div style={{ color: C.INK_DIM, fontSize: 11, fontWeight: 700, margin: '2px 2px 6px' }}>
                          {Number.isInteger(idx) ? `${idx + 1}. ${stopName(idx)}` : 'No stop chosen'}
                        </div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {list.map(r => (
                            <RiderRow key={r.order_item_id} r={r} busy={busyId === r.order_item_id} onBoard={() => board(r, 'board')} actionLabel="Board" actionVariant="solid" />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live map */}
        <div ref={mapContainerRef} style={{ width: '100%', aspectRatio: '4/3', maxHeight: '55dvh', minHeight: 280, borderRadius: 16, overflow: 'hidden', background: '#0d0d10', border: `1px solid ${C.LINE}` }} />

        <p style={{ color: C.INK_DIM, fontSize: 12, textAlign: 'center', margin: 0 }}>
          Check an ID at the door. Keep this screen on while driving.
        </p>
      </div>

      <style>{`
        .loop-stop-pin > div { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .leaflet-container { background: #0d0d10; }
        .leaflet-popup-content-wrapper { background: #121216; color: #f5f5f7; border: 1px solid rgba(255,255,255,0.10); border-radius: 10px; }
        .leaflet-popup-tip { background: #121216; }
        .leaflet-control-attribution { background: rgba(10,10,11,0.6) !important; color: #9c9ca3 !important; }
        .leaflet-control-attribution a { color: ${C.GOLD} !important; }
      `}</style>
    </div>
  )
}

function RiderRow({ r, busy, onBoard, actionLabel, actionVariant }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.LINE}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.INK, fontSize: 15, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
        <div style={{ marginTop: 3 }}>
          <PassBadge r={r} />
        </div>
      </div>
      <button
        type="button"
        onClick={onBoard}
        disabled={busy}
        style={{
          flex: '0 0 auto', padding: '10px 16px', borderRadius: 10, fontWeight: 800, fontSize: 14, cursor: busy ? 'default' : 'pointer',
          opacity: busy ? 0.6 : 1,
          ...(actionVariant === 'solid'
            ? { background: `linear-gradient(180deg, ${C.GOLD_HI}, ${C.GOLD})`, color: '#0a0a0b', border: 'none' }
            : { background: 'transparent', color: C.INK, border: `1px solid ${C.LINE}` }),
        }}
      >
        {busy ? '…' : actionLabel}
      </button>
    </div>
  )
}

function PassBadge({ r }) {
  const dayPass = r.is_day_pass
  const label = dayPass ? 'Day Pass' : (r.on_board ? 'Single · boarded' : 'Single Ride')
  return (
    <span style={{
      fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 800,
      padding: '3px 8px', borderRadius: 999,
      background: dayPass ? 'rgba(111,191,127,0.14)' : 'rgba(212,163,51,0.12)',
      border: `1px solid ${dayPass ? 'rgba(111,191,127,0.45)' : 'rgba(212,163,51,0.4)'}`,
      color: dayPass ? GREEN : C.GOLD_HI,
    }}>
      {label}
    </span>
  )
}

// Group waiting riders by their chosen boarding stop, stop order first, the
// "no stop" bucket last.
function groupByStop(list) {
  const map = new Map()
  for (const r of list) {
    const k = Number.isInteger(r.pickup_stop_index) ? r.pickup_stop_index : 'none'
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(r)
  }
  const keys = [...map.keys()]
  keys.sort((a, b) => {
    if (a === 'none') return 1
    if (b === 'none') return -1
    return a - b
  })
  return keys.map(k => ({ key: String(k), idx: k === 'none' ? null : k, list: map.get(k) }))
}

function NextStopCard({ position, stops, eventDate }) {
  const dest = pickNextStopByOrder(stops, new Date(), eventDate)
  if (!dest) return null
  const meters = haversine(position.lat, position.lng, dest.lat, dest.lng)
  const distanceMi = meters / 1609.344
  const arrived = meters < 60
  const actualSpeed = Number(position.speed)
  const moving = Number.isFinite(actualSpeed) && actualSpeed > 5
  const speedForEta = moving ? actualSpeed : 25
  const etaMin = arrived ? null : Math.max(1, Math.round((distanceMi / speedForEta) * 60))

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'linear-gradient(180deg, rgba(212,163,51,0.14), rgba(212,163,51,0.05))', border: `1px solid rgba(212,163,51,0.45)`, borderRadius: 12, marginBottom: 14 }}>
      <span aria-hidden style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(212,163,51,0.18)', border: `1px solid ${C.GOLD}`, color: C.GOLD_HI, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flex: '0 0 auto' }}>→</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: C.GOLD, fontSize: 10, letterSpacing: '0.22em', textTransform: 'uppercase', fontWeight: 700 }}>{arrived ? 'At stop' : `Next stop · #${dest.index + 1}`}</div>
        <div style={{ color: C.INK, fontSize: 16, fontWeight: 800, marginTop: 2, lineHeight: 1.15 }}>{dest.name}</div>
      </div>
      <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
        {arrived ? (
          <div style={{ color: C.GOLD_HI, fontSize: 13, fontWeight: 800 }}>Arrived</div>
        ) : (
          <>
            <div style={{ color: C.INK_DIM, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', fontWeight: 700 }}>{moving ? 'ETA' : 'ETA · est'}</div>
            <div style={{ color: C.INK, fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{etaMin} min</div>
          </>
        )}
      </div>
    </div>
  )
}

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

function stopPinHtml(n, onBase) {
  const border = onBase ? '#fff' : C.GOLD
  return `<div style="width:28px;height:28px;border-radius:50%;background:#121216;border:2px solid ${border};color:${C.GOLD_HI};font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,0.55);">${n}</div>`
}

function driverIconHtml() {
  return `<div style="width:40px;height:40px;border-radius:50%;background:radial-gradient(circle at 35% 30%, ${C.GOLD_HI}, ${C.GOLD});border:2px solid #0a0a0b;box-shadow:0 0 0 4px rgba(212,163,51,0.35), 0 8px 22px rgba(0,0,0,0.5);"></div>`
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function formatLoopDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(`${iso}T12:00:00-05:00`)
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
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

const primaryBtn = {
  padding: '16px 22px', borderRadius: 12, background: `linear-gradient(180deg, ${C.GOLD_HI}, ${C.GOLD})`,
  color: '#0a0a0b', border: 0, fontWeight: 800, fontSize: 16, cursor: 'pointer', width: '100%',
  boxShadow: '0 10px 30px rgba(212,163,51,0.25)',
}
const sectionHdr = { color: C.WARM, fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', fontWeight: 700, margin: '0 2px 8px' }
