'use client'

import { useEffect, useCallback, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Activity } from 'lucide-react'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import {
  BG_CARD, BORDER, GLASS_BLUR, GLASS_SHADOW,
  TEXT_MUTED, TEXT_SECONDARY, ACCENT_SILVER, GOLD, AMBER,
} from '@/lib/design-system'
import {
  CockpitInicio,
  SeverityRibbon, severityFromCount,
  OperatorActivityStack,
  ActividadStrip,
  CapabilityCardGrid,
  FallbackLink,
  type CockpitHeroKPI,
  type ActividadStripItem,
} from '@/components/aguila'
import { ActiveTraficos } from './ActiveTraficos'
import { RoleKPIBanner } from '@/components/RoleKPIBanner'
import type { NavCounts } from '@/lib/cockpit/nav-tiles'
import type { CapabilityCounts } from '@/lib/cockpit/capabilities'
import { auditRowToTimelineItem, type AuditRow } from '@/lib/cockpit/audit-format'
import type { MensajeriaMessage, MensajeriaThread } from '@/lib/mensajeria/feed'
import type { TraficoRow, DecisionRow, KPIs, SystemStatus } from './types'

interface Props {
  operatorName: string
  operatorId: string
  kpis: KPIs
  traficos: TraficoRow[]
  feed: DecisionRow[]
  personalAssigned: number
  personalDone: number
  colaCount: number
  systemStatus: SystemStatus
  summaryLine: string
  personalCompletedThisWeek: number
  personalCompletedLastWeek: number
  navCounts: NavCounts
  auditRows: AuditRow[]
  mensajeriaMessages: MensajeriaMessage[]
  escalatedThreads: MensajeriaThread[]
  facturasEnBanco: number
  facturasAsignadasHoy: number
  monitorActivos: number
  monitorRojo: number
  clasificacionesPendientes: number
  clasificacionesAprobadasMes: number
  catalogoTotal: number
  vencimientosPronto: number
  transportistasActivos: number
  transportistasTop: number
  econtaPendientes: number
  econtaExportadasHoy: number
  pulseSignal: boolean
  month?: string
}

