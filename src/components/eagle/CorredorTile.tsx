'use client'

/**
 * Corridor tile — lazy iframe of /corredor. Direct-import the CorridorPage
 * client component would drag Leaflet into the Eagle bundle; iframe keeps the
 * Eagle shell under budget and reuses the corridor's own auth-gated SSR.
 */

import { TEXT_MUTED } from '@/lib/design-system'
import { TileShell, MONO } from './tile-shell'

export function CorredorTile() {
  return (
    <TileShell title="Corredor en vivo" subtitle="tráficos activos" href="/corredor" span={2} fixedHeight={360}>
      <div
        style={{
          flex: 1,
          borderRadius: 12,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.06)',
          position: 'relative',
          minHeight: 280,
        }}
      >
        <iframe
          src="/corredor?embed=1"
          title="Corredor"
          loading="lazy"
          style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 12,
            fontSize: 10,
            color: TEXT_MUTED,
            fontFamily: MONO,
            background: 'rgba(9,9,11,0.8)',
            padding: '2px 6px',
            borderRadius: 4,
          }}
        >
          Clic para abrir
        </div>
      </div>
    </TileShell>
  )
}
