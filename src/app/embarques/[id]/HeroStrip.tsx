'use client'

import { useTrack } from '@/lib/telemetry/useTrack'
import {
  ACCENT_SILVER,
  AMBER,
  BG_CARD,
  BORDER,
  GLASS_BLUR,
  GLASS_SHADOW,
  GOLD,
  GREEN,
  RED,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '@/lib/design-system'

export interface HeroTileSpec {
  id: string
  label: string
  value: string
  color?: string
  mono?: boolean
  hint?: string | null
  /** When true, tile is rendered as a button that switches to the Cronología tab. */
  clickable?: boolean
}

interface HeroStripProps {
  traficoId: string
  tiles: HeroTileSpec[]
  onEventosClick: () => void
}

// Exported so parent callers can build tiles with the same vocabulary.
export const HERO_COLOR = {
  cyan: ACCENT_SILVER,
  amber: AMBER,
  red: RED,
  green: GREEN,
  gold: GOLD,
  muted: TEXT_MUTED,
  primary: TEXT_PRIMARY,
} as const

/**
 * Six-tile glass strip. Tile 6 ("Eventos") is clickable and switches
 * the active tab to Cronología. Grid collapses from 6-up to 3-up at
 * 1200px and stacks at 600px.
 */
export function HeroStrip({ tiles, onEventosClick, traficoId }: HeroStripProps) {
  const track = useTrack()

  return (
    <div
      className="trafico-hero-strip"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 16,
        marginBottom: 20,
      }}
    >
      {tiles.map((t) => {
        const color = t.color ?? TEXT_PRIMARY
        const isClickable = t.clickable === true

        const inner = (
          <>
            <div
              style={{
                fontSize: 'var(--aguila-fs-meta)',
                fontWeight: 700,
                color: TEXT_MUTED,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {t.label}
            </div>
            <div
              style={{
                fontSize: 'var(--aguila-fs-title)',
                fontWeight: 800,
                color,
                fontFamily: t.mono ? 'var(--font-mono)' : undefined,
                lineHeight: 1.1,
                marginTop: 6,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {t.value}
            </div>
            {t.hint && (
              <div
                style={{
                  fontSize: 'var(--aguila-fs-meta)',
                  color: TEXT_MUTED,
                  marginTop: 4,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {t.hint}
              </div>
            )}
          </>
        )

        const baseStyle: React.CSSProperties = {
          background: BG_CARD,
          backdropFilter: `blur(${GLASS_BLUR})`,
          WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
          border: `1px solid ${BORDER}`,
          borderRadius: 20,
          padding: '16px 20px',
          boxShadow: GLASS_SHADOW,
          minHeight: 92,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          textAlign: 'left',
        }

        if (isClickable) {
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                track('page_view', {
                  entityType: 'trafico_hero',
                  entityId: traficoId,
                  metadata: { event: 'hero_tile_clicked', tile_id: t.id },
                })
                onEventosClick()
              }}
              style={{
                ...baseStyle,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              {inner}
            </button>
          )
        }

        return (
          <div key={t.id} style={baseStyle}>
            {inner}
          </div>
        )
      })}
      <style>{`
        @media (max-width: 1200px) {
          .trafico-hero-strip { grid-template-columns: repeat(3, 1fr) !important; }
        }
        @media (max-width: 600px) {
          .trafico-hero-strip { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}
