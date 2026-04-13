/**
 * AGUILA · Eagle View (Tito) — v9 resilient aggregate cockpit.
 *
 * Every query soft-wrapped. Owner aggregates across ALL tenants (invariant 31).
 * Actividad reciente = escalation-only audit_log feed.
 * Escalated Mensajería threads surface as priority panel in estadoSections.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { computeARAging, computeAPAging } from '@/lib/contabilidad/aging'
import { fmtUSDCompact } from '@/lib/format-utils'
import { bucketDailySeries, sumRange, daysAgo } from '@/lib/cockpit/fetch'
import { softCount, softData, softFirst } from '@/lib/cockpit/safe-query'
import type { TimelineItem } from '@/components/aguila'
import { parseMonthParam, recentMonths } from '@/lib/cockpit/month-window'
import { fetchEscalatedThreads } from '@/lib/mensajeria/feed'
import { CockpitInicio, PriorityThreadsPanel, TimelineFeed, CockpitSkeleton, ActividadStrip, CapabilityCardGrid, type CockpitHeroKPI, type ActividadStripItem } from '@/components/aguila'
import type { CapabilityCounts } from '@/lib/cockpit/capabilities'
import { MonthSelector } from '@/components/admin/MonthSelector'
import { AuditoriaShortcut } from '@/components/admin/AuditoriaShortcut'
import { TraficosDelDiaTile } from '@/components/eagle/TraficosDelDiaTile'
import { ArApTile } from '@/components/eagle/ArApTile'
import { ClientesDormidosTile } from '@/components/eagle/ClientesDormidosTile'
import { TopAtencionesTile } from '@/components/eagle/TopAtencionesTile'
import { CorredorTile } from '@/components/eagle/CorredorTile'
import type { NavCounts } from '@/lib/cockpit/nav-tiles'
import type {
  AtencionItem,
  DormantClient,
  TraficoStatusBucket,
} from '@/app/api/eagle/overview/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MOTION_STATUSES = ['En Proceso', 'Documentacion', 'En Aduana', 'Pedimento Pagado', 'Cruzado']

// Human-readable labels for operational_decisions feed. Unknown
// decision_types fall through to a humanized version of the raw value.
const DECISION_LABELS: Record<string, string> = {
  solicitation_overdue: 'Documento sin respuesta',
  doc_autoclassified: 'Documento clasificado',
  doc_classify_failed: 'Clasificación manual',
  draft_approved: 'Borrador aprobado',
  draft_rejected: 'Borrador rechazado',
  draft_created: 'Borrador creado',
  compliance_escalated: 'Compliance escalado',
  mve_critical: 'MVE crítico',
  pedimento_rechazado: 'Pedimento rechazado',
  oca_requested: 'OCA solicitada',
  data_exported: 'Datos exportados',
  payment_applied: 'Pago aplicado',
  payment_released: 'Pago liberado',
  email_routed: 'Correo enrutado',
  email_classified: 'Correo clasificado',
}

function humanizeDecision(decisionType: string | null, decision: string | null): string {
  if (decisionType && DECISION_LABELS[decisionType]) return DECISION_LABELS[decisionType]
  if (decisionType) return decisionType.replace(/_/g, ' ')
  return decision ?? 'Evento'
}

function daysSinceISO(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

function withHardTimeout<T>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(p).catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

interface EaglePageProps {
  searchParams?: Promise<{ month?: string | string[] }>
}

export default async function EaglePage({ searchParams }: EaglePageProps) {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (!['admin', 'broker'].includes(session.role)) redirect('/')

  const opName = cookieStore.get('operator_name')?.value || 'Tito'
  const resolved = (await searchParams) ?? {}
  const rawMonth = Array.isArray(resolved.month) ? resolved.month[0] : resolved.month

  return (
    <Suspense fallback={<CockpitSkeleton />}>
      <EagleContent opName={opName} rawMonth={rawMonth ?? null} />
    </Suspense>
  )
}

async function EagleContent({ opName, rawMonth }: { opName: string; rawMonth: string | null }) {
  try {
    return await renderEagle(opName, rawMonth)
  } catch (err) {
    return (
      <div style={{ padding: 40, color: '#E6EDF3', fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
        No se pudo cargar Eagle View: {err instanceof Error ? err.message : String(err)}
      </div>
    )
  }
}

async function renderEagle(opName: string, rawMonth: string | null) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date()
  const month = parseMonthParam(rawMonth, now)
  const monthOptions = recentMonths(12, now)
  // Prior month window for delta comparisons.
  const prior = parseMonthParam(month.prev, now)
  // Legacy sparkline windows — capped to 14 days but always ending at
  // the end of the selected month so the KPITile trend lines stay
  // coherent with the selected period.
  const sparklineEnd = new Date(Math.min(new Date(month.monthEnd).getTime() - 1, now.getTime()))
  const fourteenDaysAgoIso = daysAgo(14, sparklineEnd).toISOString()

  const [
    traficosRows,
    ar,
    ap,
    recentForDormantRows,
    companiesRows,
    traficosActivosSeriesRows,
    pedimentosSeriesRows,
    expedientesSeriesRows,
    expedientesCount,
    entradasSeriesRows,
    entradasMesCount,
    clasificacionesSeriesRows,
    clasificacionesCount,
    pedimentosPendientesCount,
    cruzadosMesCount,
    pedimentosMesCount,
    pedimentosPriorMesCount,
    lastPedimento,
    mveRows,
    auditSuggestionsRows,
    escalatedThreads,
    decisionRows,
  ] = await Promise.all([
    softData<{ estatus: string | null }>(
      sb.from('traficos').select('estatus').in('estatus', MOTION_STATUSES).limit(5000)
    ),
    withHardTimeout(computeARAging(sb, null), 3500, { total: 0, count: 0, byBucket: [], topDebtors: [], currency: 'MXN' as const }),
    withHardTimeout(computeAPAging(sb, null), 3500, { total: 0, count: 0, byBucket: [], topDebtors: [], currency: 'USD' as const, sourceMissing: true }),
    // Active-client scope = the selected month's window (not a rolling 14d).
    softData<{ company_id: string | null; created_at: string }>(
      sb.from('traficos').select('company_id, created_at').gte('created_at', month.monthStart).lt('created_at', month.monthEnd).limit(5000)
    ),
    softData<{ company_id: string; name: string | null; active: boolean | null }>(
      sb.from('companies').select('company_id, name, active').eq('active', true).limit(500)
    ),
    softData<{ updated_at: string }>(
      sb.from('traficos').select('updated_at').eq('estatus', 'En Proceso').gte('updated_at', fourteenDaysAgoIso).limit(2000)
    ),
    // Pedimento series — sparkline for the nav card. Use updated_at since
    // fecha_llegada is sparsely populated on recent rows.
    softData<{ updated_at: string }>(
      sb.from('traficos').select('updated_at').is('pedimento', null).gte('updated_at', fourteenDaysAgoIso).limit(2000)
    ),
    // expediente_documentos uses `uploaded_at`, not `created_at`.
    softData<{ uploaded_at: string }>(
      sb.from('expediente_documentos').select('uploaded_at').gte('uploaded_at', fourteenDaysAgoIso).limit(2000)
    ),
    softCount(sb.from('expediente_documentos').select('id', { count: 'exact', head: true })),
    softData<{ fecha_llegada_mercancia: string }>(
      sb.from('entradas').select('fecha_llegada_mercancia').gte('fecha_llegada_mercancia', fourteenDaysAgoIso).limit(2000)
    ),
    softCount(sb.from('entradas').select('id', { count: 'exact', head: true }).gte('fecha_llegada_mercancia', month.monthStart).lt('fecha_llegada_mercancia', month.monthEnd)),
    softData<{ fraccion_classified_at: string }>(
      sb.from('globalpc_productos').select('fraccion_classified_at').not('fraccion_classified_at', 'is', null).gte('fraccion_classified_at', fourteenDaysAgoIso).limit(2000)
    ),
    softCount(sb.from('globalpc_productos').select('id', { count: 'exact', head: true }).not('fraccion_classified_at', 'is', null)),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).is('pedimento', null)),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).eq('estatus', 'Cruzado').gte('updated_at', month.monthStart).lt('updated_at', month.monthEnd)),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).not('pedimento', 'is', null).gte('updated_at', month.monthStart).lt('updated_at', month.monthEnd)),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).not('pedimento', 'is', null).gte('updated_at', prior.monthStart).lt('updated_at', prior.monthEnd)),
    softFirst<{ updated_at: string }>(
      sb.from('traficos').select('updated_at').not('pedimento', 'is', null).order('updated_at', { ascending: false }).limit(1)
    ),
    softData<{ id: string; rule_code: string | null; trafico_id: string | null }>(
      sb.from('mve_alerts').select('id, rule_code, trafico_id').eq('severity', 'critical').eq('resolved', false).limit(10)
    ),
    softData<{ id: string; title: string | null }>(
      sb.from('audit_suggestions').select('id, title').eq('status', 'pending').limit(10)
    ),
    withHardTimeout(fetchEscalatedThreads(sb, 4), 3000, []),
    // Activity feed — operational_decisions has fresh data across all
    // tenants. `audit_log` is canonical in the rulebook but empty in prod
    // right now, so the feed falls back to op_decisions for visibility.
    softData<{ id: string; decision_type: string | null; decision: string | null; company_id: string | null; created_at: string; trafico: string | null; reasoning: string | null }>(
      sb.from('operational_decisions').select('id, decision_type, decision, company_id, created_at, trafico, reasoning').gte('created_at', month.monthStart).lt('created_at', month.monthEnd).order('created_at', { ascending: false }).limit(20)
    ),
  ])

  // traficosByStatus
  const counts = new Map<string, number>()
  for (const r of traficosRows) {
    const s = r.estatus ?? 'Sin estado'
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  const traficosByStatus: TraficoStatusBucket[] = Array.from(counts.entries()).map(([status, count]) => ({ status, count }))
  const activeTraficosTotal = traficosByStatus.reduce((s, b) => s + b.count, 0)

  // dormant (top 3) + activeClients
  const activeIds = new Set<string>()
  for (const r of recentForDormantRows) {
    if (r.company_id) activeIds.add(r.company_id)
  }
  const activeClients = activeIds.size
  const dormantCandidates = companiesRows
    .filter((c) => !activeIds.has(c.company_id))
    .slice(0, 3)

  const dormantLasts = await Promise.all(
    dormantCandidates.map((c) =>
      softFirst<{ created_at: string | null; importe_total: number | null }>(
        sb.from('traficos').select('created_at, importe_total').eq('company_id', c.company_id).order('created_at', { ascending: false }).limit(1)
      )
    )
  )
  const dormant: DormantClient[] = dormantCandidates.map((c, i) => {
    const last = dormantLasts[i]
    return {
      companyId: c.company_id,
      razonSocial: c.name ?? c.company_id,
      diasSinMovimiento: last?.created_at ? daysSinceISO(last.created_at) : 999,
      ultimoMonto: last?.importe_total ?? null,
    }
  })

  // atenciones
  const atenciones: AtencionItem[] = []
  for (const a of mveRows) {
    atenciones.push({
      id: `mve-${a.id}`,
      kind: 'mve_critical',
      label: 'MVE crítico',
      detail: a.rule_code ?? a.trafico_id ?? 'Alerta sin código',
      href: '/mve/alerts',
      severityRank: 0,
    })
  }
  for (const s of auditSuggestionsRows) {
    atenciones.push({
      id: `sugg-${s.id}`,
      kind: 'audit_suggestion',
      label: 'Sugerencia de auditoría',
      detail: s.title ?? 'Pendiente',
      href: '/admin/inicio',
      severityRank: 1,
    })
  }
  for (const d of dormant) {
    atenciones.push({
      id: `dorm-${d.companyId}`,
      kind: 'dormant',
      label: 'Cliente dormido',
      detail: `${d.razonSocial} · ${d.diasSinMovimiento}d`,
      href: `/clientes/${d.companyId}`,
      severityRank: 2,
    })
  }
  atenciones.sort((a, b) => a.severityRank - b.severityRank)
  const atencionesTop = atenciones.slice(0, 5)

  // Activity feed from operational_decisions (month-scoped, cross-tenant).
  const actividadItems: TimelineItem[] = decisionRows.map((r) => ({
    id: String(r.id),
    title: humanizeDecision(r.decision_type, r.decision),
    subtitle: r.company_id
      ? (r.trafico ? `${r.company_id} · ${r.trafico}` : r.company_id)
      : (r.trafico ?? undefined),
    timestamp: r.created_at,
    href: r.trafico ? `/traficos/${encodeURIComponent(r.trafico)}` : undefined,
  }))

  // Series bucketing
  const traficosActivosSeries = bucketDailySeries(traficosActivosSeriesRows as Array<Record<string, unknown>>, 'updated_at', 14, now)
  const pedimentosPendSeries  = bucketDailySeries(pedimentosSeriesRows as Array<Record<string, unknown>>, 'updated_at', 14, now)
  const expedientesSeries     = bucketDailySeries(expedientesSeriesRows as Array<Record<string, unknown>>, 'uploaded_at', 14, now)
  const entradasSeries        = bucketDailySeries(entradasSeriesRows as Array<Record<string, unknown>>, 'fecha_llegada_mercancia', 14, now)
  const clasificacionesSeries = bucketDailySeries(clasificacionesSeriesRows as Array<Record<string, unknown>>, 'fraccion_classified_at', 14, now)

  const arTotal = ar.total ?? 0
  const monthShort = month.label

  const heroKPIs: CockpitHeroKPI[] = [
    { key: 'traficos', label: 'Tráficos en proceso', value: activeTraficosTotal, series: traficosActivosSeries, current: sumRange(traficosActivosSeries, 7, 14), previous: sumRange(traficosActivosSeries, 0, 7), href: '/traficos?estatus=En+Proceso', tone: 'silver' },
    { key: 'clientes', label: 'Clientes activos', value: activeClients, tone: 'silver' },
    { key: 'dormidos', label: 'Clientes dormidos', value: dormant.length, tone: 'silver', inverted: true },
    { key: 'ar', label: 'CxC vencido', value: fmtUSDCompact(arTotal) || '—', tone: 'silver', inverted: true },
  ]

  const daysSinceLastPedimento = lastPedimento?.updated_at
    ? Math.floor((Date.now() - new Date(lastPedimento.updated_at).getTime()) / 86400000)
    : null

  const navCounts: NavCounts = {
    traficos: {
      count: activeTraficosTotal,
      series: traficosActivosSeries,
      microStatus: `${cruzadosMesCount} cruzaron en ${monthShort}`,
    },
    pedimentos: {
      count: pedimentosMesCount,
      series: pedimentosPendSeries,
      microStatus: daysSinceLastPedimento != null
        ? `Último hace ${daysSinceLastPedimento} día${daysSinceLastPedimento === 1 ? '' : 's'}`
        : 'Sin pedimentos recientes',
    },
    expedientes: {
      count: expedientesCount,
      series: expedientesSeries,
      microStatus: `${pedimentosPendientesCount} pendiente${pedimentosPendientesCount === 1 ? '' : 's'} de documento`,
      microStatusWarning: pedimentosPendientesCount > 0,
    },
    catalogo: {
      count: null,
      series: [],
      microStatus: '—',
    },
    entradas: {
      count: entradasMesCount,
      series: entradasSeries,
      microStatus: `${entradasMesCount} recibida${entradasMesCount === 1 ? '' : 's'} en ${monthShort}`,
    },
    clasificaciones: {
      count: clasificacionesCount,
      series: clasificacionesSeries,
      microStatus: `${clasificacionesCount} fracciones clasificadas`,
    },
  }

  const estadoSections = (
    <>
      <MonthSelector
        ym={month.ym}
        label={month.label}
        prev={month.prev}
        next={month.next}
        options={monthOptions}
      />
      <AuditoriaShortcut />
      <PriorityThreadsPanel threads={escalatedThreads} />
      <div className="eagle-estado-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: 'var(--aguila-gap-card, 16px)',
      }}>
        <style>{`
          @media (max-width: 900px) {
            .eagle-estado-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
        <TraficosDelDiaTile buckets={traficosByStatus} />
        <ArApTile ar={ar} ap={ap} />
        <ClientesDormidosTile dormant={dormant} />
        <TopAtencionesTile items={atencionesTop} />
        <div style={{ gridColumn: 'span 2' }}>
          <CorredorTile />
        </div>
      </div>
    </>
  )

  const summaryLine = atencionesTop.length > 0
    ? `${atencionesTop.length} atencion${atencionesTop.length === 1 ? '' : 'es'} pendiente${atencionesTop.length === 1 ? '' : 's'} · vista ${month.label}.`
    : `Vista de ${month.label} · ${activeClients} clientes activos.`

  const inTransitCount = traficosByStatus
    .filter(b => b.status !== 'Cruzado' && b.status !== 'Cerrado')
    .reduce((s, b) => s + b.count, 0)

  const actividadSlot = (
    <TimelineFeed
      items={actividadItems}
      max={20}
      emptyLabel={`Sin escalaciones en ${month.label}.`}
    />
  )

  // v10 — ActividadStrip (owner: escalations + priority threads as chips)
  const stripItems: ActividadStripItem[] = [
    ...escalatedThreads.slice(0, 4).map((t) => ({
      id: `thr-${t.id}`,
      label: t.subject ?? 'Hilo escalado',
      detail: t.last_message_preview ?? t.company_id ?? undefined,
      timestamp: t.escalated_at ?? t.last_message_at ?? new Date().toISOString(),
      href: `/mensajeria/${encodeURIComponent(t.id)}`,
      tone: 'warning' as const,
    })),
    ...actividadItems.slice(0, 8).map((ti) => ({
      id: ti.id,
      label: ti.title,
      detail: ti.subtitle,
      timestamp: ti.timestamp,
      href: ti.href,
      tone: 'danger' as const,
    })),
  ]
  const actividadStripSlot = (
    <ActividadStrip items={stripItems} emptyLabel={`Sin actividad crítica en ${month.label}.`} title="Escalaciones + hilos" />
  )

  // v10 — Capability cards (owner scope)
  const capabilityCounts: CapabilityCounts = {
    checklist:    { count: pedimentosPendientesCount, microStatus: 'expedientes pendientes' },
    clasificador: { count: clasificacionesCount, microStatus: 'Sube · auto-clasifica · TIGIE' },
    mensajes:     { count: escalatedThreads.length, microStatus: escalatedThreads.length > 0 ? 'escalados' : '@ menciona a tu equipo' },
  }
  const capabilitySlot = <CapabilityCardGrid counts={capabilityCounts} />

  return (
    <CockpitInicio
      role="owner"
      name={opName}
      heroKPIs={heroKPIs}
      navCounts={navCounts}
      estadoSections={estadoSections}
      actividadSlot={actividadSlot}
      actividadStripSlot={actividadStripSlot}
      capabilitySlot={capabilitySlot}
      systemStatus={atencionesTop.length > 0 ? 'warning' : 'healthy'}
      pulseSignal={inTransitCount > 0}
      summaryLine={summaryLine}
    />
  )
}
