'use client'

import { fmtUSDCompact } from '@/lib/format-utils'
import { ACCENT_CYAN, GOLD, GREEN, RED, TEXT_MUTED } from '@/lib/design-system'
import type { InicioData } from './types'

interface HeroTile {
  key: string
  icon: string
  label: string
  value: string
  accent: string
  href?: string
  scrollTo?: string
}

export function HeroStrip({ hero }: { hero: InicioData['hero'] }) {
  const tiles: HeroTile[] = [
    { key: 'clientes', icon: '🏢', label: 'Clientes activos', value: String(hero.clientes_activos), accent: ACCENT_CYAN, scrollTo: 'client-health' },
    { key: 'motion', icon: '📦', label: 'Tráficos en motion', value: String(hero.traficos_motion), accent: ACCENT_CYAN, scrollTo: 'client-health' },
    { key: 'pedimentos', icon: '📄', label: 'Pedimentos esta semana', value: String(hero.pedimentos_semana), accent: GREEN, scrollTo: 'client-health' },
    { key: 'valor', icon: '💰', label: 'Valor en tránsito', value: fmtUSDCompact(hero.valor_transito_usd), accent: GOLD, scrollTo: 'portfolio-pulse' },
    { key: 'riesgo', icon: '⚠️', label: 'En riesgo', value: String(hero.en_riesgo), accent: hero.en_riesgo > 0 ? RED : TEXT_MUTED, scrollTo: 'client-health' },
    { key: 'racha', icon: '⏰', label: 'Días sin rojo SAT', value: hero.dias_sin_rojo >= 999 ? '—' : String(hero.dias_sin_rojo), accent: GREEN, scrollTo: 'portfolio-pulse' },
  ]

  const scroll = (id?: string) => {
    if (!id) return
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
        gap: 12,
      }}
      className="inicio-hero-grid"
    >
      {tiles.map(t => (
        <button
          key={t.key}
          onClick={() => scroll(t.scrollTo)}
          style={{
            all: 'unset',
            cursor: 'pointer',
            minHeight: 140,
            padding: 20,
            borderRadius: 20,
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow:
              '0 10px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05), 0 0 1px rgba(0,229,255,0.12)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: 8,
            transition: 'all 120ms',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(0,229,255,0.25)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
          }}
          aria-label={t.label}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 18 }}>{t.icon}</span>
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
          </div>
          <div
            style={{
              fontFamily: 'var(--font-jetbrains-mono), JetBrains Mono, monospace',
              fontSize: 60,
              lineHeight: 1,
              fontWeight: 800,
              color: t.accent,
              fontVariantNumeric: 'tabular-nums',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {t.value}
          </div>
        </button>
      ))}
      <style jsx>{`
        @media (max-width: 900px) {
          :global(.inicio-hero-grid) {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  )
}
