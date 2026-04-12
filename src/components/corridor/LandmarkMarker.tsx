'use client'

// Block 7 · Corridor Map — landmark marker (stationary geography).
// Silver inline SVG with an 11px es-MX label sticky below the shape.
// Shape varies by LandmarkType so bridges/offices/customs read differently.

import { Marker } from 'react-leaflet'
import L from 'leaflet'
import { useMemo } from 'react'
import { ACCENT_SILVER, ACCENT_SILVER_DIM } from '@/lib/design-system'
import type { Landmark, LandmarkType } from '@/types/corridor'

function shapeFor(type: LandmarkType): string {
  const silver = ACCENT_SILVER
  const dim = ACCENT_SILVER_DIM
  switch (type) {
    case 'bridge_commercial':
    case 'bridge_mixed':
      return `<rect x="4" y="6" width="16" height="8" fill="${silver}" opacity="0.85" rx="1" />`
    case 'office':
      return `<rect x="5" y="5" width="14" height="14" fill="${silver}" opacity="0.85" />`
    case 'warehouse':
      return `<rect x="5" y="5" width="14" height="14" fill="none" stroke="${silver}" stroke-width="1.5" />`
    case 'transfer_yard':
      return `<rect x="5" y="5" width="14" height="14" fill="none" stroke="${dim}" stroke-width="1" stroke-dasharray="2 2" />`
    case 'customs_us':
    case 'customs_mx':
      return `<rect x="5" y="5" width="14" height="14" fill="${silver}" opacity="0.6" /><circle cx="12" cy="12" r="2.2" fill="#0A0A0C" />`
    default:
      return `<circle cx="12" cy="12" r="5" fill="${silver}" />`
  }
}

function buildIcon(landmark: Landmark): L.DivIcon {
  const shape = shapeFor(landmark.type)
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
      <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${shape}</svg>
      <div style="margin-top:2px;font-family:var(--font-geist-sans),system-ui,sans-serif;font-size:11px;letter-spacing:0.04em;color:${ACCENT_SILVER};text-shadow:0 1px 2px rgba(0,0,0,0.85);white-space:nowrap;">${landmark.name}</div>
    </div>
  `
  return L.divIcon({
    html,
    className: 'corridor-landmark-icon',
    iconSize: [120, 44],
    iconAnchor: [60, 12],
  })
}

export interface LandmarkMarkerProps {
  landmark: Landmark
  onHover?: (id: string) => void
}

export function LandmarkMarker({ landmark, onHover }: LandmarkMarkerProps) {
  const icon = useMemo(() => buildIcon(landmark), [landmark])
  return (
    <Marker
      position={[landmark.lat, landmark.lng]}
      icon={icon}
      eventHandlers={{
        mouseover: onHover ? () => onHover(landmark.id) : undefined,
      }}
    />
  )
}

export default LandmarkMarker
