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
import { auditRowToTimelineItem, type AuditRow } from '@/lib/cockpit/audit-format'
import { CockpitInicio, type CockpitHeroKPI } from '@/components/aguila'
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

// Owner Actividad Reciente — allowlist of audit actions that warrant the broker's attention.
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

  const [
    traficosRes,
    ar,
    ap,
    recentForDormant,
    companiesRes,
    auditRes,
    traficosActivosSeriesRes,
    pedimentosSeriesRes,
    expedientesSeriesRes,
    expedientesCountRes,
    entradasSeriesRes,
    entradasHoyCountRes,
    clasificacionesSeriesRes,
    clasificacionesCountRes,
    pedimentosPendientesCountRes,
    traficosCruzados7dRes,
    pedimentosMonthRes,
    lastPedimentoRes,
    catalogoYtdRowsRes,
    entradas7dRes,
    tmecCountRes,
    fraccionesRes,
    expedientesRowsRes,
  ] = await Promise.all([
    // Owner view aggregates across all tenants (invariant 31): no company_id filter.
    sb.from('traficos')
      .select('estatus')
      .in('estatus', MOTION_STATUSES)
      .limit(5000),
    computeARAging(sb, null),
    computeAPAging(sb, null),
    sb.from('traficos')
      .select('company_id, created_at')
      .gte('created_at', daysAgo(DORMANT_DAYS, now).toISOString())
      .limit(5000),
    sb.from('companies').select('company_id, razon_social, is_active').eq('is_active', true).limit(500),
    // audit_log — owner sees escalations only (plan D.1 allowlist).
    sb.from('audit_log')
      .select('id, table_name, action, record_id, changed_at, company_id, changed_by')
      .in('action', ESCALATION_ACTIONS)
      .order('changed_at', { ascending: false })
      .limit(5),
    sb.from('traficos')
      .select('updated_at')
      .eq('estatus', 'En Proceso')
      .gte('updated_at', fourteenDaysAgoIso)
      .limit(2000),
    sb.from('traficos')
      .select('fecha_llegada')
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
      .is('pedimento', null),
    // Secondary signals — cruzados 7d, pedimentos this month + last, catalogo YTD, entradas 7d, T-MEC
    sb.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .eq('estatus', 'Cruzado')
      .gte('updated_at', daysAgo(7, now).toISOString()),
    sb.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .not('pedimento', 'is', null)
      .gte('updated_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
    sb.from('traficos')
      .select('updated_at')
      .not('pedimento', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1),
    sb.from('traficos')
      .select('importe_total')
      .gte('fecha_cruce', new Date(now.getFullYear(), 0, 1).toISOString())
      .limit(5000),
    sb.from('entradas')
      .select('id', { count: 'exact', head: true })
      .gte('fecha_llegada_mercancia', daysAgo(7, now).toISOString()),
    sb.from('globalpc_productos')
      .select('id', { count: 'exact', head: true })
      .eq('tmec', true),
    sb.from('globalpc_productos')
      .select('fraccion')
      .not('fraccion_classified_at', 'is', null)
      .not('fraccion', 'is', null)
      .limit(5000),
    sb.from('expediente_documentos')
      .select('trafico_id, doc_type')
      .limit(5000),
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

  // atenciones — unfiltered; owner sees all critical alerts across tenants.
  const atenciones: AtencionItem[] = []
  const { data: mveRows } = await sb
    .from('mve_alerts')
    .select('id, rule_code, trafico_id')
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

  // Actividad reciente — audit_log escalations only for owner.
  const auditRows = (auditRes.data ?? []) as AuditRow[]
  const actividad = auditRows.map(auditRowToTimelineItem)

  // Series bucketing
  const traficosActivosSeries   = bucketDailySeries(traficosActivosSeriesRes.data as Array<Record<string, unknown>> | null, 'updated_at', 14, now)
  const pedimentosPendSeries    = bucketDailySeries(pedimentosSeriesRes.data as Array<Record<string, unknown>> | null, 'fecha_llegada', 14, now)
  const expedientesSeries       = bucketDailySeries(expedientesSeriesRes.data as Array<Record<string, unknown>> | null, 'created_at', 14, now)
  const entradasSeries          = bucketDailySeries(entradasSeriesRes.data as Array<Record<string, unknown>> | null, 'fecha_llegada_mercancia', 14, now)
  const clasificacionesSeries   = bucketDailySeries(clasificacionesSeriesRes.data as Array<Record<string, unknown>> | null, 'fraccion_classified_at', 14, now)

  // Hero KPIs for the owner — business-owner at-a-glance four, REAL aggregates.
  const activeClients = activeIds.size  // companies with traficos in last 14d
  const arTotal = ar.total ?? 0

  // Secondary-signal computed values
  const cruzados7d = traficosCruzados7dRes.count ?? 0
  const pedimentosMonth = pedimentosMonthRes.count ?? 0
  const lastPedimentoRow = (lastPedimentoRes.data ?? [])[0] as { updated_at: string | null } | undefined
  const daysSinceLastPedimento = lastPedimentoRow?.updated_at
    ? Math.floor((Date.now() - new Date(lastPedimentoRow.updated_at).getTime()) / 86400000)
    : null
  const catalogoYtdUsd = ((catalogoYtdRowsRes.data ?? []) as { importe_total: number | null }[])
    .reduce((s, r) => s + (Number(r.importe_total) || 0), 0)
  const entradas7d = entradas7dRes.count ?? 0
  const tmecCount = tmecCountRes.count ?? 0
  const uniqueFracciones = new Set(((fraccionesRes.data ?? []) as { fraccion: string | null }[])
    .map(r => r.fraccion).filter(Boolean)).size
  const expedientesRows = ((expedientesRowsRes.data ?? []) as { trafico_id: string | null; doc_type: string | null }[])
  const expedientesByTrafico = new Map<string, Set<string>>()
  for (const r of expedientesRows) {
    if (!r.trafico_id) continue
    const set = expedientesByTrafico.get(r.trafico_id) ?? new Set()
    if (r.doc_type) set.add(r.doc_type)
    expedientesByTrafico.set(r.trafico_id, set)
  }
  const REQUIRED_DOCS = ['pedimento', 'factura', 'lista_de_empaque']
  let expCompletos = 0
  for (const set of expedientesByTrafico.values()) {
    if (REQUIRED_DOCS.some(d => set.has(d))) expCompletos++
  }
  const expPct = expedientesByTrafico.size > 0
    ? Math.round((expCompletos / expedientesByTrafico.size) * 100)
    : 0
  const expPendientes = Math.max(0, expedientesByTrafico.size - expCompletos)
  const inTransitCount = traficosByStatus
    .filter(b => b.status !== 'Cruzado' && b.status !== 'Cerrado')
    .reduce((s, b) => s + b.count, 0)

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
    traficos: {
      count: activeTraficosTotal,
      series: traficosActivosSeries,
      microStatus: `${cruzados7d} cruzaron esta semana`,
    },
    pedimentos: {
      count: pedimentosMonth,
      series: pedimentosPendSeries,
      microStatus: daysSinceLastPedimento != null
        ? `Último hace ${daysSinceLastPedimento} día${daysSinceLastPedimento === 1 ? '' : 's'}`
        : 'Sin pedimentos recientes',
    },
    expedientes: {
      count: expPct,
      countSuffix: '%',
      series: expedientesSeries,
      microStatus: `${expPendientes} pendiente${expPendientes === 1 ? '' : 's'} de documento`,
      microStatusWarning: expPendientes > 0,
    },
    catalogo: {
      count: expedientesCountRes.count ?? 0,
      series: [],
      microStatus: `${fmtUSDCompact(catalogoYtdUsd) || '$0'} importado este año`,
    },
    entradas: {
      count: entradasHoyCountRes.count ?? 0,
      series: entradasSeries,
      microStatus: `${entradas7d} recibida${entradas7d === 1 ? '' : 's'} esta semana`,
    },
    clasificaciones: {
      count: uniqueFracciones,
      series: clasificacionesSeries,
      microStatus: `${tmecCount} con T-MEC aplicado`,
    },
  }

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
