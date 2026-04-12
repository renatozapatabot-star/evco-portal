'use client'

// Block 7 · Corridor Map — Leaflet root. Dynamic-imported by CorridorPage
// with `{ ssr: false }` because Leaflet touches `window` on import.

import 'leaflet/dist/leaflet.css'
import './corridor.css'
import { MapContainer } from 'react-leaflet'
import {
  CORRIDOR_CENTER,
  CORRIDOR_LEAFLET_BOUNDS,
  CORRIDOR_ZOOM,
} from '@/lib/corridor-bounds'
import { TOPO_PATTERN_URL } from '@/lib/design-system'
import { CorridorTileLayer } from './CorridorTileLayer'
import { LandmarkMarker } from './LandmarkMarker'
import { PulseMarker } from './PulseMarker'
import type { ActiveTraficoPulse, Landmark } from '@/types/corridor'

export interface CorridorMapProps {
  landmarks: Landmark[]
  pulses: ActiveTraficoPulse[]
  onPulseClick?: (pulse: ActiveTraficoPulse) => void
  onLandmarkHover?: (id: string) => void
}

export function CorridorMap({ landmarks, pulses, onPulseClick, onLandmarkHover }: CorridorMapProps) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <MapContainer
        center={[CORRIDOR_CENTER.lat, CORRIDOR_CENTER.lng]}
        zoom={CORRIDOR_ZOOM.default}
        minZoom={CORRIDOR_ZOOM.min}
        maxZoom={CORRIDOR_ZOOM.max}
        maxBounds={CORRIDOR_LEAFLET_BOUNDS}
        maxBoundsViscosity={1.0}
        scrollWheelZoom={true}
        zoomControl={true}
        attributionControl={true}
        style={{ width: '100%', height: '100%', background: '#05070B' }}
      >
        <CorridorTileLayer />
        {landmarks.map(lm => (
          <LandmarkMarker key={lm.id} landmark={lm} onHover={onLandmarkHover} />
        ))}
        {pulses.map(p => (
          <PulseMarker key={p.traficoId} pulse={p} onClick={onPulseClick} />
        ))}
      </MapContainer>
      {/* 3-5% opacity topographic hairline overlay — AGUILA canonical texture. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backgroundImage: `url(${TOPO_PATTERN_URL})`,
          backgroundSize: '480px',
          opacity: 0.04,
          mixBlendMode: 'screen',
          zIndex: 400,
        }}
      />
    </div>
  )
}

export default CorridorMap