export function InicioClient(props: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(() => {
    startTransition(() => router.refresh())
  }, [router])

  // Realtime channel disabled in v9.2 — repeated WebSocket reconnects
  // on tables whose schema/RLS state we haven't fully verified. Re-enable
  // after table probes confirm operational_decisions + traficos are safe
  // to subscribe to from the browser. User refreshes manually for now.
  useEffect(() => {
    void refresh
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [refresh])

  // Hero KPIs — 4 tiles, operator tone.
  const heroKPIs: CockpitHeroKPI[] = [
    {
      key: 'entradas',
      label: 'Entradas hoy',
      value: props.kpis.entradasHoy,
      series: props.kpis.entradasSeries,
      current: props.kpis.entradasCurr7,
      previous: props.kpis.entradasPrev7,
      href: '/operador/entradas?range=hoy',
      tone: 'silver',
    },
    {
      key: 'activos',
      label: 'Embarques activos',
      value: props.kpis.activos,
      series: props.kpis.activosSeries,
      current: props.kpis.activosCurr7,
      previous: props.kpis.activosPrev7,
      href: '/embarques?estatus=En+Proceso',
      tone: 'silver',
    },
    {
      key: 'pendientes',
      label: 'Pedimentos pendientes',
      value: props.kpis.pendientes,
      series: props.kpis.pendientesSeries,
      current: props.kpis.pendientesCurr7,
      previous: props.kpis.pendientesPrev7,
      href: '/pedimentos?estatus=borrador',
      tone: 'silver',
      inverted: true,
    },
    {
      key: 'atrasados',
      label: 'Atrasados >7d',
      value: props.kpis.atrasados,
      series: props.kpis.atrasadosSeries,
      current: props.kpis.atrasadosCurr7,
      previous: props.kpis.atrasadosPrev7,
      href: '/embarques?atrasados=7d',
      tone: 'silver',
      urgent: props.kpis.atrasados > 0,
      inverted: true,
    },
  ]

  // Actividad reciente — audit_log + Mensajería merge, pinned escalations on top (v9).
  const auditItems = props.auditRows.slice(0, 10).map(auditRowToTimelineItem)
  const actividadSlot = (
    <OperatorActivityStack
      auditItems={auditItems}
      messages={props.mensajeriaMessages}
      pinnedThreads={props.escalatedThreads}
      emptyLabel="Sin actividad reciente."
    />
  )

  // Estado de operaciones — operator-specific: celebration banner + cola excepciones + active embarques
  const estadoSections = (
    <>
      <RoleKPIBanner
        role="operator"
        name={props.operatorName}
        thisWeek={props.personalCompletedThisWeek}
        lastWeek={props.personalCompletedLastWeek}
        metricLabel="Embarques cruzados · últimos 7 días"
        celebrationTemplate={({ name, thisWeek, pct }) =>
          `${name}, cerraste ${thisWeek} embarque${thisWeek === 1 ? '' : 's'} esta semana (+${pct}% vs semana pasada). ZAPATA AI te lo reconoce.`
        }
      />
      <ColaCard colaCount={props.colaCount} />
      <FacturasBancoCard
        enBanco={props.facturasEnBanco}
        asignadasHoy={props.facturasAsignadasHoy}
      />
      <MonitorCard
        activos={props.monitorActivos}
        rojo={props.monitorRojo}
      />
      <ClasificacionesCard
        pendientes={props.clasificacionesPendientes}
        aprobadasMes={props.clasificacionesAprobadasMes}
      />
      <CatalogoCard
        total={props.catalogoTotal}
        vencimientosPronto={props.vencimientosPronto}
      />
      <TransportistasCard
        activos={props.transportistasActivos}
        top={props.transportistasTop}
      />
      <ReportesEcontaCard
        pendientes={props.econtaPendientes}
        exportadasHoy={props.econtaExportadasHoy}
      />
      <ActiveTraficos rows={props.traficos} onRefresh={refresh} />
    </>
  )

  // v10 — ActividadStrip (operator: audit + escalations as chips at top)
  const stripItems: ActividadStripItem[] = [
    ...props.escalatedThreads.slice(0, 3).map((t) => ({
      id: `thr-${t.id}`,
      label: t.subject ?? 'Hilo escalado',
      detail: t.last_message_preview ?? t.company_id ?? undefined,
      timestamp: t.escalated_at ?? t.last_message_at ?? new Date().toISOString(),
      href: `/mensajeria/${encodeURIComponent(t.id)}`,
      tone: 'warning' as const,
    })),
    ...props.auditRows.slice(0, 8).map((a) => {
      const ti = auditRowToTimelineItem(a)
      return {
        id: ti.id,
        label: ti.title,
        detail: ti.subtitle,
        timestamp: ti.timestamp,
        href: ti.href,
        tone: 'silver' as const,
      }
    }),
  ]
  const actividadStripSlot = (
    <ActividadStrip
      items={stripItems}
      emptyLabel="Sin actividad reciente."
      title="Actividad ops-wide"
    />
  )

  // V1 fix — microStatus is DYNAMIC info only. Static description lives in
  // CAPABILITY_CARDS.subtitle (renders once). Passing the same string here
  // was causing doubled labels on the client cockpit.
  const capabilityCounts: CapabilityCounts = {
    checklist:    { count: null },
    clasificador: { count: null },
    mensajes:     { count: props.mensajeriaMessages.length, microStatus: props.mensajeriaMessages.length > 0 ? `${props.mensajeriaMessages.length} nuevos` : undefined },
  }
  const capabilitySlot = <CapabilityCardGrid counts={capabilityCounts} />

  return (
    <CockpitInicio
      role="operator"
      name={props.operatorName}
      heroKPIs={heroKPIs}
      navCounts={props.navCounts}
      estadoSections={estadoSections}
      actividadSlot={actividadSlot}
      actividadStripSlot={actividadStripSlot}
      capabilitySlot={capabilitySlot}
      systemStatus={props.systemStatus}
      summaryLine={props.summaryLine}
      pulseSignal={props.pulseSignal}
      month={props.month}
    />
  )
}

function ColaCard({ colaCount }: { colaCount: number }) {
  const severity = severityFromCount(colaCount, { warn: 1, crit: 6 })
  return (
    <section style={{
      position: 'relative',
      overflow: 'hidden',
      background: BG_CARD,
      backdropFilter: `blur(${GLASS_BLUR})`,
      WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
      border: `1px solid ${BORDER}`,
      borderRadius: 'var(--aguila-radius-card, 20px)',
      boxShadow: GLASS_SHADOW,
      padding: '20px 20px 20px 23px',
    }}>
      {colaCount > 0 && <SeverityRibbon tone={severity} />}
      <div style={{
        fontSize: 'var(--aguila-fs-label, 10px)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 'var(--aguila-ls-label, 0.08em)',
        color: TEXT_MUTED,
      }}>
        Cola de excepciones
      </div>
      <div style={{
        fontFamily: 'var(--font-jetbrains-mono), monospace',
        fontSize: 'var(--aguila-fs-kpi-large, 44px)',
        fontWeight: 800,
        color: colaCount > 0 ? (severity === 'critical' ? AMBER : GOLD) : TEXT_MUTED,
        margin: '8px 0 12px 0',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {colaCount}
      </div>
      {colaCount > 0 ? (
        <Link
          href="/operador/cola"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 44,
            padding: '10px 16px',
            borderRadius: 12,
            background: GOLD,
            color: '#0D0D0C',
            fontWeight: 700,
            fontSize: 'var(--aguila-fs-body)',
            textDecoration: 'none',
            width: '100%',
          }}
        >
          Ver cola →
        </Link>
      ) : (
        <p style={{ fontSize: 'var(--aguila-fs-body)', color: TEXT_SECONDARY, margin: 0 }}>
          Sin excepciones pendientes.
        </p>
      )}
    </section>
  )
}

function FacturasBancoCard({ enBanco, asignadasHoy }: { enBanco: number; asignadasHoy: number }) {
  const isIncomplete = enBanco === 0 && asignadasHoy === 0
  return (
    <section style={{
      position: 'relative',
      overflow: 'hidden',
      background: BG_CARD,
      backdropFilter: `blur(${GLASS_BLUR})`,
      WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
      border: `1px solid ${BORDER}`,
      borderRadius: 'var(--aguila-radius-card, 20px)',
      boxShadow: GLASS_SHADOW,
      padding: '20px',
    }}>
      <div style={{
        fontSize: 'var(--aguila-fs-label, 10px)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 'var(--aguila-ls-label, 0.08em)',
        color: TEXT_MUTED,
      }}>
        Banco de facturas
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, margin: '12px 0' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-kpi-mid, 28px)',
            fontWeight: 800,
            color: enBanco > 0 ? ACCENT_SILVER : TEXT_MUTED,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {enBanco}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY, marginTop: 4 }}>en banco</div>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: BORDER }} />
        <div>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-kpi-mid, 28px)',
            fontWeight: 800,
            color: asignadasHoy > 0 ? '#22C55E' : TEXT_MUTED,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {asignadasHoy}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY, marginTop: 4 }}>asignadas hoy</div>
        </div>
      </div>
      <Link
        href="/banco-facturas"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 40,
          padding: '8px 16px',
          borderRadius: 12,
          background: enBanco > 0 ? GOLD : 'rgba(148,163,184,0.12)',
          color: enBanco > 0 ? '#0D0D0C' : TEXT_SECONDARY,
          fontWeight: 700,
          fontSize: 'var(--aguila-fs-body)',
          textDecoration: 'none',
          width: '100%',
        }}
      >
        {enBanco > 0 ? 'Revisar facturas →' : 'Abrir banco'}
      </Link>
      <FallbackLink
        href="https://trafico1web.globalpc.net/facturas/banco"
        label="facturas"
        isIncomplete={isIncomplete}
        message="Sin facturas en ZAPATA AI todavía — el banco de GlobalPC tiene el histórico."
      />
    </section>
  )
}

