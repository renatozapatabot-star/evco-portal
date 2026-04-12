'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  Truck, FileText, AlertTriangle, Tags, CalendarClock, Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, RED, GOLD,
} from '@/lib/design-system'
import { ActiveTraficosTable } from '@/components/ActiveTraficosTable'
import type { TraficoRow } from './types'

interface Props {
  rows: TraficoRow[]
  onRefresh?: () => void
}

interface Tile {
  href: string
  label: string
  description: string
  icon: LucideIcon
  count: number
  tone: 'muted' | 'action' | 'overdue'
}

export function ActiveTraficos({ rows, onRefresh }: Props) {
  const overdueCount = useMemo(() => {
    const now = Date.now()
    return rows.filter(r => {
      if (!r.updated_at) return false
      return (now - new Date(r.updated_at).getTime()) / 86400000 > 7
    }).length
  }, [rows])

  const pendingPedimentoCount = useMemo(
    () => rows.filter(r => !r.pedimento).length,
    [rows]
  )

  const tiles: Tile[] = [
    {
      href: '/traficos?estatus=En+Proceso',
      label: 'Tráficos activos',
      description: 'En motion ahora',
      icon: Truck,
      count: rows.length,
      tone: rows.length > 0 ? 'action' : 'muted',
    },
    {
      href: '/operador/cola',
      label: 'Cola de excepciones',
      description: 'Requieren revisión',
      icon: AlertTriangle,
      count: overdueCount,
      tone: overdueCount > 0 ? 'overdue' : 'muted',
    },
    {
      href: '/traficos?sin_pedimento=1',
      label: 'Pedimentos pendientes',
      description: 'Sin pedimento',
      icon: FileText,
      count: pendingPedimentoCount,
      tone: pendingPedimentoCount > 0 ? 'action' : 'muted',
    },
    {
      href: '/clasificar-producto',
      label: 'Clasificaciones',
      description: 'Productos por clasificar',
      icon: Tags,
      count: 0,
      tone: 'muted',
    },
    {
      href: '/operador/mi-dia',
      label: 'Mi día',
      description: 'Plan y tareas',
      icon: CalendarClock,
      count: 0,
      tone: 'muted',
    },
    {
      href: '/operador/equipo',
      label: 'Equipo',
      description: 'Estado del turno',
      icon: Users,
      count: 0,
      tone: 'muted',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Entity card grid */}
      <div
        className="oper-nav-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
        }}
      >
        {tiles.map(t => <NavTile key={t.href} tile={t} />)}
        <style>{`
          @media (max-width: 640px) {
            .oper-nav-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>

      <ActiveTraficosTable rows={rows} scope="operator" onRefresh={onRefresh} />
    </div>
  )
}

function NavTile({ tile }: { tile: Tile }) {
  const Icon = tile.icon
  const countColor =
    tile.tone === 'overdue' ? RED :
    tile.tone === 'action' ? GOLD :
    TEXT_MUTED
  return (
    <Link
      href={tile.href}
      style={{
        display: 'block',
        padding: 18,
        borderRadius: 20,
        background: BG_CARD,
        backdropFilter: `blur(${GLASS_BLUR})`,
        WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
        border: `1px solid ${BORDER}`,
        boxShadow: GLASS_SHADOW,
        textDecoration: 'none',
        color: 'inherit',
        transition: 'all 120ms',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(192,197,206,0.2)'
        e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = BORDER
        e.currentTarget.style.background = BG_CARD
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Icon size={18} color={TEXT_SECONDARY} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: TEXT_PRIMARY,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {tile.label}
            </div>
            <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>
              {tile.description}
            </div>
          </div>
        </div>
        <span style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: 22, fontWeight: 800,
          color: countColor,
          fontVariantNumeric: 'tabular-nums',
          flexShrink: 0,
        }}>
          {tile.count}
        </span>
      </div>
    </Link>
  )
}
