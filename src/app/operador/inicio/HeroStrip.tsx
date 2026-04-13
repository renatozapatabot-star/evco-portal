'use client'

import { KPITile } from '@/components/aguila'
import type { KPIs } from './types'

interface Props {
  kpis: KPIs
}

export function HeroStrip({ kpis }: Props) {
  const tiles = [
    {
      key: 'entradas',
      label: 'Entradas hoy',
      value: kpis.entradasHoy,
      series: kpis.entradasSeries,
      current: kpis.entradasCurr7,
      previous: kpis.entradasPrev7,
      href: '/operador/entradas?range=hoy',
      tone: 'silver' as const,
      inverted: false,
    },
    {
      key: 'activos',
      label: 'Tráficos activos',
      value: kpis.activos,
      series: kpis.activosSeries,
      current: kpis.activosCurr7,
      previous: kpis.activosPrev7,
      href: '/traficos?estatus=En+Proceso',
      tone: 'silver' as const,
      inverted: false,
    },
    {
      key: 'pendientes',
      label: 'Pedimentos pendientes',
      value: kpis.pendientes,
      series: kpis.pendientesSeries,
      current: kpis.pendientesCurr7,
      previous: kpis.pendientesPrev7,
      href: '/pedimentos?estatus=borrador',
      tone: 'silver' as const,
      inverted: true,
    },
    {
      key: 'atrasados',
      label: 'Atrasados >7d',
      value: kpis.atrasados,
      series: kpis.atrasadosSeries,
      current: kpis.atrasadosCurr7,
      previous: kpis.atrasadosPrev7,
      href: '/traficos?atrasados=7d',
      tone: 'silver' as const,
      urgent: kpis.atrasados > 0,
      inverted: true,
    },
  ]

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
      {tiles.map((t) => (
        <KPITile
          key={t.key}
          label={t.label}
          value={t.value}
          series={t.series}
          current={t.current}
          previous={t.previous}
          href={t.href}
          tone={t.tone}
          urgent={t.urgent}
          inverted={t.inverted}
        />
      ))}
    </div>
  )
}