function MonitorCard({ activos, rojo }: { activos: number; rojo: number }) {
  const severity = rojo > 0 ? 'critical' : 'healthy'
  const isIncomplete = activos === 0
  return (
    <section style={{
      position: 'relative',
      overflow: 'hidden',
      background: BG_CARD,
      backdropFilter: `blur(${GLASS_BLUR})`,
      WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
      border: `1px solid ${BORDER}`,
      borderRadius: 'var(--aguila-radius-card, 20px)',
      boxShadow: GLASS_SHADOW,
      padding: '20px 20px 20px 23px',
    }}>
      {rojo > 0 && <SeverityRibbon tone={severity} />}
      <div style={{
        fontSize: 'var(--aguila-fs-label, 10px)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 'var(--aguila-ls-label, 0.08em)',
        color: TEXT_MUTED,
      }}>
        Monitor en vivo
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, margin: '12px 0' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-kpi-mid, 28px)',
            fontWeight: 800,
            color: activos > 0 ? ACCENT_SILVER : TEXT_MUTED,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {activos}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY, marginTop: 4 }}>activos</div>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: BORDER }} />
        <div>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-kpi-mid, 28px)',
            fontWeight: 800,
            color: rojo > 0 ? '#FCA5A5' : TEXT_MUTED,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {rojo}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY, marginTop: 4 }}>requieren atención</div>
        </div>
      </div>
      <Link
        href="/monitor"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 40,
          padding: '8px 16px',
          borderRadius: 12,
          background: rojo > 0 ? '#DC2626' : (activos > 0 ? GOLD : 'rgba(148,163,184,0.12)'),
          color: rojo > 0 || activos > 0 ? '#0D0D0C' : TEXT_SECONDARY,
          fontWeight: 700,
          fontSize: 'var(--aguila-fs-body)',
          textDecoration: 'none',
          width: '100%',
        }}
      >
        {rojo > 0 ? 'Revisar rojos →' : (activos > 0 ? 'Abrir monitor' : 'Sin tráficos activos')}
      </Link>
      <FallbackLink
        href="https://trafico1web.globalpc.net/utilerias/monitor"
        label="Monitor"
        isIncomplete={isIncomplete}
        message="Sin tráficos activos en ZAPATA AI — el monitor de GlobalPC tiene el histórico."
      />
    </section>
  )
}

