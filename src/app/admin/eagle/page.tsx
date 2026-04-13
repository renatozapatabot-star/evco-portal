/**
 * AGUILA · Eagle View (Tito) — v9 resilient aggregate cockpit.
 *
 * Every query soft-wrapped. Owner aggregates across ALL tenants (invariant 31).
 * Actividad reciente = escalation-only audit_log feed.
 * Escalated Mensajería threads surface as priority panel in estadoSections.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { computeARAging, computeAPAging } from '@/lib/contabilidad/aging'
import { fmtUSDCompact } from '@/lib/format-utils'
import { bucketDailySeries, sumRange, daysAgo } from '@/lib/cockpit/fetch'
import { softCount, softData, softFirst } from '@/lib/cockpit/safe-query'
import { auditLogAvailable } from '@/lib/cockpit/table-availability'
import { auditRowToTimelineItem, type AuditRow } from '@/lib/cockpit/audit-format'
import { fetchEscalatedThreads } from '@/lib/mensajeria/feed'
import { CockpitInicio, PriorityThreadsPanel, TimelineFeed, type CockpitHeroKPI } from '@/components/aguila'
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
const DORMANT_DAYS = 14

const ESCALATION_ACTIONS = [
  'draft_rejected', 'login_failed', 'oca_requested',
  'compliance_escalated', 'mve_critical', 'pedimento_rechazado',
  'data_exported',
]

function daysSinceISO(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
}

export default async function EaglePage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (!['admin', 'broker'].includes(session.role)) redirect('/')

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const opName = cookieStore.get('operator_name')?.value || 'Tito'

  const now = new Date()
  const fourteenDaysAgoIso = daysAgo(14, now).toISOString()
  const sevenDaysAgoIso = daysAgo(7, now).toISOString()
  const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    traficosRows,
    ar,
    ap,
    recentForDormantRows,
    companiesRows,
    auditAvailable,
    traficosActivosSeriesRows,
    pedimentosSeriesRows,
    expedientesSeriesRows,
    expedientesCount,
    entradasSeriesRows,
    entradasHoyCount,
    clasificacionesSeriesRows,
    clasificacionesCount,
    pedimentosPendientesCount,
    cruzados7dCount,
    pedimentosMonthCount,
    lastPedimento,
    entradas7dCount,
    mveRows,
    auditSuggestionsRows,
    escalatedThreads,
  ] = await Promise.all([
    softData<{ estatus: string | null }>(
      sb.from('traficos').select('estatus').in('estatus', MOTION_STATUSES).limit(5000)
    ),
    computeARAging(sb, null).catch(() => ({ total: 0, count: 0, byBucket: [], topDebtors: [], currency: 'MXN' as const })),
    computeAPAging(sb, null).catch(() => ({ total: 0, count: 0, byBucket: [], topDebtors: [], currency: 'USD' as const, sourceMissing: true })),
    softData<{ company_id: string | null; created_at: string }>(
      sb.from('traficos').select('company_id, created_at').gte('created_at', daysAgo(DORMANT_DAYS, now).toISOString()).limit(5000)
    ),
    softData<{ company_id: string; razon_social: string | null; is_active: boolean | null }>(
      sb.from('companies').select('company_id, razon_social, is_active').eq('is_active', true).limit(500)
    ),
    auditLogAvailable(sb),
    softData<{ updated_at: string }>(
      sb.from('traficos').select('updated_at').eq('estatus', 'En Proceso').gte('updated_at', fourteenDaysAgoIso).limit(2000)
    ),
    softData<{ fecha_llegada: string }>(
      sb.from('traficos').select('fecha_llegada').is('pedimento', null).gte('fecha_llegada', fourteenDaysAgoIso).limit(2000)
    ),
    softData<{ created_at: string }>(
      sb.from('expediente_documentos').select('created_at').gte('created_at', fourteenDaysAgoIso).limit(2000)
    ),
    softCount(sb.from('expediente_documentos').select('id', { count: 'exact', head: true })),
    softData<{ fecha_llegada_mercancia: string }>(
      sb.from('entradas').select('fecha_llegada_mercancia').gte('fecha_llegada_mercancia', fourteenDaysAgoIso).limit(2000)
    ),
    softCount(sb.from('entradas').select('id', { count: 'exact', head: true }).gte('fecha_llegada_mercancia', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())),
    softData<{ fraccion_classified_at: string }>(
      sb.from('globalpc_productos').select('fraccion_classified_at').not('fraccion_classified_at', 'is', null).gte('fraccion_classified_at', fourteenDaysAgoIso).limit(2000)
    ),
    softCount(sb.from('globalpc_productos').select('id', { count: 'exact', head: true }).not('fraccion_classified_at', 'is', null)),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).is('pedimento', null)),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).eq('estatus', 'Cruzado').gte('updated_at', sevenDaysAgoIso)),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).not('pedimento', 'is', null).gte('updated_at', monthStartIso)),
    softFirst<{ updated_at: string }>(
      sb.from('traficos').select('updated_at').not('pedimento', 'is', null).order('updated_at', { ascending: false }).limit(1)
    ),
    softCount(sb.from('entradas').select('id', { count: 'exact', head: true }).gte('fecha_llegada_mercancia', sevenDaysAgoIso)),
    softData<{ id: string; rule_code: string | null; trafico_id: string | null }>(
      sb.from('mve_alerts').select('id, rule_code, trafico_id').eq('severity', 'critical').eq('resolved', false).limit(10)
    ),
    softData<{ id: string; title: string | null }>(
      sb.from('audit_suggestions').select('id, title').eq('status', 'pending').limit(10)
    ),
    fetchEscalatedThreads(sb, 4),
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
      razonSocial: c.razon_social ?? c.company_id,
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

  // Audit escalations
  let auditRows: AuditRow[] = []
  if (auditAvailable) {
    auditRows = await softData<AuditRow>(
      sb.from('audit_log')
        .select('id, table_name, action, record_id, changed_at, company_id')
        .in('action', ESCALATION_ACTIONS)
        .order('changed_at', { ascending: false })
        .limit(8)
    )
  }
  const actividadItems = auditRows.map(auditRowToTimelineItem)

  // Series bucketing
  const traficosActivosSeries = bucketDailySeries(traficosActivosSeriesRows as Array<Record<string, unknown>>, 'updated_at', 14, now)
  const pedimentosPendSeries  = bucketDailySeries(pedimentosSeriesRows as Array<Record<string, unknown>>, 'fecha_llegada', 14, now)
  const expedientesSeries     = bucketDailySeries(expedientesSeriesRows as Array<Record<string, unknown>>, 'created_at', 14, now)
  const entradasSeries        = bucketDailySeries(entradasSeriesRows as Array<Record<string, unknown>>, 'fecha_llegada_mercancia', 14, now)
  const clasificacionesSeries = bucketDailySeries(clasificacionesSeriesRows as Array<Record<string, unknown>>, 'fraccion_classified_at', 14, now)

  const arTotal = ar.total ?? 0

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
      microStatus: `${cruzados7dCount} cruzaron esta semana`,
    },
    pedimentos: {
      count: pedimentosMonthCount,
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
      count: entradasHoyCount,
      series: entradasSeries,
      microStatus: `${entradas7dCount} recibida${entradas7dCount === 1 ? '' : 's'} esta semana`,
    },
    clasificaciones: {
      count: clasificacionesCount,
      series: clasificacionesSeries,
      microStatus: `${clasificacionesCount} fracciones clasificadas`,
    },
  }

  const estadoSections = (
    <>
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
    ? `${atencionesTop.length} atencion${atencionesTop.length === 1 ? '' : 'es'} pendiente${atencionesTop.length === 1 ? '' : 's'}.`
    : 'Una pantalla · seis señales · cero clics para decidir.'

  const inTransitCount = traficosByStatus
    .filter(b => b.status !== 'Cruzado' && b.status !== 'Cerrado')
    .reduce((s, b) => s + b.count, 0)

  const actividadSlot = <TimelineFeed items={actividadItems} max={8} emptyLabel="Sin escalaciones recientes." />

  return (
    <CockpitInicio
      role="owner"
      name={opName}
      heroKPIs={heroKPIs}
      navCounts={navCounts}
      estadoSections={estadoSections}
      actividadSlot={actividadSlot}
      systemStatus={atencionesTop.length > 0 ? 'warning' : 'healthy'}
      pulseSignal={inTransitCount > 0}
      summaryLine={summaryLine}
      metaPills={[
        { label: 'Activos', value: activeTraficosTotal },
        { label: 'Clientes', value: activeClients },
        { label: 'Dormidos', value: dormant.length, tone: dormant.length > 0 ? 'warning' : 'silver' },
        { label: 'CxC', value: fmtUSDCompact(arTotal) || '$0' },
      ]}
    />
  )
}
