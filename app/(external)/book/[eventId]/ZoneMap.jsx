'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import SHAPES from '@/lib/doorPickupZones.json'
import { DEPOT, ZONES } from '@/lib/doorPickup'

// Door pickup coverage, so a rider can see which zone their address is in.
// lib/doorPickupZones.json is each zone's ZIP (Census 2020 ZCTA) clipped to
// the same two limits checkout enforces in lib/doorPickup.js: 10 miles from
// the depot and west of Piney Green Rd. Regenerate it if either one changes.
const COLORS = { 1: '#d4a333', 2: '#2f6fd6' }

export default function ZoneMap({ highlight = null }) {
  const ref = useRef(null)

  useEffect(() => {
    let map
    let cancelled = false
    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !ref.current) return
      map = L.map(ref.current, { attributionControl: false, scrollWheelZoom: false })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map)
      L.control.attribution({ prefix: false }).addAttribution('&copy; OpenStreetMap').addTo(map)

      // The 10 mile limit, for context.
      L.polygon(SHAPES.circle.map(([lon, lat]) => [lat, lon]), {
        color: '#ffffff', weight: 1.5, dashArray: '6 6', fill: false, opacity: 0.7,
      }).addTo(map)

      const layers = []
      for (const [n, geom] of Object.entries(SHAPES.zones)) {
        const on = highlight == null || Number(n) === highlight
        const layer = L.geoJSON(geom, {
          style: {
            color: COLORS[n], weight: on ? 3 : 2,
            fillColor: COLORS[n], fillOpacity: on ? 0.4 : 0.22, opacity: 1,
          },
        }).bindTooltip(`Zone ${n}: ${ZONES[n].label}`, { sticky: true }).addTo(map)
        layers.push(layer)
      }

      // Piney Green Rd: the east edge. Nothing past it.
      L.polyline(SHAPES.piney, { color: '#111', weight: 7, opacity: 0.85 }).addTo(map)
      L.polyline(SHAPES.piney, { color: '#ffffff', weight: 3, dashArray: '2 8' })
        .bindTooltip('Piney Green Rd: no pickups past here', { sticky: true })
        .addTo(map)

      L.circleMarker([DEPOT.lat, DEPOT.lon], {
        radius: 8, color: '#111', weight: 2, fillColor: '#f0c24a', fillOpacity: 1,
      }).bindTooltip('Drop off', { permanent: true, direction: 'left', offset: [-8, 0], className: 'zm-tip' })
        .addTo(map)

      map.fitBounds(L.featureGroup(layers).getBounds(), { padding: [12, 12] })
    })()
    return () => { cancelled = true; if (map) map.remove() }
  }, [highlight])

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div ref={ref} style={{ height: 320, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', background: '#15151a' }} />
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: '#b8b8bf' }}>
        {Object.entries(ZONES).map(([n, z]) => (
          <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: COLORS[n] }} />
            Zone {n}: {z.label} ({z.zips.join(', ')})
          </span>
        ))}
      </div>
      <div style={{ fontSize: 12.5, color: '#9c9ca3', lineHeight: 1.5 }}>
        The striped line is Piney Green Rd, our limit. Outside the colored area, including on base, we can&rsquo;t pick up.
      </div>
      <style>{`.zm-tip { font-weight: 700; font-size: 12px; }`}</style>
    </div>
  )
}
