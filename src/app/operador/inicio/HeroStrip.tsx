'use client'

import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_PRIMARY, TEXT_MUTED, RED, AMBER,
} from '@/lib/design-system'
import type { KPIs } from './types'

interface Props {
  kpis: KPIs
}

const cards: Array<{
  key: keyof KPIs
  label: string
}> = [
  { key: 'entradasHoy', label: 'Entradas hoy' },
  { key: 'activos',     label: 'Tráficos activos' },
  { key: 'pendientes',  label: 'Pedimentos pendientes' },
  { key: 'atrasados',   label: 'Atrasados >7d' },
]

export function HeroStrip({ kpis }: Props) {
  return (
    <div
      className="inicio-hero"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
      }}
    >
      <style>{`
        @media (max-width: 1024px) {
          .inicio-hero { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
      {cards.map(({ key, label }) => {
        const value = kpis[key]
        const isAtrasado = key === 'atrasados'
        const urgent = isAtrasado && value > 0
        const numberColor = urgent ? RED : TEXT_PRIMARY
        return (
          <div
            key={key}
            style={{
              background: BG_CARD,
              backdropFilter: `blur(${GLASS_BLUR})`,
              WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
              border: `1px solid ${BORDER}`,
              borderRadius: 20,
              padding: '20px 18px',
              boxShadow: GLASS_SHADOW,
              minHeight: 120,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              color: TEXT_PRIMARY,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: TEXT_MUTED,
              }}>
                {label}
              </span>
              {urgent && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: AMBER,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>URGENTE</span>
              )}
            </div>
            <div style={{
              fontFamily: 'var(--font-jetbrains-mono), JetBrains Mono, monospace',
              fontSize: 48,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: '-0.03em',
              color: numberColor,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {value}
            </div>
          </div>
        )
      })}
    </div>
  )
}
