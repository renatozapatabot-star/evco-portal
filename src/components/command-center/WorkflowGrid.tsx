'use client'

import { useMemo } from 'react'
import { Truck, Package, FolderOpen, FileText, DollarSign, Warehouse, BarChart3, TrendingUp, CheckCircle, ClipboardList } from 'lucide-react'
import { WorkflowCard, type CardAction } from './WorkflowCard'
import { getCardUrgency, type CardKey, type CardKPIs, type Urgency } from '@/lib/card-urgency'
import { fmtDateTime } from '@/lib/format-utils'
import type { CommandCenterData } from '@/hooks/use-command-center-data'

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
  exchangeRate?: number | null
  exchangeRateDate?: string | null
  lastCrossing?: { trafico: string; fecha: string; id?: string } | null
  docsPendientes?: number
  isMobile?: boolean
  viewMode?: 'client' | 'operator'
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
  // ── Row 1: Operations ──
  {
    key: 'entradas', href: '/entradas', label: 'Entradas', Icon: Package,
    getKpi: (p) => p.pendingEntradas,
    getSubtitle: (p, u) => {
      if (p.viewMode === 'client') return u === 'green' || u === 'neutral' ? 'Todo al corriente' : 'recibidas esta semana'
      return u === 'green' || u === 'neutral' ? 'Todo asignado — al corriente' : 'sin asignar — accion requerida'
    },
    getActions: (p, u) => {
      if (p.viewMode === 'client') return [{ label: 'Ver lista', href: '/entradas', primary: true }]
      return u === 'green' || u === 'neutral'
        ? [{ label: 'Ver historial', href: '/entradas', primary: true }]
        : [{ label: 'Asignar ahora', href: '/entradas', primary: true }, { label: 'Ver lista', href: '/entradas' }]
    },
  },
  {
    key: 'traficos', href: '/traficos', label: 'Tráficos', Icon: Truck,
    getKpi: (p) => p.enProceso > 0 ? p.enProceso : (p.cruzadosEsteMes ?? 0),
    getSubtitle: (p, u) => {
      if (p.viewMode === 'client') {
        if (u === 'red' || u === 'amber') return 'envíos en tránsito'
        const mes = p.cruzadosEsteMes ?? 0
        return mes > 0 ? 'cruzados este mes' : 'sin operaciones activas'
      }
      if (u === 'red' || u === 'amber') return 'en proceso — monitorear'
      const mes = p.cruzadosEsteMes ?? 0
      return mes > 0 ? 'cruzados este mes — excelente' : 'sin operaciones activas'
    },
    getActions: (p, u) => {
      if (p.viewMode === 'client') return [{ label: 'Ver todos', href: '/traficos', primary: true }]
      return u === 'green' || u === 'neutral'
        ? [{ label: 'Ver todos', href: '/traficos', primary: true }]
        : [{ label: 'Ver en mapa', href: '/traficos' }, { label: 'Procesar', href: '/traficos?estatus=En+Proceso', primary: true }]
    },
  },
  {
    key: 'expedientes', href: '/expedientes', label: 'Expedientes', Icon: FolderOpen,
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
    key: 'pedimentos', href: '/pedimentos', label: 'Pedimentos', Icon: FileText,
    getKpi: (p) => p.pedimentosThisMonth ?? 0,
    getSubtitle: (p) => {
      const n = p.pedimentosThisMonth ?? 0
      return n > 0 ? 'este mes — operaciones activas' : 'sin declaraciones pendientes'
    },
    getActions: () => [{ label: 'Ver todos', href: '/pedimentos', primary: true }],
  },
  // ── Row 2: Business ──
  {
    key: 'contabilidad', href: '/financiero', label: 'Contabilidad', Icon: DollarSign,
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
    key: 'inventario', href: '/bodega', label: 'Inventario', Icon: Warehouse,
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
    key: 'reportes', href: '/reportes', label: 'Reportes', Icon: BarChart3,
    getKpi: (p) => p.cruzadosHoy ?? 0,
    getSubtitle: (p) => {
      const hoy = p.cruzadosHoy ?? 0
      return hoy > 0 ? 'cruzados hoy — en movimiento' : 'Sin cruces hoy — todo fluye'
    },
    getActions: () => [{ label: 'Abrir reportes', href: '/reportes', primary: true }],
  },
  {
    key: 'tipo_cambio', href: '/financiero', label: 'Tipo de Cambio', Icon: TrendingUp,
    getKpi: (p) => p.exchangeRate ?? 0,
    getSubtitle: (p) => {
      if (!p.exchangeRate) return 'Sin datos — verificar'
      return 'MXN/USD — Banxico FIX'
    },
    getActions: () => [{ label: 'Ver historico', href: '/financiero', primary: true }],
  },
  // ── Row 3: Intelligence ──
  {
    key: 'ultimo_cruce', href: '/traficos', label: 'Ultimo Cruce', Icon: CheckCircle,
    getKpi: () => null,
    getSubtitle: (p) => {
      if (!p.lastCrossing) return 'Sin cruces registrados'
      const trafico = p.viewMode === 'client'
        ? p.lastCrossing.trafico.replace(/^\d+-/, '') // Strip patente prefix for clients
        : p.lastCrossing.trafico
      return `${trafico} — ${fmtDateTime(p.lastCrossing.fecha)}`
    },
    getActions: (p) => {
      const id = p.lastCrossing?.id
      return [{ label: 'Ver trafico', href: id ? `/traficos/${id}` : '/traficos', primary: true }]
    },
  },
  {
    key: 'docs_pendientes', href: '/expedientes', label: 'Docs Pendientes', Icon: ClipboardList,
    getKpi: (p) => p.docsPendientes ?? 0,
    getSubtitle: (_p, u) => {
      if (u === 'amber') return 'traficos sin pedimento — completar'
      return 'Todo recibido — al corriente'
    },
    getActions: () => [{ label: 'Ver pendientes', href: '/expedientes', primary: true }],
  },
]