function ClasificacionesCard({ pendientes, aprobadasMes }: { pendientes: number; aprobadasMes: number }) {
  const isIncomplete = pendientes === 0 && aprobadasMes === 0
  return (
    <section style={{
      position: 'relative',
      overflow: 'hidden',
      background: BG_CARD,
      backdropFilter: `blur(${GLASS_BLUR})`,
      WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
      border: `1px solid ${BORDER}`,
      borderRadius: 'var(--aguila-radius-card, 20px)',
      boxShadow: GLASS_SHADOW,
      padding: '20px',
    }}>
      <div style={{
        fontSize: 'var(--aguila-fs-label, 10px)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 'var(--aguila-ls-label, 0.08em)',
        color: TEXT_MUTED,
      }}>
        Clasificaciones
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, margin: '12px 0' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-kpi-mid, 28px)',
            fontWeight: 800,
            color: pendientes > 0 ? AMBER : TEXT_MUTED,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {pendientes}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY, marginTop: 4 }}>pendientes</div>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: BORDER }} />
        <div>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-kpi-mid, 28px)',
            fontWeight: 800,
            color: aprobadasMes > 0 ? '#86EFAC' : TEXT_MUTED,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {aprobadasMes}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY, marginTop: 4 }}>aprobadas este mes</div>
        </div>
      </div>
      <Link
        href="/clasificar"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 40,
          padding: '8px 16px',
          borderRadius: 12,
          background: pendientes > 0 ? GOLD : 'rgba(148,163,184,0.12)',
          color: pendientes > 0 ? '#0D0D0C' : TEXT_SECONDARY,
          fontWeight: 700,
          fontSize: 'var(--aguila-fs-body)',
          textDecoration: 'none',
          width: '100%',
        }}
      >
        {pendientes > 0 ? 'Clasificar en bloque →' : 'Abrir clasificaciones'}
      </Link>
      <FallbackLink
        href="https://trafico1web.globalpc.net/clasificacion"
        label="Clasificación"
        isIncomplete={isIncomplete}
        message="Sin productos por clasificar en ZAPATA AI — consulta el histórico en GlobalPC."
      />
    </section>
  )
}

