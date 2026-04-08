'use client'

import { useMemo } from 'react'
import { Truck, Package, FolderOpen, FileText, DollarSign, Warehouse, BarChart3 } from 'lucide-react'
import { WorkflowCard, type CardAction } from './WorkflowCard'
import { getCardUrgency, type CardKey, type CardKPIs, type Urgency } from '@/lib/card-urgency'
import { useIsMobile } from '@/hooks/use-mobile'

interface WorkflowGridProps {
  enProceso: number
  urgentes: number
  pendingEntradas: number
  docsFaltantes?: number
  inventarioBultos?: number
}

interface CardDef {
  key: CardKey
  href: string
  label: string
  Icon: typeof Truck
  getKpi: (props: WorkflowGridProps) => number | null
  getSubtitle: (props: WorkflowGridProps, urgency: Urgency) => string
  getActions: (props: WorkflowGridProps, urgency: Urgency) => CardAction[]
}

const CARDS: CardDef[] = [
  {
    key: 'traficos',
    href: '/traficos',
    label: 'Tráficos',
    Icon: Truck,
    getKpi: (p) => p.enProceso,
    getSubtitle: (p, u) => u === 'green' ? 'Todo en orden' : 'en proceso',
    getActions: (_p, u) => u === 'green' || u === 'neutral'
      ? [{ label: 'Ver todos', href: '/traficos', primary: true }]
      : [
          { label: 'Ver en mapa', href: '/traficos' },
          { label: 'Procesar', href: '/traficos?estatus=En+Proceso', primary: true },
        ],
  },
  {
    key: 'entradas',
    href: '/entradas',
    label: 'Entradas',
    Icon: Package,
    getKpi: (p) => p.pendingEntradas,
    getSubtitle: (p, u) => u === 'green' ? 'Todo en orden' : 'sin asignar',
    getActions: (_p, u) => u === 'green' || u === 'neutral'
      ? [{ label: 'Ver todos', href: '/entradas', primary: true }]
      : [
          { label: 'Asignar ahora', href: '/entradas', primary: true },
          { label: 'Ver lista completa', href: '/entradas' },
        ],
  },
  {
    key: 'expedientes',
    href: '/expedientes',
    label: 'Expedientes',
    Icon: FolderOpen,
    getKpi: (p) => p.docsFaltantes ?? 0,
    getSubtitle: (_p, u) => u === 'green' ? 'Todo en orden' : 'Docs faltantes',
    getActions: () => [{ label: 'Ver todos', href: '/expedientes', primary: true }],
  },
  {
    key: 'pedimentos',
    href: '/pedimentos',
    label: 'Pedimentos',
    Icon: FileText,
    getKpi: () => null,
    getSubtitle: () => 'Declaraciones aduanales',
    getActions: () => [{ label: 'Ver todos', href: '/pedimentos', primary: true }],
  },
  {
    key: 'contabilidad',
    href: '/financiero',
    label: 'Contabilidad',
    Icon: DollarSign,
    getKpi: () => 0,
    getSubtitle: (_p, u) => u === 'green' ? 'Sin pendientes' : 'Pendientes',
    getActions: () => [{ label: 'Ver todos', href: '/financiero', primary: true }],
  },
  {
    key: 'inventario',
    href: '/bodega',
    label: 'Inventario',
    Icon: Warehouse,
    getKpi: (p) => p.inventarioBultos ?? null,
    getSubtitle: (p) => p.inventarioBultos ? 'bultos en bodega' : 'Mercancía en bodega',
    getActions: () => [{ label: 'Ver bodega', href: '/bodega', primary: true }],
  },
  {
    key: 'reportes',
    href: '/reportes',
    label: 'Reportes',
    Icon: BarChart3,
    getKpi: () => null,
    getSubtitle: () => 'Análisis y finanzas',
    getActions: () => [{ label: 'Abrir reportes', href: '/reportes', primary: true }],
  },
]

export function WorkflowGrid(props: WorkflowGridProps) {
  const isMobile = useIsMobile()

  const { urgencyCards, healthyCards } = useMemo(() => {
    const kpis: CardKPIs = {
      enProceso: props.enProceso,
      urgentes: props.urgentes,
      pendingEntradas: props.pendingEntradas,
      docsFaltantes: props.docsFaltantes ?? 0,
    }

    const all = CARDS.map(card => ({
      ...card,
      urgency: getCardUrgency(card.key, kpis),
    }))

    return {
      urgencyCards: all.filter(c => c.urgency === 'red' || c.urgency === 'amber'),
      healthyCards: all.filter(c => c.urgency === 'green' || c.urgency === 'neutral'),
    }
  }, [props.enProceso, props.urgentes, props.pendingEntradas, props.docsFaltantes])

  return (
    <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Tier 1: Large dark urgency cards */}
      {urgencyCards.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : `repeat(${Math.min(urgencyCards.length, 2)}, 1fr)`,
          gap: 16,
        }}>
          {urgencyCards.map((card, i) => (
            <WorkflowCard
              key={card.key}
              href={card.href}
              label={card.label}
              Icon={card.Icon}
              kpi={card.getKpi(props)}
              subtitle={card.getSubtitle(props, card.urgency)}
              variant="large"
              actions={card.getActions(props, card.urgency)}
              delay={i * 80}
            />
          ))}
        </div>
      )}

      {/* Tier 2: Small light healthy cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile
          ? 'repeat(2, 1fr)'
          : `repeat(${Math.min(healthyCards.length, 5)}, 1fr)`,
        gap: 12,
      }}>
        {healthyCards.map((card, i) => (
          <WorkflowCard
            key={card.key}
            href={card.href}
            label={card.label}
            Icon={card.Icon}
            kpi={card.getKpi(props)}
            subtitle={card.getSubtitle(props, card.urgency)}
            variant="small"
            actions={card.getActions(props, card.urgency)}
            delay={(urgencyCards.length * 80) + (i * 60)}
          />
        ))}
      </div>
    </div>
  )
}
