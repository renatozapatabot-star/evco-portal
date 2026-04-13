/**
 * AGUILA · V1.5 F6 → v7 — Eagle View (Tito's morning view).
 *
 * One cockpit, three role views (AGUILA v7): hero KPIs + 6 unified nav cards +
 * existing eagle tiles as estadoSections. Role-gated to admin + broker.
 * Actividad feed is unfiltered by company so the owner sees everything recent.
 */

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from '@/lib/session'
import { computeARAging, computeAPAging } from '@/lib/contabilidad/aging'
import { fmtUSDCompact } from '@/lib/format-utils'
import { bucketDailySeries, sumRange, daysAgo } from '@/lib/cockpit/fetch'
import { CockpitInicio, type CockpitHeroKPI, type TimelineItem } from '@/components/aguila'
import { TraficosDelDiaTile } from '@/components/eagle/TraficosDelDiaTile'
import { ArApTile } from '@/components/eagle/ArApTile'
import { ClientesDormidosTile } from '@/components/eagle/ClientesDormidosTile'
import { TopAtencionesTile } from '@/components/eagle/TopAtencionesTile'
import { CorredorTile } from '@/components/eagle/CorredorTile'
import type { NavCounts } from '@/lib/cockpit/nav-tiles'
import type {
  ActivityItem,
  AtencionItem,
  DormantClient,
  TraficoStatusBucket,
} from '@/app/api/eagle/overview/route'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MOTION_STATUSES = ['En Proceso', 'Documentacion', 'En Aduana', 'Pedimento Pagado', 'Cruzado']
const DORMANT_DAYS = 14

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

  const [
    traficosRes,
    ar,
    ap,
    recentForDormant,
    companiesRes,
    activityRes,
    traficosActivosSeriesRes,
    pedimentosSeriesRes,
    expedientesSeriesRes,
    expedientesCountRes,
    entradasSeriesRes,
    entradasHoyCountRes,
    clasificacionesSeriesRes,
    clasificacionesCountRes,
    pedimentosPendientesCountRes,
  ] = await Promise.all([
    sb.from('traficos')
      .select('estatus')
      .eq('company_id', session.companyId)
      .in('estatus', MOTION_STATUSES)
      .limit(5000),
    computeARAging(sb, session.companyId),
    computeAPAging(sb, session.companyId),
    sb.from('traficos')
      .select('company_id, created_at')
      .gte('created_at', daysAgo(DORMANT_DAYS, now).toISOString())
      .limit(5000),
    sb.from('companies').select('company_id, razon_social, is_active').eq('is_active', true).limit(500),
    // Unfiltered — owner sees EVERYTHING recent (plan rule).
    sb.from('workflow_events')
      .select('id, workflow, event_type, trigger_id, created_at, company_id')
      .order('created_at', { ascending: false })
      .limit(20),
    sb.from('traficos')
      .select('updated_at')
      .eq('company_id', session.companyId)
      .eq('estatus', 'En Proceso')
      .gte('updated_at', fourteenDaysAgoIso)
      .limit(2000),
    sb.from('traficos')
      .select('fecha_llegada')
      .eq('company_id', session.companyId)
      .is('pedimento', null)
      .gte('fecha_llegada', fourteenDaysAgoIso)
      .limit(2000),
    sb.from('expediente_documentos')
      .select('created_at')
      .gte('created_at', fourteenDaysAgoIso)
      .limit(2000),
    sb.from('expediente_documentos')
      .select('id', { count: 'exact', head: true }),
    sb.from('entradas')
      .select('fecha_llegada_mercancia')
      .gte('fecha_llegada_mercancia', fourteenDaysAgoIso)
      .limit(2000),
    sb.from('entradas')
      .select('id', { count: 'exact', head: true })
      .gte('fecha_llegada_mercancia', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()),
    sb.from('globalpc_productos')
      .select('fraccion_classified_at')
      .not('fraccion_classified_at', 'is', null)
      .gte('fraccion_classified_at', fourteenDaysAgoIso)
      .limit(2000),
    sb.from('globalpc_productos')
      .select('id', { count: 'exact', head: true })
      .not('fraccion_classified_at', 'is', null),
    sb.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .eq('company_id', session.companyId)
      .is('pedimento', null),
  ])

  // traficosByStatus
  const counts = new Map<string, number>()
  for (const r of (traficosRes.data ?? []) as { estatus: string | null }[]) {
    const s = r.estatus ?? 'Sin estado'
    counts.set(s, (counts.get(s) ?? 0) + 1)
  }
  const traficosByStatus: TraficoStatusBucket[] = Array.from(counts.entries()).map(([status, count]) => ({ status, count }))
  const activeTraficosTotal = traficosByStatus.reduce((s, b) => s + b.count, 0)

  // dormant (top 3)
  const activeIds = new Set<string>()
  for (const r of (recentForDormant.data ?? []) as { company_id: string | null }[]) {
    if (r.company_id) activeIds.add(r.company_id)
  }
  const dormantCandidates = ((companiesRes.data ?? []) as { company_id: string; razon_social: string | null }[])
    .filter((c) => !activeIds.has(c.company_id))
    .slice(0, 3)

  const dormant: DormantClient[] = []
  for (const c of dormantCandidates) {
    const { data: last } = await sb
      .from('traficos')
      .select('created_at, importe_total')
      .eq('company_id', c.company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const lastRow = last as { created_at: string | null; importe_total: number | null } | null
    const dias = lastRow?.created_at ? daysSinceISO(lastRow.created_at) : 999
    dormant.push({
      companyId: c.company_id,
      razonSocial: c.razon_social ?? c.company_id,
      diasSinMovimiento: dias,
      ultimoMonto: lastRow?.importe_total ?? null,
    })
  }

  // atenciones
  const atenciones: AtencionItem[] = []
  const { data: mveRows } = await sb
    .from('mve_alerts')
    .select('id, rule_code, trafico_id')
    .eq('company_id', session.companyId)
    .eq('severity', 'critical')
    .eq('resolved', false)
    .limit(10)
  for (const a of (mveRows ?? []) as { id: string; rule_code: string | null; trafico_id: string | null }[]) {
    atenciones.push({
      id: `mve-${a.id}`,
      kind: 'mve_critical',
      label: 'MVE crítico',
      detail: a.rule_code ?? a.trafico_id ?? 'Alerta sin código',
      href: '/mve/alerts',
      severityRank: 0,
    })
  }
  try {
    const { data: sugg } = await sb
      .from('audit_suggestions')
      .select('id, title, status')
      .eq('status', 'pending')
      .limit(10)
    if (sugg) {
      for (const s of sugg as { id: string; title: string | null }[]) {
        atenciones.push({
          id: `sugg-${s.id}`,
          kind: 'audit_suggestion',
          label: 'Sugerencia de auditoría',
          detail: s.title ?? 'Pendiente',
          href: '/admin/inicio',
          severityRank: 1,
        })
      }
    }
  } catch {
    // table absent — graceful
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

  const recentActivity = ((activityRes.data ?? []) as ActivityItem[]) ?? []

  // Series bucketing
  const traficosActivosSeries   = bucketDailySeries(traficosActivosSeriesRes.data as Array<Record<string, unknown>> | null, 'updated_at', 14, now)
  const pedimentosPendSeries    = bucketDailySeries(pedimentosSeriesRes.data as Array<Record<string, unknown>> | null, 'fecha_llegada', 14, now)
  const expedientesSeries       = bucketDailySeries(expedientesSeriesRes.data as Array<Record<string, unknown>> | null, 'created_at', 14, now)
  const entradasSeries          = bucketDailySeries(entradasSeriesRes.data as Array<Record<string, unknown>> | null, 'fecha_llegada_mercancia', 14, now)
  const clasificacionesSeries   = bucketDailySeries(clasificacionesSeriesRes.data as Array<Record<string, unknown>> | null, 'fraccion_classified_at', 14, now)

  // Hero KPIs for the owner — the business-owner at-a-glance four.
  const activeClients = (companiesRes.data ?? []).length
  const arTotal = ar.total ?? 0

  const heroKPIs: CockpitHeroKPI[] = [
    {
      key: 'traficos',
      label: 'Tráficos en proceso',
      value: activeTraficosTotal,
      series: traficosActivosSeries,
      current: sumRange(traficosActivosSeries, 7, 14),
      previous: sumRange(traficosActivosSeries, 0, 7),
      href: '/traficos?estatus=En+Proceso',
      tone: 'silver',
    },
    {
      key: 'clientes',
      label: 'Clientes activos',
      value: activeClients,
      tone: 'silver',
    },
    {
      key: 'dormidos',
      label: 'Clientes dormidos',
      value: dormant.length,
      tone: 'silver',
      inverted: true,
    },
    {
      key: 'ar',
      label: 'CxC vencido',
      value: fmtUSDCompact(arTotal) || '—',
      tone: 'silver',
      inverted: true,
    },
  ]

  const navCounts: NavCounts = {
    traficos:        { count: activeTraficosTotal,                 series: traficosActivosSeries },
    pedimentos:      { count: pedimentosPendientesCountRes.count ?? 0, series: pedimentosPendSeries },
    expedientes:     { count: expedientesCountRes.count ?? 0,      series: expedientesSeries },
    catalogo:        { count: null,                                 series: [] },
    entradas:        { count: entradasHoyCountRes.count ?? 0,      series: entradasSeries },
    clasificaciones: { count: clasificacionesCountRes.count ?? 0,  series: clasificacionesSeries },
  }

  const actividad: TimelineItem[] = recentActivity.slice(0, 12).map((a) => ({
    id: String(a.id),
    title: `${a.workflow} · ${a.event_type.replace(/_/g, ' ')}`,
    subtitle: a.trigger_id ?? undefined,
    timestamp: a.created_at,
  }))

  const estadoSections = (
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
  )

  const summaryLine = atencionesTop.length > 0
    ? `${atencionesTop.length} atencion${atencionesTop.length === 1 ? '' : 'es'} pendiente${atencionesTop.length === 1 ? '' : 's'}.`
    : 'Una pantalla · seis señales · cero clics para decidir.'

  return (
    <CockpitInicio
      role="owner"
      name={opName}
      heroKPIs={heroKPIs}
      navCounts={navCounts}
      estadoSections={estadoSections}
      actividad={actividad}
      actividadEmptyLabel="Sin actividad reciente en toda la plataforma."
      systemStatus={atencionesTop.length > 0 ? 'warning' : 'healthy'}
      summaryLine={summaryLine}
    />
  )
}