function CatalogoCard({ total, vencimientosPronto }: { total: number; vencimientosPronto: number }) {
  const isIncomplete = total === 0
  return (
    <section style={{
      position: 'relative',
      overflow: 'hidden',
      background: BG_CARD,
      backdropFilter: `blur(${GLASS_BLUR})`,
      WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
      border: `1px solid ${BORDER}`,
      borderRadius: 'var(--aguila-radius-card, 20px)',
      boxShadow: GLASS_SHADOW,
      padding: '20px 20px 20px 23px',
    }}>
      {vencimientosPronto > 0 && <SeverityRibbon tone="critical" />}
      <div style={{
        fontSize: 'var(--aguila-fs-label, 10px)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 'var(--aguila-ls-label, 0.08em)',
        color: TEXT_MUTED,
      }}>
        Catálogo
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, margin: '12px 0' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-kpi-mid, 28px)',
            fontWeight: 800,
            color: total > 0 ? ACCENT_SILVER : TEXT_MUTED,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {total}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY, marginTop: 4 }}>productos</div>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: BORDER }} />
        <div>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-kpi-mid, 28px)',
            fontWeight: 800,
            color: vencimientosPronto > 0 ? '#FCA5A5' : TEXT_MUTED,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {vencimientosPronto}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY, marginTop: 4 }}>vencen ≤30d</div>
        </div>
      </div>
      <Link
        href={vencimientosPronto > 0 ? '/catalogo/vencimientos' : '/catalogo'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 40,
          padding: '8px 16px',
          borderRadius: 12,
          background: vencimientosPronto > 0 ? '#DC2626' : (total > 0 ? GOLD : 'rgba(148,163,184,0.12)'),
          color: vencimientosPronto > 0 || total > 0 ? '#0D0D0C' : TEXT_SECONDARY,
          fontWeight: 700,
          fontSize: 'var(--aguila-fs-body)',
          textDecoration: 'none',
          width: '100%',
        }}
      >
        {vencimientosPronto > 0 ? 'Revisar vencimientos →' : (total > 0 ? 'Abrir catálogo' : 'Sin productos')}
      </Link>
      <FallbackLink
        href="https://trafico1web.globalpc.net/catalogos/productos"
        label="Catálogo"
        isIncomplete={isIncomplete}
        message="Sin productos en ZAPATA AI — consulta el catálogo en GlobalPC."
      />
    </section>
  )
}

function TransportistasCard({ activos, top }: { activos: number; top: number }) {
  const isIncomplete = activos === 0
  return (
    <section style={{
      position: 'relative',
      overflow: 'hidden',
      background: BG_CARD,
      backdropFilter: `blur(${GLASS_BLUR})`,
      WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
      border: `1px solid ${BORDER}`,
      borderRadius: 'var(--aguila-radius-card, 20px)',
      boxShadow: GLASS_SHADOW,
      padding: '20px',
    }}>
      <div style={{
        fontSize: 'var(--aguila-fs-label, 10px)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 'var(--aguila-ls-label, 0.08em)',
        color: TEXT_MUTED,
      }}>
        Transportistas
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, margin: '12px 0' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-kpi-mid, 28px)',
            fontWeight: 800,
            color: activos > 0 ? ACCENT_SILVER : TEXT_MUTED,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {activos}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY, marginTop: 4 }}>activos</div>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: BORDER }} />
        <div>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-kpi-mid, 28px)',
            fontWeight: 800,
            color: top > 0 ? '#FDE68A' : TEXT_MUTED,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {top}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY, marginTop: 4 }}>★★★★+</div>
        </div>
      </div>
      <Link
        href="/transportistas"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 40,
          padding: '8px 16px',
          borderRadius: 12,
          background: activos > 0 ? GOLD : 'rgba(148,163,184,0.12)',
          color: activos > 0 ? '#0D0D0C' : TEXT_SECONDARY,
          fontWeight: 700,
          fontSize: 'var(--aguila-fs-body)',
          textDecoration: 'none',
          width: '100%',
        }}
      >
        {activos > 0 ? 'Abrir directorio' : 'Sin transportistas'}
      </Link>
      <FallbackLink
        href="https://trafico1web.globalpc.net/catalogos/transportistas"
        label="Transportistas"
        isIncomplete={isIncomplete}
        message="Sin transportistas capturados en ZAPATA AI — consulta el catálogo de GlobalPC."
      />
    </section>
  )
}

