'use client'

// Block 7 · Corridor Map — CartoDB Dark Matter tile wrapper.
// No API key required. Closest free tile set to the ZAPATA AI canonical.
// See https://github.com/CartoDB/basemap-styles for attribution terms.

import { TileLayer } from 'react-leaflet'

export function CorridorTileLayer() {
  return (
    <TileLayer
      url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      subdomains={['a', 'b', 'c', 'd']}
      maxZoom={19}
    />
  )
}

export default CorridorTileLayer
