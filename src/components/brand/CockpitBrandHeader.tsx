/**
 * AGUILA · Cockpit brand header (rev E3)
 *
 * Layout (consistent across /inicio, /operador/inicio, /admin/eagle,
 * /bodega/inicio, /contabilidad):
 *
 *   [AguilaMark 64 + AguilaWordmark]        [CoordinatesBadge]
 *     └ subtitle (silver-dim)
 *
 *   Buenas tardes, {name}                   ← h1, below brand row
 *   Una pantalla · seis señales · cero clics para decidir.  ← tagline (optional)
 *
 * The Mark + Wordmark sit together as a monumental brand group on the left.
 * Coordinates stay top-right. Greeting is a page-level h1 BELOW the brand row.
 */

import type { ReactNode } from 'react'
import { AguilaMark } from './AguilaMark'
import { AguilaWordmark } from './AguilaWordmark'
import { CoordinatesBadge } from './CoordinatesBadge'
import {
  ACCENT_SILVER_BRIGHT,
  ACCENT_SILVER_DIM,
  TEXT_MUTED,
  TEXT_SECONDARY,
} from '@/lib/design-system'

export interface CockpitBrandHeaderProps {
  /** Subtitle under the wordmark — e.g. "Vista Águila · Tito" */
  subtitle?: string
  /** Page greeting rendered as h1 beneath the brand row — e.g. "Buenas tardes, Tito" */
  greeting?: string
  /** Optional tagline beneath the greeting (small caps, silver-dim). */
  tagline?: string
  /** Mark size in px. Default 64 for top-level cockpits. */
  markSize?: number
  /** Optional action node rendered to the right of the coordinates. */
  right?: ReactNode
}

export function CockpitBrandHeader({
  subtitle,
  greeting,
  tagline,
  markSize = 64,
  right,
}: CockpitBrandHeaderProps) {
  return (
    <div style={{ position: 'relative', marginBottom: 20 }}>
      {/* Topo hairline — decorative, top-right */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -8,
          right: -8,
          width: 240,
          height: 90,
          backgroundImage: 'url(/brand/topo-hairline.svg)',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'top right',
          opacity: 0.18,
          pointerEvents: 'none',
          mixBlendMode: 'screen',
        }}
      />

      {/* Brand row: mark + wordmark left, coordinates right */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
          marginBottom: greeting ? 16 : 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <AguilaMark size={markSize} tone="silver" />
          <div>
            <AguilaWordmark />
            {subtitle && (
              <div
                style={{
                  fontSize: 12,
                  color: TEXT_MUTED,
                  marginTop: 4,
                  letterSpacing: '0.02em',
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CoordinatesBadge />
          {right}
        </div>
      </header>

      {/* Greeting + tagline */}
      {(greeting || tagline) && (
        <div>
          {greeting && (
            <h1
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: ACCENT_SILVER_BRIGHT,
                letterSpacing: '-0.01em',
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              {greeting}
            </h1>
          )}
          {tagline && (
            <p
              style={{
                fontSize: 12,
                color: ACCENT_SILVER_DIM,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                margin: '6px 0 0',
              }}
            >
              {tagline}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/** Re-export to keep secondary text token available to callers. */
export { TEXT_SECONDARY }
