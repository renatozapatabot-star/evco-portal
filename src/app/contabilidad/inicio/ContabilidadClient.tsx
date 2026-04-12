'use client'

/**
 * /contabilidad/inicio — accounting cockpit for Anabel.
 *
 * Pendency-first: triple counter in the header tells her exactly what is
 * waiting. 8 glass cards route her into the workflows she owns.
 */

import { useMemo } from 'react'
import {
  FileText, DollarSign, CreditCard,
  Calendar, Download,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { NavCardGrid, type NavCardGridItem } from '@/components/NavCardGrid'
import { RoleKPIBanner } from '@/components/RoleKPIBanner'
import { getGreeting } from '@/lib/greeting'
import { TEXT_PRIMARY, TEXT_SECONDARY } from '@/lib/design-system'

interface ContabilidadKpis {
  pendientesFacturar: number
  cxCobrar: number
  cxPagar: number
  morososCount: number
  facturasMes: number
  thisWeekOverdue: number
  lastWeekOverdue: number
}

interface ContabilidadClientProps {
  operatorName: string
  kpis: ContabilidadKpis
}

interface ContabilidadTile {
  href: string
  label: string
  icon: LucideIcon
  description: string
  badgeKey?: keyof ContabilidadKpis
}

// V1 contabilidad cockpit (Phase 4 cull) — only routes to V1-approved surfaces.
const TILES: ContabilidadTile[] = [
  { href: '/facturacion?estatus=pendiente', label: 'Pendientes de facturar', icon: FileText,    description: 'Tráficos cruzados sin factura',  badgeKey: 'pendientesFacturar' },
  { href: '/cobranzas',                     label: 'Cuentas por cobrar',     icon: DollarSign,  description: 'Facturas emitidas no pagadas',    badgeKey: 'cxCobrar' },
  { href: '/pagos',                         label: 'Cuentas por pagar',      icon: CreditCard,  description: 'Proveedores + DTA/IGI/IVA',       badgeKey: 'cxPagar' },
  { href: '/facturacion?mes=actual',        label: 'Facturas del mes',       icon: Calendar,    description: 'Emitidas este mes',               badgeKey: 'facturasMes' },
  { href: '/contabilidad/exportar',         label: 'Exportar contabilidad',  icon: Download,    description: 'CSV / Excel' },
]

export function ContabilidadClient({ operatorName, kpis }: ContabilidadClientProps) {
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
  const { pendientesFacturar, cxCobrar, cxPagar, thisWeekOverdue, lastWeekOverdue } = kpis

  return (
    <div style={{ padding: '8px 0', maxWidth: 1200, margin: '0 auto', color: TEXT_PRIMARY }}>
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
          Pendientes:{' '}
          <span style={{
            fontFamily: 'var(--font-jetbrains-mono), var(--font-mono), monospace',
            color: TEXT_PRIMARY, fontWeight: 700,
          }}>
            {pendientesFacturar}
          </span>
          {' '}factura{pendientesFacturar === 1 ? '' : 's'} ·{' '}
          <span style={{
            fontFamily: 'var(--font-jetbrains-mono), var(--font-mono), monospace',
            color: TEXT_PRIMARY, fontWeight: 700,
          }}>
            {cxCobrar}
          </span>
          {' '}cobranza{cxCobrar === 1 ? '' : 's'} ·{' '}
          <span style={{
            fontFamily: 'var(--font-jetbrains-mono), var(--font-mono), monospace',
            color: TEXT_PRIMARY, fontWeight: 700,
          }}>
            {cxPagar}
          </span>
          {' '}pago{cxPagar === 1 ? '' : 's'}
        </p>
      </div>

      {/* Positive KPI banner — celebrates reduction in overdue count week-over-week. */}
      <RoleKPIBanner
        role="contabilidad"
        name={operatorName}
        thisWeek={thisWeekOverdue}
        lastWeek={lastWeekOverdue}
        metricDirection="decrease"
        metricLabel="Morosos resueltos · últimos 7 días"
        celebrationTemplate={({ name, delta }) =>
          `Cobranzas al día, ${name} — ${delta} menos pendiente${delta === 1 ? '' : 's'} vs. semana pasada.`
        }
      />


      {/* 8-card nav grid */}
      <NavCardGrid items={items} />
    </div>
  )
}
