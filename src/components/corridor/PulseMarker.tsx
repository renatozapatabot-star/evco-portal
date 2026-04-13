'use client'

// Block 7 · Corridor Map — animated pulse for an active trafico.
// Color derives from PulseSeverity. Multiple pulses at the same landmark
// are fanned out via a deterministic hash of the traficoId (±0.0005°).

import { Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import { memo, useMemo } from 'react'
import type { ActiveTraficoPulse, PulseSeverity } from '@/types/corridor'

const SEVERITY_FILL: Record<PulseSeverity, string> = {
  inflight: 'rgba(93, 202, 165, 0.80)',
  at_rest: 'rgba(196, 200, 208, 0.60)',
  awaiting: 'rgba(239, 159, 39, 1.0)',
  cleared: 'rgba(74, 222, 128, 0.70)',
  blocked: 'rgba(226, 75, 74, 1.0)',
}

const SEVERITY_STROKE: Record<PulseSeverity, string> = {
  inflight: 'rgba(93, 202, 165, 0.40)',
  at_rest: 'rgba(196, 200, 208, 0.30)',
  awaiting: 'rgba(239, 159, 39, 0.45)',
  cleared: 'rgba(74, 222, 128, 0.35)',
  blocked: 'rgba(226, 75, 74, 0.50)',
}

// Deterministic ±0.0005° offset so pulses at same landmark fan out
// instead of stacking. 31-bit FNV-ish hash of the traficoId string.
export function traficoOffset(traficoId: string): { dLat: number; dLng: number } {
  let h = 2166136261
  for (let i = 0; i < traficoId.length; i++) {
    h ^= traficoId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const x = (h & 0xffff) / 0xffff // 0..1
  const y = ((h >>> 16) & 0xffff) / 0xffff
  return {
    dLat: (x - 0.5) * 0.001,
    dLng: (y - 0.5) * 0.001,
  }
}

function buildIcon(severity: PulseSeverity): L.DivIcon {
  const fill = SEVERITY_FILL[severity]
  const stroke = SEVERITY_STROKE[severity]
  // Inline <style> keyframes per icon — cheap and scoped via unique class.
  const html = `
    <div class="aguila-pulse-wrapper" aria-hidden="true">
      <span class="aguila-pulse-ring" style="background:${stroke}"></span>
      <span class="aguila-pulse-core" style="background:${fill}"></span>
    </div>
  `
  return L.divIcon({
    html,
    className: 'corridor-pulse-icon',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

export interface PulseMarkerProps {
  pulse: ActiveTraficoPulse
  onClick?: (pulse: ActiveTraficoPulse) => void
}

function PulseMarkerInner({ pulse, onClick }: PulseMarkerProps) {
  const icon = useMemo(() => buildIcon(pulse.position.severity), [pulse.position.severity])
  const offset = useMemo(() => traficoOffset(pulse.traficoId), [pulse.traficoId])
  const lat = pulse.position.lat + offset.dLat
  const lng = pulse.position.lng + offset.dLng

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      eventHandlers={{
        click: onClick ? () => onClick(pulse) : undefined,
      }}
    >
      <Tooltip direction="top" offset={[0, -8]} opacity={0.92}>
        {pulse.traficoId}
      </Tooltip>
    </Marker>
  )
}

export const PulseMarker = memo(PulseMarkerInner)

export default PulseMarker