export function WorkflowGrid(props: WorkflowGridProps) {
  const isMobile = props.isMobile ?? false
  const isClient = props.viewMode === 'client'

  // Cards hidden from clients (operator-only intelligence)
  const CLIENT_HIDDEN_CARDS: CardKey[] = ['docs_pendientes']

  const allCards = useMemo(() => {
    const kpis: CardKPIs = {
      enProceso: props.enProceso,
      urgentes: props.urgentes,
      pendingEntradas: props.pendingEntradas,
      docsFaltantes: props.docsFaltantes ?? 0,
    }
    return CARDS
      .filter(card => !(isClient && CLIENT_HIDDEN_CARDS.includes(card.key)))
      .map(card => ({
        ...card,
        urgency: getCardUrgency(card.key, kpis),
      }))
  }, [props.enProceso, props.urgentes, props.pendingEntradas, props.docsFaltantes])

  if (isMobile) {
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gridAutoRows: '1fr',
        gap: 8,
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
            urgency={card.urgency}
            delay={i * 40}
          />
        ))}
      </div>
    )
  }

  // Desktop: 12-col adaptive grid — critical cards span 6, others span 3
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(12, 1fr)',
      gridAutoRows: '1fr',
      gap: 16,
      width: '100%',
      flex: 1,
    }}>
      {allCards.map((card, i) => {
        const span = (card.urgency === 'red' || card.urgency === 'amber') ? 6 : 3
        return (
          <div key={card.key} style={{ gridColumn: `span ${span}` }}>
            <WorkflowCard
              href={card.href}
              label={card.label}
              Icon={card.Icon}
              kpi={card.getKpi(props)}
              subtitle={card.getSubtitle(props, card.urgency)}
              variant="uniform"
              actions={card.getActions(props, card.urgency)}
              urgency={card.urgency}
              delay={i * 40}
            />
          </div>
        )
      })}
    </div>
  )
}
