'use client'

import { useState, useMemo } from 'react'
import { useReducedMotion } from 'framer-motion'
import { Truck, Package, FolderOpen, FileText, DollarSign, Warehouse, BarChart3, TrendingUp, CheckCircle, ClipboardList, Navigation, LineChart, PiggyBank, Radio, Tags, FileSpreadsheet, Archive, ChevronDown } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { WorkflowCard, type CardAction } from './WorkflowCard'
import { getCardUrgency, getUrgencyIntensity, INTENSITY_CSS_CLASS, sortByUrgency, type CardKey, type CardKPIs, type Urgency } from '@/lib/card-urgency'
import { computeDelta } from '@/components/cockpit/shared/Trend'
import { fmtDateTime } from '@/lib/format-utils'

export interface WorkflowGridProps {
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
  bridgeWaitMinutes?: number | null
  lastCrossing?: { trafico: string; fecha: string; id?: string } | null
  docsPendientes?: number
  isMobile?: boolean
  viewMode?: 'client' | 'operator'
  oldestUrgentDate?: string | null
  // Bento data
  sparklines?: { traficos: number[]; entradas: number[]; cruzados: number[]; facturacion: number[] }
  trends?: { thisWeekCruces: number; lastWeekCruces: number }
  activeTraficosList?: { trafico: string; pedimento: string | null; estatus: string; daysOld: number }[]
}

interface CardDef {
  key: CardKey
  href: string
  label: string
  Icon: typeof Truck
  tier: 'hero' | 'kpi' | 'action' | 'reference'
  getKpi: (props: WorkflowGridProps) => number | null
  getSubtitle: (props: WorkflowGridProps, urgency: Urgency) => string
  getActions: (props: WorkflowGridProps, urgency: Urgency) => CardAction[]
  getCriticalItem?: (props: WorkflowGridProps) => string | undefined
}

// ── TIER 1: HERO ──
const HERO_CARD: CardDef = {
  key: 'traficos', href: '/traficos', label: 'Tráficos', Icon: Truck, tier: 'hero',
  getKpi: (p) => p.enProceso > 0 ? p.enProceso : (p.cruzadosEsteMes ?? 0),
  getSubtitle: (p, u) => {
    if (p.viewMode === 'client') {
      if (u === 'red' || u === 'amber') return `en tránsito · seguimiento activo`
      const mes = p.cruzadosEsteMes ?? 0
      return mes > 0 ? `cruzados este mes — todo fluye` : 'Sin operaciones activas — todo en orden'
    }
    if (u === 'red' || u === 'amber') return `en proceso · ${p.urgentes} urgente${p.urgentes !== 1 ? 's' : ''}`
    const mes = p.cruzadosEsteMes ?? 0
    return mes > 0 ? `cruzados este mes — excelente` : 'Sin operaciones activas'
  },
  getActions: (p, u) => {
    if (p.viewMode === 'client') return [{ label: 'Ver todos', href: '/traficos', primary: true }]
    return u === 'green' || u === 'neutral'
      ? [{ label: 'Ver todos', href: '/traficos', primary: true }]
      : [{ label: 'Procesar', href: '/traficos?estatus=En+Proceso', primary: true }, { label: 'Ver todos', href: '/traficos' }]
  },
}

