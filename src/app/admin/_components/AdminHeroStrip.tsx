'use client'

import { Check } from 'lucide-react'
import CountingNumber from '@/components/ui/CountingNumber'
import { BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW, RED, AMBER, GREEN, GOLD, TEXT_MUTED } from '@/lib/design-system'

interface AdminHeroStripProps {
  criticos: number
  urgentes: number
  normales: number
  decisionesHoy: number
}

const kpiConfig = [
  { key: 'criticos', label: 'Criticos', sublabel: '> 6h', color: RED },
  { key: 'urgentes', label: 'Urgentes', sublabel: '2–6h', color: AMBER },
  { key: 'normales', label: 'Normales', sublabel: '< 2h', color: GREEN },
  { key: 'decisiones', label: 'Decisiones hoy', sublabel: '', color: GOLD },
] as const

export function AdminHeroStrip({ criticos, urgentes, normales, decisionesHoy }: AdminHeroStripProps) {
  const values = { criticos, urgentes, normales, decisiones: decisionesHoy }
  const allClear = criticos === 0 && urgentes === 0

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: 12,
      marginBottom: 20,
    }}>
      <style>{`
        @media (max-width: 768px) {
          .admin-hero-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
      {kpiConfig.map((kpi) => {
        const value = values[kpi.key]
        const isCalmZero = (kpi.key === 'criticos' || kpi.key === 'urgentes') && allClear

        return (
          <div
            key={kpi.key}
            className="admin-hero-grid"
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
            {isCalmZero && kpi.key === 'criticos' ? (
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
              <CountingNumber
                value={value}
                sessionKey={`admin-hero-${kpi.key}`}
                style={{
                  fontSize: 64,
                  fontWeight: 800,
                  color: value > 0 ? kpi.color : TEXT_MUTED,
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                  marginBottom: 8,
                }}
              />
            )}
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: TEXT_MUTED,
            }}>
              {isCalmZero && kpi.key === 'criticos' ? 'Sin urgencias' : kpi.label}
            </div>
            {kpi.sublabel && !isCalmZero && (
              <div style={{ fontSize: 9, color: TEXT_MUTED, marginTop: 2, opacity: 0.6 }}>
                {kpi.sublabel}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
