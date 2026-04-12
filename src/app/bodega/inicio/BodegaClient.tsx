'use client'

/**
 * /bodega/inicio — warehouse cockpit for Vicente.
 *
 * Upload-first: a giant drag-drop hero dominates above the 8-card nav grid.
 * Matches the cinematic glass aesthetic (ClientHome / operator InicioClient).
 */

import { useMemo } from 'react'
import Link from 'next/link'
import {
  Package, Warehouse, HelpCircle, UploadCloud,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavCardGrid, type NavCardGridItem } from '@/components/NavCardGrid'
import { RoleKPIBanner } from '@/components/RoleKPIBanner'
import { getGreeting } from '@/lib/greeting'
import { CockpitBrandHeader } from '@/components/brand/CockpitBrandHeader'
import {
  ACCENT_CYAN,
  BORDER,
  GLASS_BLUR,
  GLASS_SHADOW,
  GLOW_CYAN,
  GLOW_CYAN_SUBTLE,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '@/lib/design-system'

interface BodegaKpis {
  entradasToday: number
  entradasWeek: number
  entradasLastWeek: number
  entradasThisWeek: number
  proximasEntradas: number
  enBodega: number
}

interface BodegaClientProps {
  operatorName: string
  kpis: BodegaKpis
}

interface BodegaTile {
  href: string
  label: string
  icon: LucideIcon
  description: string
  badgeKey?: keyof BodegaKpis
}

// V1 warehouse cockpit (Phase 4 cull) — only routes to V1-approved surfaces.
const TILES: BodegaTile[] = [
  { href: '/bodega/recibir',            label: 'Recibir',         icon: Package,      description: 'Registrar mercancía entrante', badgeKey: 'entradasToday' },
  { href: '/bodega/patio',              label: 'Patio',           icon: Warehouse,    description: 'Tráiler y ubicación en patio', badgeKey: 'enBodega' },
  { href: '/bodega/ayuda',              label: 'Ayuda',           icon: HelpCircle,   description: 'Cómo subir, qué llega hoy' },
]

export function BodegaClient({ operatorName, kpis }: BodegaClientProps) {
  const items = useMemo<NavCardGridItem[]>(
    () => TILES.map((tile) => {
      const count = tile.badgeKey ? kpis[tile.badgeKey] : null
      return {
        tile: {
          href: tile.href,
          label: tile.label,
          icon: tile.icon,
          description: tile.description,
        },
        count: typeof count === 'number' ? count : null,
      }
    }),
    [kpis],
  )

  const greeting = getGreeting(operatorName)

  return (
    <div style={{ padding: '8px 0', maxWidth: 1200, margin: '0 auto', color: TEXT_PRIMARY }}>
      {/* AGUILA brand trio */}
      <CockpitBrandHeader subtitle={`Bodega · ${operatorName}`} />

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{
          fontFamily: 'var(--font-geist-sans)',
          fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em',
          margin: 0, color: TEXT_PRIMARY,
        }}>
          {greeting}
        </h1>
        <p style={{
          fontSize: 14, color: TEXT_SECONDARY, marginTop: 4, marginBottom: 0, fontWeight: 500,
        }}>
          Semana:{' '}
          <span style={{
            fontFamily: 'var(--font-jetbrains-mono), var(--font-mono), monospace',
            color: TEXT_PRIMARY, fontWeight: 700,
          }}>
            {kpis.entradasThisWeek}
          </span>
          {' '}entradas
        </p>
      </div>

      {/* Positive KPI banner — only when this week > last week */}
      <RoleKPIBanner
        role="warehouse"
        name={operatorName}
        thisWeek={kpis.entradasThisWeek}
        lastWeek={kpis.entradasLastWeek}
        metricLabel="Entradas procesadas · últimos 7 días"
        celebrationTemplate={({ name, thisWeek, pct }) =>
          `¡${thisWeek} entrada${thisWeek === 1 ? '' : 's'} procesada${thisWeek === 1 ? '' : 's'} esta semana, ${name}! +${pct}% vs. semana pasada — buen ritmo.`
        }
      />

      {/* Hero drag-drop zone — the whole point of this cockpit */}
      <Link
        href="/bodega/subir"
        aria-label="Subir documentos — arrastra archivos o toca para abrir"
        style={{
          display: 'block',
          textDecoration: 'none',
          marginBottom: 20,
          maxWidth: 800,
        }}
      >
        <div
          style={{
            minHeight: 120,
            padding: '28px 24px',
            borderRadius: 20,
            border: `1.5px dashed ${ACCENT_CYAN}`,
            background: 'rgba(192,197,206,0.04)',
            backdropFilter: `blur(${GLASS_BLUR})`,
            WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
            boxShadow: `${GLASS_SHADOW}, 0 0 32px -8px ${GLOW_CYAN}, inset 0 0 0 1px ${GLOW_CYAN_SUBTLE}`,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            transition: 'background 150ms ease, box-shadow 150ms ease',
          }}
        >
          <div
            style={{
              width: 60, height: 60, borderRadius: 16,
              background: 'rgba(192,197,206,0.1)',
              border: `1px solid ${GLOW_CYAN}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <UploadCloud size={28} color={ACCENT_CYAN} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 18, fontWeight: 700, color: TEXT_PRIMARY,
              marginBottom: 4, lineHeight: 1.3,
            }}>
              Arrastra PDFs o fotos aquí
            </div>
            <div style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.5 }}>
              o envíalos a{' '}
              <span style={{
                fontFamily: 'var(--font-jetbrains-mono), var(--font-mono), monospace',
                color: ACCENT_CYAN, fontWeight: 600,
              }}>
                ai@renatozapata.com
              </span>
              {' '}— el clasificador los organiza automáticamente.
            </div>
          </div>
        </div>
      </Link>

      {/* 8-card nav grid */}
      <NavCardGrid items={items} />
    </div>
  )
}
