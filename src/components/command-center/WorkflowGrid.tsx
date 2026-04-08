'use client'

import { useMemo } from 'react'
import { Truck, Package, FolderOpen, FileText, DollarSign, Warehouse, BarChart3 } from 'lucide-react'
import { WorkflowCard, type CardAction } from './WorkflowCard'
import { getCardUrgency, type CardKey, type CardKPIs, type Urgency } from '@/lib/card-urgency'

interface WorkflowGridProps {
  enProceso: number
  urgentes: number
  pendingEntradas: number
  docsFaltantes?: number
  inventarioBultos?: number
  inventarioPeso?: number
  pedimentosThisMonth?: number
  expedientesTotal?: number
  facturacionMes?: number
  cruzadosEsteMes?: number
  cruzadosHoy?: number
  isMobile?: boolean
}

interface CardDef {
  key: CardKey
  href: string
  label: string
  Icon: typeof Truck
  /** Desktop grid span (out of 12 cols) */
  span: number
  getKpi: (props: WorkflowGridProps) => number | null
  getSubtitle: (props: WorkflowGridProps, urgency: Urgency) => string
  getActions: (props: WorkflowGridProps, urgency: Urgency) => CardAction[]
}

const CARDS: CardDef[] = [
  {
    key: 'entradas', href: '/entradas', label: 'Entradas', Icon: Package, span: 3,
    getKpi: (p) => p.pendingEntradas,
    getSubtitle: (_p, u) => u === 'green' || u === 'neutral'
      ? 'Todo asignado — al corriente'
      : 'sin asignar — accion requerida',
    getActions: (_p, u) => u === 'green' || u === 'neutral'
      ? [{ label: 'Ver historial', href: '/entradas', primary: true }]
      : [{ label: 'Asignar ahora', href: '/entradas', primary: true }, { label: 'Ver lista', href: '/entradas' }],
  },
  {
    key: 'traficos', href: '/traficos', label: 'Tráficos', Icon: Truck, span: 3,
    getKpi: (p) => p.enProceso > 0 ? p.enProceso : (p.cruzadosEsteMes ?? 0),
    getSubtitle: (p, u) => {
      if (u === 'red' || u === 'amber') return 'en proceso — monitorear'
      const mes = p.cruzadosEsteMes ?? 0
      return mes > 0 ? 'cruzados este mes — excelente' : 'sin operaciones activas'
    },
    getActions: (_p, u) => u === 'green' || u === 'neutral'
      ? [{ label: 'Ver todos', href: '/traficos', primary: true }]
      : [{ label: 'Ver en mapa', href: '/traficos' }, { label: 'Procesar', href: '/traficos?estatus=En+Proceso', primary: true }],
  },
  {
    key: 'expedientes', href: '/expedientes', label: 'Expedientes', Icon: FolderOpen, span: 3,
    getKpi: (p) => {
      const faltantes = p.docsFaltantes ?? 0
      if (faltantes > 0) return faltantes
      return p.expedientesTotal ?? 0
    },
    getSubtitle: (_p, u) => {
      if (u === 'amber' || u === 'red') return 'docs faltantes — completar'
      return 'expedientes completos'
    },
    getActions: () => [{ label: 'Ver todos', href: '/expedientes', primary: true }],
  },
  {
    key: 'pedimentos', href: '/pedimentos', label: 'Pedimentos', Icon: FileText, span: 3,
    getKpi: (p) => p.pedimentosThisMonth ?? 0,
    getSubtitle: (p) => {
      const n = p.pedimentosThisMonth ?? 0
      return n > 0 ? 'este mes — operaciones activas' : 'sin declaraciones pendientes'
    },
    getActions: () => [{ label: 'Ver todos', href: '/pedimentos', primary: true }],
  },
  {
    key: 'contabilidad', href: '/financiero', label: 'Contabilidad', Icon: DollarSign, span: 4,
    getKpi: (p) => {
      const val = p.facturacionMes ?? 0
      return val > 0 ? Math.round(val) : 0
    },
    getSubtitle: (p) => {
      const val = p.facturacionMes ?? 0
      if (val > 0) return 'USD facturado este mes'
      return 'Sin movimientos — todo al corriente'
    },
    getActions: () => [{ label: 'Ver detalle', href: '/financiero', primary: true }],
  },
  {
    key: 'inventario', href: '/bodega', label: 'Inventario', Icon: Warehouse, span: 4,
    getKpi: (p) => p.inventarioBultos ?? 0,
    getSubtitle: (p) => {
      const bultos = p.inventarioBultos ?? 0
      const tons = p.inventarioPeso ?? 0
      if (bultos > 0 && tons > 0) return `bultos · ${tons.toFixed(1)} ton — en bodega`
      if (bultos > 0) return 'bultos en bodega'
      return 'Bodega disponible — sin mercancia'
    },
    getActions: () => [{ label: 'Ver bodega', href: '/bodega', primary: true }],
  },
  {
    key: 'reportes', href: '/reportes', label: 'Reportes', Icon: BarChart3, span: 4,
    getKpi: (p) => p.cruzadosHoy ?? 0,
    getSubtitle: (p) => {
      const hoy = p.cruzadosHoy ?? 0
      return hoy > 0 ? 'cruzados hoy — en movimiento' : 'Sin cruces hoy — todo fluye'
    },
    getActions: () => [{ label: 'Abrir reportes', href: '/reportes', primary: true }],
  },
]

export function WorkflowGrid(props: WorkflowGridProps) {
  const isMobile = props.isMobile ?? false

  const allCards = useMemo(() => {
    const kpis: CardKPIs = {
      enProceso: props.enProceso,
      urgentes: props.urgentes,
      pendingEntradas: props.pendingEntradas,
      docsFaltantes: props.docsFaltantes ?? 0,
    }
    return CARDS.map(card => ({ ...card, urgency: getCardUrgency(card.key, kpis) }))
  }, [props.enProceso, props.urgentes, props.pendingEntradas, props.docsFaltantes])

  if (isMobile) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridAutoRows: '1fr',
        gap: 12,
        width: '100%',
      }}>
        {allCards.map((card, i) => (
          <WorkflowCard
            key={card.key}
            href={card.href}
            label={card.label}
            Icon={card.Icon}
            kpi={card.getKpi(props)}
            subtitle={card.getSubtitle(props, card.urgency)}
            variant="uniform"
            actions={card.getActions(props, card.urgency)}
            delay={i * 60}
            spanFull={i === allCards.length - 1 && allCards.length % 2 !== 0}
          />
        ))}
      </div>
    )
  }

  // Desktop: 12-column grid — row 1 (4×3), row 2 (3×4)
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(12, 1fr)',
      gridAutoRows: '1fr',
      gap: 16,
      width: '100%',
    }}>
      {allCards.map((card, i) => (
        <div key={card.key} style={{ gridColumn: `span ${card.span}` }}>
          <WorkflowCard
            href={card.href}
            label={card.label}
            Icon={card.Icon}
            kpi={card.getKpi(props)}
            subtitle={card.getSubtitle(props, card.urgency)}
            variant="uniform"
            actions={card.getActions(props, card.urgency)}
            delay={i * 60}
          />
        </div>
      ))}
    </div>
  )
}
