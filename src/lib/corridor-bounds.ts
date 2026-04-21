// Block 7 · Corridor Map — 2-mile geographic window centered on WTB.
// Locked bounds + zoom limits used by the Leaflet MapContainer.
// Colombia bridge (27.7178, -99.6193) falls OUTSIDE this window —
// handled via off-edge indicator, not by relaxing bounds.

export const CORRIDOR_CENTER = { lat: 27.5036, lng: -99.5076 } as const

export const CORRIDOR_BOUNDS = {
  north: 27.5500,
  south: 27.4600,
  east: -99.4600,
  west: -99.5500,
} as const

export const CORRIDOR_ZOOM = {
  min: 13,
  max: 16,
  default: 14,
} as const

// Leaflet expects [[southWest], [northEast]] ordering for LatLngBounds.
export const CORRIDOR_LEAFLET_BOUNDS: [[number, number], [number, number]] = [
  [CORRIDOR_BOUNDS.south, CORRIDOR_BOUNDS.west],
  [CORRIDOR_BOUNDS.north, CORRIDOR_BOUNDS.east],
]

export function isWithinCorridor(lat: number, lng: number): boolean {
  return (
    lat >= CORRIDOR_BOUNDS.south &&
    lat <= CORRIDOR_BOUNDS.north &&
    lng >= CORRIDOR_BOUNDS.west &&
    lng <= CORRIDOR_BOUNDS.east
  )
}