function ReportesEcontaCard({ pendientes, exportadasHoy }: { pendientes: number; exportadasHoy: number }) {
  return (
    <section style={{
      position: 'relative',
      overflow: 'hidden',
      background: BG_CARD,
      backdropFilter: `blur(${GLASS_BLUR})`,
      WebkitBackdropFilter: `blur(${GLASS_BLUR})`,
      border: `1px solid ${BORDER}`,
      borderRadius: 'var(--aguila-radius-card, 20px)',
      boxShadow: GLASS_SHADOW,
      padding: '20px 20px 20px 23px',
    }}>
      {pendientes > 5 && <SeverityRibbon tone="warning" />}
      <div style={{
        fontSize: 'var(--aguila-fs-label, 10px)',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 'var(--aguila-ls-label, 0.08em)',
        color: TEXT_MUTED,
      }}>
        Reportes · eCONTA
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, margin: '12px 0' }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-kpi-mid, 28px)',
            fontWeight: 800,
            color: pendientes > 0 ? AMBER : TEXT_MUTED,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {pendientes}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY, marginTop: 4 }}>por exportar</div>
        </div>
        <div style={{ width: 1, alignSelf: 'stretch', background: BORDER }} />
        <div>
          <div style={{
            fontFamily: 'var(--font-jetbrains-mono), monospace',
            fontSize: 'var(--aguila-fs-kpi-mid, 28px)',
            fontWeight: 800,
            color: exportadasHoy > 0 ? '#86EFAC' : TEXT_MUTED,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {exportadasHoy}
          </div>
          <div style={{ fontSize: 'var(--aguila-fs-meta)', color: TEXT_SECONDARY, marginTop: 4 }}>exportadas hoy</div>
        </div>
      </div>
      <Link
        href="/reportes"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 40,
          padding: '8px 16px',
          borderRadius: 12,
          background: GOLD,
          color: '#0D0D0C',
          fontWeight: 700,
          fontSize: 'var(--aguila-fs-body)',
          textDecoration: 'none',
          width: '100%',
        }}
      >
        Abrir reportes →
      </Link>
      <FallbackLink
        href="https://trafico1web.globalpc.net/reportes"
        label="Reportes"
        isIncomplete={false}
        cta="Reportes legacy en GlobalPC"
      />
    </section>
  )
}

const DECISION_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  'En Proceso':       { bg: 'rgba(192,197,206,0.12)', fg: ACCENT_SILVER,   label: 'En proceso' },
  'Documentacion':    { bg: 'rgba(148,163,184,0.12)', fg: '#94a3b8',       label: 'Documentación' },
  'En Aduana':        { bg: 'rgba(148,163,184,0.12)', fg: '#94a3b8',       label: 'En aduana' },
  'Pedimento Pagado': { bg: 'rgba(34,197,94,0.12)',   fg: '#22C55E',       label: 'Pagado' },
  'Cruzado':          { bg: 'rgba(34,197,94,0.12)',   fg: '#22C55E',       label: 'Cruzado' },
}

function DecisionPill({ label }: { label: string | null }) {
  const c = (label && DECISION_PILL[label]) || { bg: 'rgba(148,163,184,0.1)', fg: TEXT_MUTED, label: label || '—' }
  return (
    <span style={{
      fontSize: 'var(--aguila-fs-label)', fontWeight: 600,
      padding: '2px 8px', borderRadius: 20,
      background: c.bg, color: c.fg,
      flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {c.label}
    </span>
  )
}

function truncate(s: string | null, n: number): string {
  if (!s) return '—'
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`
}

// Used only by the activity callout indicator style.
void Activity
