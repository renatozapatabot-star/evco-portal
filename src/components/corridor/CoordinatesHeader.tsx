'use client'

// Block 7 · Corridor Map — top chrome.
// Top-right: CoordinatesBadge (silver-dim tone). Top-left: tagline.

import { CoordinatesBadge } from '@/components/brand/CoordinatesBadge'
import { TEXT_TERTIARY } from '@/lib/design-system'

export function CoordinatesHeader() {
  return (
    <>
      <div
        className="aguila-corridor-tagline"
        style={{
          position: 'absolute',
          top: 18,
          left: 20,
          zIndex: 500,
          pointerEvents: 'none',
          fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
          fontSize: 9,
          letterSpacing: '0.24em',
          color: TEXT_TERTIARY,
        }}
      >
        INTELIGENCIA EN CADA FRONTERA
      </div>
      <div
        className="aguila-corridor-coordinates"
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 500,
          pointerEvents: 'none',
        }}
      >
        <CoordinatesBadge tone="silver-dim" />
      </div>
    </>
  )
}

export default CoordinatesHeader
