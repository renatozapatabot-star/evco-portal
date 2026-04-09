'use client'

import { useMemo } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Truck, Package, FolderOpen, FileText, DollarSign, Warehouse, BarChart3, TrendingUp, CheckCircle, ClipboardList, Navigation, LineChart, PiggyBank, Radio, Tags, FileSpreadsheet, Archive } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { WorkflowCard, type CardAction } from './WorkflowCard'
import { getCardUrgency, getUrgencyIntensity, INTENSITY_CSS_CLASS, sortByUrgency, type CardKey, type CardKPIs, type Urgency } from '@/lib/card-urgency'
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
  oldestUrgentDate?: string | null
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
      const n = p.pendingEntradas
      if (p.viewMode === 'client') return u === 'green' || u === 'neutral' ? 'Todo al corriente — sin pendientes' : `${n} sin tráfico asignado · revisar`
      return u === 'green' || u === 'neutral' ? 'Todo asignado — al corriente' : `${n} sin asignar — acción requerida`
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
        if (u === 'red' || u === 'amber') return `${p.enProceso} en tránsito · seguimiento activo`
        const mes = p.cruzadosEsteMes ?? 0
        return mes > 0 ? `${mes} cruzados este mes — todo fluye` : 'Sin operaciones activas — todo en orden'
      }
      if (u === 'red' || u === 'amber') return `${p.enProceso} en proceso · ${p.urgentes} urgente${p.urgentes !== 1 ? 's' : ''}`
      const mes = p.cruzadosEsteMes ?? 0
      return mes > 0 ? `${mes} cruzados este mes — excelente` : 'Sin operaciones activas'
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
    getSubtitle: (p, u) => {
      const faltantes = p.docsFaltantes ?? 0
      if (u === 'amber' || u === 'red') return `${faltantes} tráfico${faltantes !== 1 ? 's' : ''} sin pedimento · completar docs`
      const total = p.expedientesTotal ?? 0
      return total > 0 ? `${total} expedientes completos — al corriente` : 'Expedientes digitales disponibles'
    },
    getActions: () => [{ label: 'Ver todos', href: '/expedientes', primary: true }],
  },
  {
    key: 'pedimentos', href: '/pedimentos', label: 'Pedimentos', Icon: FileText,
    getKpi: (p) => p.pedimentosThisMonth ?? 0,
    getSubtitle: (p) => {
      const n = p.pedimentosThisMonth ?? 0
      return n > 0 ? `${n} pedimento${n !== 1 ? 's' : ''} este mes — todo al corriente` : 'Sin declaraciones pendientes — todo limpio'
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
      if (val > 0) return `$${val > 1000 ? Math.round(val / 1000) + 'K' : val.toFixed(0)} USD facturado este mes`
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
      if (bultos > 0 && tons > 0) return `${bultos} ${bultos === 1 ? 'bulto' : 'bultos'} · ${tons.toFixed(1)} ton en bodega`
      if (bultos > 0) return `${bultos} ${bultos === 1 ? 'bulto' : 'bultos'} en bodega`
      return 'Bodega disponible — sin mercancía'
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
    getActions: () => [{ label: 'Ver histórico', href: '/financiero', primary: true }],
  },
  // ── Row 3: Intelligence ──
  {
    key: 'ultimo_cruce', href: '/traficos', label: 'Último Cruce', Icon: CheckCircle,
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
  // ── Row 4: Part 5 Intelligence Skills ──
  {
    key: 'crossing_intelligence', href: '/cruces', label: 'Inteligencia de Cruce', Icon: Navigation,
    getKpi: () => null,
    getSubtitle: () => 'Predicciones de espera y rutas — próximamente',
    getActions: () => [{ label: 'Ver cruces', href: '/cruces', primary: true }],
  },
  {
    key: 'demand_forecast', href: '/predicciones', label: 'Pronóstico de Demanda', Icon: LineChart,
    getKpi: () => null,
    getSubtitle: () => 'Volumen esperado y tendencias — próximamente',
    getActions: () => [{ label: 'Ver predicciones', href: '/predicciones', primary: true }],
  },
  {
    key: 'cost_optimizer', href: '/ahorro', label: 'Optimización de Costos', Icon: PiggyBank,
    getKpi: () => null,
    getSubtitle: () => 'Ahorro estimado y oportunidades — próximamente',
    getActions: () => [{ label: 'Ver ahorro', href: '/ahorro', primary: true }],
  },
  {
    key: 'dispatch_coordinator', href: '/operaciones', label: 'Coordinación de Despacho', Icon: Radio,
    getKpi: () => null,
    getSubtitle: () => 'Asignación inteligente de operaciones — próximamente',
    getActions: () => [{ label: 'Ver operaciones', href: '/operaciones', primary: true }],
  },
  // ── Row 5: Client-facing reference cards ──
  {
    key: 'catalogo', href: '/catalogo', label: 'Catálogo', Icon: Tags,
    getKpi: () => null,
    getSubtitle: () => 'Fracciones arancelarias registradas',
    getActions: () => [{ label: 'Ver catálogo', href: '/catalogo', primary: true }],
  },
  {
    key: 'anexo24', href: '/anexo24', label: 'Anexo 24', Icon: FileSpreadsheet,
    getKpi: () => null,
    getSubtitle: () => 'Control IMMEX — al corriente',
    getActions: () => [{ label: 'Ver anexo', href: '/anexo24', primary: true }],
  },
  {
    key: 'documentos', href: '/documentos', label: 'Documentos', Icon: Archive,
    getKpi: (p) => p.expedientesTotal ?? 0,
    getSubtitle: (p) => {
      const total = p.expedientesTotal ?? 0
      return total > 0 ? 'archivos digitales disponibles' : 'Archivo digital disponible'
    },
    getActions: () => [{ label: 'Ver documentos', href: '/documentos', primary: true }],
  },
]

export function WorkflowGrid(props: WorkflowGridProps) {
  const isMobile = props.isMobile ?? false
  const isClient = props.viewMode === 'client'
  const prefersReduced = useReducedMotion()

  // Cards hidden from clients (operator-only intelligence)
  const CLIENT_HIDDEN_CARDS: CardKey[] = ['docs_pendientes', 'crossing_intelligence', 'demand_forecast', 'cost_optimizer', 'dispatch_coordinator']

  const allCards = useMemo(() => {
    const kpis: CardKPIs = {
      enProceso: props.enProceso,
      urgentes: props.urgentes,
      pendingEntradas: props.pendingEntradas,
      docsFaltantes: props.docsFaltantes ?? 0,
    }
    return CARDS
      .filter(card => !(isClient && CLIENT_HIDDEN_CARDS.includes(card.key)))
      .map(card => {
        const urgency = getCardUrgency(card.key, kpis)
        const intensity = getUrgencyIntensity(urgency, props.oldestUrgentDate ?? null)
        return {
          ...card,
          urgency,
          intensityClass: INTENSITY_CSS_CLASS[intensity],
        }
      })
  }, [props.enProceso, props.urgentes, props.pendingEntradas, props.docsFaltantes])

  // Mobile: vertical urgency-sorted stack — most urgent on top
  const sortedCards = useMemo(
    () => sortByUrgency(allCards),
    [allCards],
  )

  if (isMobile) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: '100%',
      }}>
        <AnimatePresence mode="popLayout">
          {sortedCards.map((card, i) => (
            <motion.div
              key={card.key}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30, delay: prefersReduced ? 0 : 0.3 + i * 0.05 }}
            >
              <WorkflowCard
                href={card.href}
                label={card.label}
                Icon={card.Icon}
                kpi={card.getKpi(props)}
                subtitle={card.getSubtitle(props, card.urgency)}
                variant="uniform"
                actions={card.getActions(props, card.urgency)}
                urgency={card.urgency}
                cardKey={card.key}
                intensityClass={card.intensityClass}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    )
  }

  // Desktop: uniform 4-col grid — all cards same size
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gridAutoRows: '1fr',
      gap: 16,
      width: '100%',
      flex: 1,
    }}>
      {allCards.map((card, i) => {
        return (
          <motion.div
            key={card.key}
            layout
            style={{ gridColumn: 'span 1' }}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, delay: prefersReduced ? 0 : 0.3 + i * 0.05 }}
          >
            <WorkflowCard
              href={card.href}
              label={card.label}
              Icon={card.Icon}
              kpi={card.getKpi(props)}
              subtitle={card.getSubtitle(props, card.urgency)}
              variant="uniform"
              actions={card.getActions(props, card.urgency)}
              urgency={card.urgency}
              cardKey={card.key}
              intensityClass={card.intensityClass}
              delay={i * 40}
            />
          </motion.div>
        )
      })}
    </div>
  )
}
