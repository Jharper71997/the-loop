'use client'

import { useEffect, useRef, useState } from 'react'

// Center on Jacksonville, NC (Brew Loop's home market). Map auto-pans once a
// real shuttle ping comes in.
const DEFAULT_CENTER = [34.7541, -77.4302]
const DEFAULT_ZOOM = 13
const POLL_MS = 10000

const GOLD = '#d4a333'

export default function ShuttleMap({ stops = [] }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const leafletRef = useRef(null)
  const stopMarkersRef = useRef([])
  const followShuttleRef = useRef(true)
  const [shuttle, setShuttle] = useState(null)
  const [stale, setStale] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const L = (await import('leaflet')).default
      // Leaflet ships its CSS as a separate file. Inject from the CDN so we
      // don't have to fight Next's CSS pipeline. Safe to inject more than
      // once — browsers de-dupe by href.
      if (!document.querySelector('link[data-leaflet-css]')) {
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        link.crossOrigin = ''
        link.setAttribute('data-leaflet-css', '1')
        document.head.appendChild(link)
      }

      if (cancelled || !containerRef.current) return
      leafletRef.current = L

      const map = L.map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        attributionControl: true,
      })
      mapRef.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap · © CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      map.on('dragstart', () => { followShuttleRef.current = false })

      // Drop a numbered marker for each stop on tonight's route, then auto-fit
      // bounds so all stops show on first paint. Subsequent shuttle pings can
      // re-center on the bus once the user has scrolled away.
      if (stops.length) {
        const latLngs = []
        stops.forEach((stop, idx) => {
          const icon = L.divIcon({
            className: 'stop-marker',
            html: `
              <div style="
                width: 26px; height: 26px; border-radius: 50%;
                background: #15151a;
                border: 2px solid ${GOLD};
                color: ${GOLD};
                font: 700 13px/22px -apple-system,sans-serif;
                text-align: center;
                box-shadow: 0 0 12px rgba(212,163,51,0.4);
              ">${idx + 1}</div>
            `,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          })
          const marker = L.marker([stop.lat, stop.lng], { icon }).addTo(map)
          const mapsHref = `https://www.google.com/maps/search/?api=1&query=${stop.lat},${stop.lng}`
          const popupHtml = `
            <div style="font-family:-apple-system,sans-serif;color:#0a0a0b;">
              <div style="font-weight:700;font-size:14px;margin-bottom:4px;">Stop ${idx + 1}: ${escapeHtml(stop.name)}</div>
              ${stop.start_time ? `<div style="font-size:12px;color:#555;margin-bottom:6px;">${escapeHtml(stop.start_time)}</div>` : ''}
              ${stop.address ? `<div style="font-size:12px;color:#555;margin-bottom:6px;">${escapeHtml(stop.address)}</div>` : ''}
              <a href="${mapsHref}" target="_blank" rel="noreferrer" style="color:#d4a333;text-decoration:none;font-weight:600;">Open in Maps →</a>
            </div>
          `
          marker.bindPopup(popupHtml)
          stopMarkersRef.current.push(marker)
          latLngs.push([stop.lat, stop.lng])
        })
        if (latLngs.length) {
          map.fitBounds(latLngs, { padding: [40, 40], maxZoom: 14 })
        }
      }
    }

    init()
    return () => {
      cancelled = true
      try { mapRef.current?.remove() } catch {}
      mapRef.current = null
      markerRef.current = null
      stopMarkersRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch('/api/shuttle/current', { cache: 'no-store' })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (data.shuttle) {
          setShuttle(data.shuttle)
          setStale(false)
          renderShuttle(data.shuttle)
        } else {
          setShuttle(null)
          setStale(true)
        }
      } catch {
        if (!cancelled) setStale(true)
      }
    }

    poll()
    const t = setInterval(poll, POLL_MS)
    return () => { cancelled = true; clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function renderShuttle(s) {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return

    const latLng = [s.lat, s.lng]
    if (!markerRef.current) {
      const icon = L.divIcon({
        className: 'shuttle-marker',
        html: `
          <div style="
            width: 22px; height: 22px; border-radius: 50%;
            background: ${GOLD};
            box-shadow: 0 0 0 6px rgba(212,163,51,0.25), 0 0 24px rgba(212,163,51,0.6);
            border: 2px solid #0a0a0b;
          "></div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })
      markerRef.current = L.marker(latLng, { icon }).addTo(map)
    } else {
      markerRef.current.setLatLng(latLng)
    }

    if (followShuttleRef.current) {
      map.setView(latLng, Math.max(map.getZoom(), 14), { animate: true })
    }
  }

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!shuttle && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            right: 14,
            padding: '10px 14px',
            background: 'rgba(10,10,11,0.85)',
            border: '1px solid rgba(212,163,51,0.4)',
            borderRadius: 10,
            color: '#f5f5f7',
            fontSize: 13,
            backdropFilter: 'blur(6px)',
            zIndex: 500,
          }}
        >
          Shuttle is off duty right now. The map updates the moment your driver starts the route.
        </div>
      )}
      {stops.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            left: 14,
            right: 14,
            padding: '8px 12px',
            background: 'rgba(10,10,11,0.85)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            color: '#b8b8bf',
            fontSize: 11,
            backdropFilter: 'blur(6px)',
            zIndex: 500,
            textAlign: 'center',
          }}
        >
          {stops.length} stops on tonight’s route — tap a number for the bar
        </div>
      )}
      {shuttle && stale && (
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            right: 14,
            padding: '10px 14px',
            background: 'rgba(10,10,11,0.85)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 10,
            color: '#b8b8bf',
            fontSize: 12,
            zIndex: 500,
          }}
        >
          Reconnecting…
        </div>
      )}
    </div>
  )
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}
