'use client'

import { useTrack } from '@/lib/telemetry/useTrack'
import {
  ACCENT_SILVER,
  AMBER,
  GOLD,
  GREEN,
  RED,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from '@/lib/design-system'
import { PortalCard } from '@/components/portal/PortalCard'

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
 * Six-tile hero strip — each tile composes `<PortalCard tier="hero">`
 * so it inherits the emerald radial halo + hairline + elevation from
 * the PORTAL design system. Tile 6 ("Eventos") is clickable and
 * switches the active tab to Cronología.
 */
export function HeroStrip({ tiles, onEventosClick, traficoId }: HeroStripProps) {
  const track = useTrack()

  return (
    <div
      className="trafico-hero-strip"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 'var(--portal-s-4)',
        marginBottom: 'var(--portal-s-5)',
      }}
    >
      {tiles.map((t) => {
        const color = t.color ?? 'var(--portal-fg-1)'
        const isClickable = t.clickable === true

        const inner = (
          <>
            <div className="portal-metric__label">{t.label}</div>
            <div
              style={{
                fontFamily: t.mono
                  ? 'var(--portal-font-mono)'
                  : 'var(--portal-font-display)',
                fontSize: 'var(--portal-fs-xl)',
                fontWeight: 500,
                color,
                lineHeight: 1.1,
                marginTop: 6,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: t.mono ? '-0.02em' : '-0.01em',
                fontVariantNumeric: t.mono ? 'tabular-nums lining-nums' : 'normal',
              }}
            >
              {t.value}
            </div>
            {t.hint && (
              <div className="portal-meta" style={{ marginTop: 4 }}>
                {t.hint}
              </div>
            )}
          </>
        )

        const tileContent = (
          <PortalCard
            tier="hero"
            padding={'16px 20px'}
            style={{
              minHeight: 92,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              textAlign: 'left',
            }}
          >
            {inner}
          </PortalCard>
        )

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
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                width: '100%',
              }}
              aria-label={t.label}
            >
              {tileContent}
            </button>
          )
        }

        return <div key={t.id}>{tileContent}</div>
      })}
      <style precedence="default">{`
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
