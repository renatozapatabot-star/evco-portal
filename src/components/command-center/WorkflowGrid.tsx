'use client'

import { useMemo } from 'react'
import { Truck, Package, FolderOpen, FileText, DollarSign, Warehouse, BarChart3 } from 'lucide-react'
import { WorkflowCard } from './WorkflowCard'
import { getCardUrgency, sortByUrgency, type CardKey, type CardKPIs } from '@/lib/card-urgency'

interface WorkflowGridProps {
  enProceso: number
  urgentes: number
  pendingEntradas: number
  docsFaltantes?: number
}

interface CardDef {
  key: CardKey
  href: string
  label: string
  Icon: typeof Truck
  getKpi: (props: WorkflowGridProps) => number | null
  getSubtitle: (props: WorkflowGridProps, urgency: string) => string
}

const CARDS: CardDef[] = [
  {
    key: 'traficos',
    href: '/traficos',
    label: 'Tráficos',
    Icon: Truck,
    getKpi: (p) => p.enProceso,
    getSubtitle: (p, u) => u === 'green' ? 'Todo en orden' : `${p.enProceso} en proceso`,
  },
  {
    key: 'entradas',
    href: '/entradas',
    label: 'Entradas',
    Icon: Package,
    getKpi: (p) => p.pendingEntradas,
    getSubtitle: (p, u) => u === 'green' ? 'Todo en orden' : `${p.pendingEntradas} sin asignar`,
  },
  {
    key: 'expedientes',
    href: '/expedientes',
    label: 'Expedientes',
    Icon: FolderOpen,
    getKpi: (p) => p.docsFaltantes ?? 0,
    getSubtitle: (_p, u) => u === 'green' ? 'Todo en orden' : 'Docs faltantes',
  },
  {
    key: 'pedimentos',
    href: '/pedimentos',
    label: 'Pedimentos',
    Icon: FileText,
    getKpi: () => null,
    getSubtitle: () => 'Declaraciones aduanales',
  },
  {
    key: 'contabilidad',
    href: '/financiero',
    label: 'Contabilidad',
    Icon: DollarSign,
    getKpi: () => 0,
    getSubtitle: (_p, u) => u === 'green' ? 'Sin pendientes' : 'Pendientes',
  },
  {
    key: 'inventario',
    href: '/bodega',
    label: 'Inventario',
    Icon: Warehouse,
    getKpi: () => null,
    getSubtitle: () => 'Mercancía en bodega',
  },
  {
    key: 'reportes',
    href: '/reportes',
    label: 'Reportes',
    Icon: BarChart3,
    getKpi: () => null,
    getSubtitle: () => 'Análisis y finanzas',
  },
]

export function WorkflowGrid(props: WorkflowGridProps) {
  const sorted = useMemo(() => {
    const kpis: CardKPIs = {
      enProceso: props.enProceso,
      urgentes: props.urgentes,
      pendingEntradas: props.pendingEntradas,
      docsFaltantes: props.docsFaltantes ?? 0,
    }
    const withUrgency = CARDS.map(card => ({
      ...card,
      urgency: getCardUrgency(card.key, kpis),
    }))
    return sortByUrgency(withUrgency)
  }, [props.enProceso, props.urgentes, props.pendingEntradas, props.docsFaltantes])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px' }}>
      {sorted.map((card, i) => (
        <WorkflowCard
          key={card.key}
          href={card.href}
          label={card.label}
          Icon={card.Icon}
          urgency={card.urgency}
          kpi={card.getKpi(props)}
          subtitle={card.getSubtitle(props, card.urgency)}
          delay={i * 50}
        />
      ))}
    </div>
  )
}
