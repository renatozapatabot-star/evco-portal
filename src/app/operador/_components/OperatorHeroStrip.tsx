'use client'

import { Check } from 'lucide-react'
import CountingNumber from '@/components/ui/CountingNumber'
import { BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW, RED, GREEN, GOLD, TEXT_PRIMARY, TEXT_MUTED } from '@/lib/design-system'

interface OperatorHeroStripProps {
  urgentes: number
  normales: number
  completadasHoy: number
  racha: number
}

const kpiConfig = [
  { key: 'urgentes', label: 'Urgentes en cola', color: RED },
  { key: 'normales', label: 'Normales', color: TEXT_PRIMARY },
  { key: 'completadas', label: 'Completadas hoy', color: GREEN },
  { key: 'racha', label: 'Tu racha', color: GOLD, suffix: 'dias' },
] as const

export function OperatorHeroStrip({ urgentes, normales, completadasHoy, racha }: OperatorHeroStripProps) {
  const values = { urgentes, normales, completadas: completadasHoy, racha }
  const colaDespejada = urgentes === 0

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 12,
      marginBottom: 20,
    }}>
      <style>{`
        @media (max-width: 768px) {
          .op-hero-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
      {kpiConfig.map((kpi) => {
        const value = values[kpi.key]
        const isCalmZero = kpi.key === 'urgentes' && colaDespejada

        return (
          <div
            key={kpi.key}
            className="op-hero-grid"
            style={{
              background: BG_CARD,
              backdropFilter: `blur(${GLASS_BLUR})`,
              WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
              border: `1px solid ${BORDER}`,
              borderRadius: 20,
              padding: '24px 20px',
              boxShadow: GLASS_SHADOW,
              textAlign: 'center',
              minHeight: 120,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {isCalmZero ? (
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(34,197,94,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 8,
              }}>
                <Check size={24} color={GREEN} />
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <CountingNumber
                  value={value}
                  sessionKey={`op-hero-${kpi.key}`}
                  style={{
                    fontSize: 64,
                    fontWeight: 800,
                    color: value > 0 ? kpi.color : TEXT_MUTED,
                    letterSpacing: '-0.03em',
                    lineHeight: 1,
                  }}
                />
                {'suffix' in kpi && kpi.suffix && value > 0 && (
                  <span style={{ fontSize: 14, fontWeight: 600, color: TEXT_MUTED }}>
                    {kpi.suffix}
                  </span>
                )}
              </div>
            )}
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: TEXT_MUTED,
              marginTop: 8,
            }}>
              {isCalmZero ? 'Cola despejada' : kpi.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}
