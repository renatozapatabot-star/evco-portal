'use client'

import { Package, Truck, FileText, Clock } from 'lucide-react'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_PRIMARY, TEXT_MUTED, ACCENT_CYAN, GOLD, RED, GREEN,
} from '@/lib/design-system'
import type { KPIs } from './types'

interface Props {
  kpis: KPIs
  onFilter?: (key: keyof KPIs | null) => void
  active?: keyof KPIs | null
}

const cards: Array<{
  key: keyof KPIs
  label: string
  Icon: typeof Package
  color: string
}> = [
  { key: 'entradasHoy', label: 'Entradas hoy',         Icon: Package,  color: ACCENT_CYAN },
  { key: 'activos',     label: 'Tráficos activos',     Icon: Truck,    color: TEXT_PRIMARY },
  { key: 'pendientes',  label: 'Pedimentos pendientes',Icon: FileText, color: GOLD },
  { key: 'atrasados',   label: 'Atrasados >7d',        Icon: Clock,    color: RED },
]

export function HeroStrip({ kpis, onFilter, active }: Props) {
  return (
    <div
      className="inicio-hero"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 20,
      }}
    >
      <style>{`
        @media (max-width: 768px) {
          .inicio-hero { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
      {cards.map(({ key, label, Icon, color }) => {
        const value = kpis[key]
        const isActive = active === key
        const isZero = value === 0
        return (
          <button
            key={key}
            type="button"
            onClick={() => onFilter?.(isActive ? null : key)}
            aria-pressed={isActive}
            style={{
              background: BG_CARD,
              backdropFilter: `blur(${GLASS_BLUR})`,
              WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
              border: `1px solid ${isActive ? color : BORDER}`,
              borderRadius: 20,
              padding: '20px 18px',
              boxShadow: isActive
                ? `${GLASS_SHADOW}, 0 0 24px ${color}33`
                : GLASS_SHADOW,
              minHeight: 140,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              textAlign: 'left',
              color: TEXT_PRIMARY,
              transition: 'box-shadow 160ms ease, border-color 160ms ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Icon size={18} color={isZero ? TEXT_MUTED : color} />
              {key === 'atrasados' && value > 0 && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: RED,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>Urgente</span>
              )}
              {key === 'atrasados' && value === 0 && (
                <span style={{
                  fontSize: 9,
                  fontWeight: 800,
                  color: GREEN,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}>Sin atrasos</span>
              )}
            </div>
            <div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 64,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-0.03em',
                color: isZero ? TEXT_MUTED : color,
              }}>
                {value}
              </div>
              <div style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: TEXT_MUTED,
                marginTop: 8,
              }}>
                {label}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