// ── TIER 2: KPI STRIP ──
const KPI_CARDS: CardDef[] = [
  {
    key: 'tiempo_cruce', href: '/cruces', label: 'Puente', Icon: TrendingUp, tier: 'kpi',
    getKpi: (p) => p.bridgeWaitMinutes != null && p.bridgeWaitMinutes > 0 ? p.bridgeWaitMinutes : null,
    getSubtitle: (p) => p.bridgeWaitMinutes != null && p.bridgeWaitMinutes > 0 ? 'min · World Trade' : 'Sin datos',
    getActions: () => [{ label: 'Ver', href: '/cruces', primary: true }],
  },
  {
    key: 'contabilidad', href: '/financiero', label: 'T/C', Icon: DollarSign, tier: 'kpi',
    getKpi: (p) => p.exchangeRate ? Math.round(p.exchangeRate * 100) / 100 : null,
    getSubtitle: () => 'MXN/USD · Banxico',
    getActions: () => [{ label: 'Ver', href: '/financiero', primary: true }],
  },
  {
    key: 'ultimo_cruce', href: '/traficos', label: 'Cruzados', Icon: CheckCircle, tier: 'kpi',
    getKpi: (p) => p.cruzadosEsteMes ?? 0,
    getSubtitle: () => 'este mes',
    getActions: () => [{ label: 'Ver', href: '/traficos', primary: true }],
  },
  {
    key: 'contabilidad', href: '/financiero', label: 'Facturación', Icon: DollarSign, tier: 'kpi',
    getKpi: (p) => {
      const val = p.facturacionMes ?? 0
      return val > 0 ? Math.round(val) : 0
    },
    getSubtitle: (p) => {
      const val = p.facturacionMes ?? 0
      return val > 1000 ? `$${Math.round(val / 1000)}K USD` : val > 0 ? `$${val.toFixed(0)} USD` : 'Sin movimientos'
    },
    getActions: () => [{ label: 'Ver', href: '/financiero', primary: true }],
  },
]

// ── TIER 3: ACTION CARDS ──
const ACTION_CARDS: CardDef[] = [
  {
    key: 'entradas', href: '/entradas', label: 'Entradas', Icon: Package, tier: 'action',
    getKpi: (p) => p.pendingEntradas,
    getSubtitle: (p, u) => {
      if (p.viewMode === 'client') return u === 'green' || u === 'neutral' ? 'Todo al corriente' : `${p.pendingEntradas} sin tráfico asignado`
      return u === 'green' || u === 'neutral' ? 'Todo asignado — al corriente' : `${p.pendingEntradas} sin asignar`
    },
    getActions: (p, u) => {
      if (p.viewMode === 'client') return [{ label: 'Ver lista', href: '/entradas', primary: true }]
      return u === 'green' || u === 'neutral'
        ? [{ label: 'Ver historial', href: '/entradas', primary: true }]
        : [{ label: 'Asignar ahora', href: '/entradas', primary: true }]
    },
    getCriticalItem: () => undefined, // filled dynamically from pendingEntradas
  },
  {
    key: 'expedientes', href: '/expedientes', label: 'Expedientes', Icon: FolderOpen, tier: 'action',
    getKpi: (p) => {
      const faltantes = p.docsFaltantes ?? 0
      return faltantes > 0 ? faltantes : (p.expedientesTotal ?? 0)
    },
    getSubtitle: (p, u) => {
      const f = p.docsFaltantes ?? 0
      if (u === 'amber' || u === 'red') return `${f} sin pedimento · completar`
      return `${p.expedientesTotal ?? 0} expedientes completos`
    },
    getActions: () => [{ label: 'Ver todos', href: '/expedientes', primary: true }],
  },
  {
    key: 'pedimentos', href: '/pedimentos', label: 'Pedimentos', Icon: FileText, tier: 'action',
    getKpi: (p) => p.pedimentosThisMonth ?? 0,
    getSubtitle: (p) => {
      const n = p.pedimentosThisMonth ?? 0
      return n > 0 ? `${n} este mes` : 'Sin declaraciones pendientes'
    },
    getActions: () => [{ label: 'Ver todos', href: '/pedimentos', primary: true }],
  },
  {
    key: 'inventario', href: '/bodega', label: 'Inventario', Icon: Warehouse, tier: 'action',
    getKpi: (p) => p.inventarioBultos ?? 0,
    getSubtitle: (p) => {
      const b = p.inventarioBultos ?? 0
      const t = p.inventarioPeso ?? 0
      if (b > 0 && t > 0) return `${b} bultos · ${t.toFixed(1)} ton`
      if (b > 0) return `${b} bultos en bodega`
      return 'Bodega disponible'
    },
    getActions: () => [{ label: 'Ver bodega', href: '/bodega', primary: true }],
  },
]

