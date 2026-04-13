'use client'

import { fmtUSDCompact } from '@/lib/format-utils'
import { GOLD, TEXT_PRIMARY, TEXT_MUTED } from '@/lib/design-system'
import type { InicioData } from './types'

interface HeroTile {
  key: string
  label: string
  value: string
  color: string
  mono: boolean
}

export function HeroStrip({ hero }: { hero: InicioData['hero'] }) {
  const tiles: HeroTile[] = [
    { key: 'clientes', label: 'Clientes activos', value: String(hero.clientes_activos), color: TEXT_PRIMARY, mono: true },
    { key: 'motion', label: 'Embarques en motion', value: String(hero.traficos_motion), color: TEXT_PRIMARY, mono: true },
    { key: 'pedimentos', label: 'Pedimentos esta semana', value: String(hero.pedimentos_semana), color: TEXT_PRIMARY, mono: true },
    { key: 'valor', label: 'Valor en tránsito', value: fmtUSDCompact(hero.valor_transito_usd), color: GOLD, mono: true },
  ]

  return (
    <div
      className="inicio-hero-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: 12,
      }}
    >
      {tiles.map(t => (
        <div
          key={t.key}
          style={{
            minHeight: 120,
            padding: 20,
            borderRadius: 20,
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow:
              '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 1px rgba(192,197,206,0.12)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 10,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: TEXT_MUTED,
            }}
          >
            {t.label}
          </span>
          <div
            style={{
              fontFamily: t.mono ? 'var(--font-jetbrains-mono), JetBrains Mono, monospace' : 'inherit',
              fontSize: 48,
              lineHeight: 1,
              fontWeight: 800,
              color: t.color,
              fontVariantNumeric: 'tabular-nums',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {t.value}
          </div>
        </div>
      ))}
      <style jsx>{`
        @media (max-width: 1024px) {
          :global(.inicio-hero-grid) {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  )
}