// ── TIER 4: REFERENCE ROW ──
const REFERENCE_CARDS: CardDef[] = [
  { key: 'catalogo' as CardKey, href: '/catalogo', label: 'Catálogo', Icon: Tags, tier: 'reference', getKpi: () => null, getSubtitle: () => 'Fracciones arancelarias', getActions: () => [] },
  { key: 'anexo24' as CardKey, href: '/anexo24', label: 'Anexo 24', Icon: FileSpreadsheet, tier: 'reference', getKpi: () => null, getSubtitle: () => 'Control IMMEX', getActions: () => [] },
  { key: 'documentos' as CardKey, href: '/documentos', label: 'Documentos', Icon: Archive, tier: 'reference', getKpi: () => null, getSubtitle: () => 'Archivo digital', getActions: () => [] },
  { key: 'reportes' as CardKey, href: '/reportes', label: 'Reportes', Icon: BarChart3, tier: 'reference', getKpi: () => null, getSubtitle: () => 'Análisis y finanzas', getActions: () => [] },
  { key: 'tiempo_cruce' as CardKey, href: '/cruces', label: 'Cruces', Icon: Navigation, tier: 'reference', getKpi: () => null, getSubtitle: () => 'Inteligencia de cruce', getActions: () => [] },
]

export function WorkflowGrid(props: WorkflowGridProps) {
  const isMobile = props.isMobile ?? false
  const isClient = props.viewMode === 'client'
  const prefersReduced = useReducedMotion()
  const [showMore, setShowMore] = useState(false)

  const kpis: CardKPIs = useMemo(() => ({
    enProceso: props.enProceso,
    urgentes: props.urgentes,
    pendingEntradas: props.pendingEntradas,
    docsFaltantes: props.docsFaltantes ?? 0,
  }), [props.enProceso, props.urgentes, props.pendingEntradas, props.docsFaltantes])

  const heroUrgency = getCardUrgency('traficos', kpis)
  const heroIntensity = getUrgencyIntensity(heroUrgency, props.oldestUrgentDate ?? null)
  const trendDelta = props.trends ? computeDelta(props.trends.thisWeekCruces, props.trends.lastWeekCruces) : 0

  // Completion percentage for hero progress bar
  const totalActions = props.pendingEntradas + props.enProceso + (props.docsPendientes ?? 0)
  const completedToday = props.cruzadosHoy ?? 0
  const completionPct = totalActions + completedToday > 0
    ? Math.round((completedToday / (totalActions + completedToday)) * 100)
    : 100

  const actionCards = useMemo(() =>
    ACTION_CARDS.map(card => {
      const urgency = getCardUrgency(card.key, kpis)
      const intensity = getUrgencyIntensity(urgency, props.oldestUrgentDate ?? null)
      return { ...card, urgency, intensityClass: INTENSITY_CSS_CLASS[intensity] }
    }),
  [kpis, props.oldestUrgentDate])

  const sortedActionCards = useMemo(() => sortByUrgency(actionCards), [actionCards])

  // ── MOBILE LAYOUT ──
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        {/* Hero always first */}
        <WorkflowCard
          href="/traficos"
          label="Tráficos"
          Icon={Truck}
          kpi={HERO_CARD.getKpi(props)}
          subtitle={HERO_CARD.getSubtitle(props, heroUrgency)}
          variant="hero"
          actions={HERO_CARD.getActions(props, heroUrgency)}
          urgency={heroUrgency}
          intensityClass={INTENSITY_CSS_CLASS[heroIntensity]}
          activeItems={props.activeTraficosList}
          sparklineData={props.sparklines?.traficos}
          completionPct={completionPct}
          trendDelta={trendDelta}
        />

        {/* KPI strip — 2x2 grid on mobile */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {KPI_CARDS.map((card, i) => (
            <WorkflowCard
              key={`kpi-${i}`}
              href={card.href}
              label={card.label}
              Icon={card.Icon}
              kpi={card.getKpi(props)}
              subtitle={card.getSubtitle(props, 'neutral')}
              variant="kpi"
              actions={card.getActions(props, 'neutral')}
              urgency="neutral"
              sparklineData={
                i === 0 ? undefined :
                i === 1 ? undefined :
                i === 2 ? props.sparklines?.cruzados :
                props.sparklines?.facturacion
              }
              delay={i * 40}
            />
          ))}
        </div>

        {/* Action cards — sorted by urgency */}
        <AnimatePresence mode="popLayout">
          {sortedActionCards.map((card, i) => (
            <motion.div key={card.key} layout
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30, delay: prefersReduced ? 0 : 0.2 + i * 0.05 }}
            >
              <WorkflowCard
                href={card.href} label={card.label} Icon={card.Icon}
                kpi={card.getKpi(props)} subtitle={card.getSubtitle(props, card.urgency)}
                variant="uniform" actions={card.getActions(props, card.urgency)}
                urgency={card.urgency} intensityClass={card.intensityClass}
                sparklineData={card.key === 'entradas' ? props.sparklines?.entradas : undefined}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Reference — collapsed behind "Ver más" */}
        <button
          onClick={() => setShowMore(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '12px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
            color: '#6E7681', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            minHeight: 44,
          }}
        >
          {showMore ? 'Ocultar' : 'Ver más herramientas'}
          <ChevronDown size={14} style={{ transform: showMore ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }} />
        </button>
        {showMore && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {REFERENCE_CARDS.filter(c => !isClient || c.key !== 'docs_pendientes').map((card, i) => (
              <WorkflowCard
                key={card.key + '-ref'} href={card.href} label={card.label} Icon={card.Icon}
                kpi={null} subtitle={card.getSubtitle(props, 'neutral')}
                variant="compact" actions={[]} urgency="neutral" delay={i * 30}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── DESKTOP: 4-TIER BENTO GRID ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', flex: 1 }}>

      {/* TIER 1: HERO — full width */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      >
        <WorkflowCard
          href="/traficos"
          label="Tráficos"
          Icon={Truck}
          kpi={HERO_CARD.getKpi(props)}
          subtitle={HERO_CARD.getSubtitle(props, heroUrgency)}
          variant="hero"
          actions={HERO_CARD.getActions(props, heroUrgency)}
          urgency={heroUrgency}
          intensityClass={INTENSITY_CSS_CLASS[heroIntensity]}
          activeItems={props.activeTraficosList}
          sparklineData={props.sparklines?.traficos}
          completionPct={completionPct}
          trendDelta={trendDelta}
        />
      </motion.div>

      {/* TIER 2: KPI STRIP — 4 compact cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {KPI_CARDS.map((card, i) => (
          <motion.div key={`kpi-${i}`}
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, delay: prefersReduced ? 0 : 0.1 + i * 0.05 }}
          >
            <WorkflowCard
              href={card.href}
              label={card.label}
              Icon={card.Icon}
              kpi={card.getKpi(props)}
              subtitle={card.getSubtitle(props, 'neutral')}
              variant="kpi"
              actions={card.getActions(props, 'neutral')}
              urgency="neutral"
              sparklineData={
                i === 2 ? props.sparklines?.cruzados :
                i === 3 ? props.sparklines?.facturacion :
                undefined
              }
              trendDelta={i === 2 ? trendDelta : undefined}
              delay={i * 40}
            />
          </motion.div>
        ))}
      </div>

      {/* TIER 3: ACTION CARDS — 2 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {actionCards.map((card, i) => (
          <motion.div key={card.key}
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30, delay: prefersReduced ? 0 : 0.2 + i * 0.05 }}
          >
            <WorkflowCard
              href={card.href} label={card.label} Icon={card.Icon}
              kpi={card.getKpi(props)} subtitle={card.getSubtitle(props, card.urgency)}
              variant="uniform" actions={card.getActions(props, card.urgency)}
              urgency={card.urgency} cardKey={card.key} intensityClass={card.intensityClass}
              sparklineData={card.key === 'entradas' ? props.sparklines?.entradas : undefined}
              delay={i * 40}
            />
          </motion.div>
        ))}
      </div>

      {/* TIER 4: REFERENCE ROW — 5 compact cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {REFERENCE_CARDS.map((card, i) => (
          <motion.div key={card.key + '-ref'}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: prefersReduced ? 0 : 0.3 + i * 0.04 }}
          >
            <WorkflowCard
              href={card.href} label={card.label} Icon={card.Icon}
              kpi={null} subtitle={card.getSubtitle(props, 'neutral')}
              variant="compact" actions={[]} urgency="neutral" delay={i * 30}
            />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
