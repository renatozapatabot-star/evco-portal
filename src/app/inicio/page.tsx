// AGUILA · /inicio — cliente cockpit (V1.5 F11 → v7).
//
// Client surface composes the unified cockpit. Invariant 24 preserved:
// no DeltaIndicator, no SeverityRibbon, no amber/red sparklines — silver only.
// Sparklines show positive-direction aggregates (your shipments, your entradas).
//
// Non-client roles (operator/admin/broker/warehouse/contabilidad) are
// redirected to their usual cockpit at `/`.

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { logOperatorAction } from '@/lib/operator-actions'
import {
  getClienteActiveTraficos,
  getClienteDocuments,
  getClienteNotifications,
} from '@/lib/cliente/dashboard'
import { bucketDailySeries, daysAgo, startOfToday } from '@/lib/cockpit/fetch'
import { fmtUSDCompact } from '@/lib/format-utils'
import { CockpitInicio, type CockpitHeroKPI } from '@/components/aguila'
import { ClienteEstado } from '@/components/cliente/ClienteEstado'
import { auditRowToTimelineItem, type AuditRow } from '@/lib/cockpit/audit-format'
import type { NavCounts } from '@/lib/cockpit/nav-tiles'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function InicioPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value ?? ''
  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (session.role !== 'client') redirect('/')

  const supabase = createServerClient()
  const companyId = session.companyId
  const now = new Date()
  const todayStartIso = startOfToday(now).toISOString()
  const sevenDaysAgoIso = daysAgo(7, now).toISOString()
  const fourteenDaysAgoIso = daysAgo(14, now).toISOString()
  const thirtyDaysAgoIso = daysAgo(30, now).toISOString()

  const [
    activeTraficos,
    documentos,
    notificaciones,
    companyRow,
    traficosActivosSeriesRes,
    pedimentosListosSeriesRes,
    expedientesSeriesRes,
    entradasSeriesRes,
    clasificacionesSeriesRes,
    cruzadosMesRes,
    cruzadosMesSeriesRes,
    entradasSemanaRes,
    pedimentosListosCountRes,
    expedientesCountRes,
    catalogoCountRes,
    clasificacionesCountRes,
    cruzados7dRes,
    pedimentosMonthRes,
    lastPedimentoRes,
    catalogoYtdRowsRes,
    tmecCountRes,
    fraccionesRes,
    expedientesRowsRes,
    auditRes,
  ] = await Promise.all([
    getClienteActiveTraficos(supabase, companyId),
    getClienteDocuments(supabase, companyId),
    getClienteNotifications(supabase, companyId),
    supabase.from('companies').select('name').eq('company_id', companyId).maybeSingle(),
    // Series: 14-day buckets, all client-scoped
    supabase.from('traficos')
      .select('updated_at')
      .eq('company_id', companyId)
      .eq('estatus', 'En Proceso')
      .gte('updated_at', fourteenDaysAgoIso)
      .limit(2000),
    supabase.from('traficos')
      .select('updated_at')
      .eq('company_id', companyId)
      .not('pedimento', 'is', null)
      .gte('updated_at', fourteenDaysAgoIso)
      .limit(2000),
    supabase.from('expediente_documentos')
      .select('created_at, trafico_id')
      .gte('created_at', fourteenDaysAgoIso)
      .limit(2000),
    supabase.from('entradas')
      .select('fecha_llegada_mercancia')
      .eq('company_id', companyId)
      .gte('fecha_llegada_mercancia', fourteenDaysAgoIso)
      .limit(2000),
    supabase.from('globalpc_productos')
      .select('fraccion_classified_at, cve_cliente')
      .not('fraccion_classified_at', 'is', null)
      .gte('fraccion_classified_at', fourteenDaysAgoIso)
      .limit(2000),
    // Hero: "Cruces este mes" — Cruzado status in last 30d
    supabase.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('estatus', 'Cruzado')
      .gte('updated_at', thirtyDaysAgoIso),
    supabase.from('traficos')
      .select('updated_at')
      .eq('company_id', companyId)
      .eq('estatus', 'Cruzado')
      .gte('updated_at', fourteenDaysAgoIso)
      .limit(2000),
    // Hero: entradas this week
    supabase.from('entradas')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('fecha_llegada_mercancia', sevenDaysAgoIso),
    // Nav counts (client-scoped)
    supabase.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .not('pedimento', 'is', null),
    // Total client documents
    supabase.from('expediente_documentos')
      .select('id', { count: 'exact', head: true }),
    // Catálogo: client's products count
    supabase.from('globalpc_productos')
      .select('id', { count: 'exact', head: true }),
    // Clasificaciones: client's classified products
    supabase.from('globalpc_productos')
      .select('id', { count: 'exact', head: true })
      .not('fraccion_classified_at', 'is', null),
    // v8 secondary signals (client — company-scoped)
    supabase.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('estatus', 'Cruzado')
      .gte('updated_at', sevenDaysAgoIso),
    supabase.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .not('pedimento', 'is', null)
      .gte('updated_at', new Date(now.getFullYear(), now.getMonth(), 1).toISOString()),
    supabase.from('traficos')
      .select('updated_at')
      .eq('company_id', companyId)
      .not('pedimento', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1),
    supabase.from('traficos')
      .select('importe_total')
      .eq('company_id', companyId)
      .gte('fecha_cruce', new Date(now.getFullYear(), 0, 1).toISOString())
      .limit(5000),
    supabase.from('globalpc_productos')
      .select('id', { count: 'exact', head: true })
      .eq('tmec', true),
    supabase.from('globalpc_productos')
      .select('fraccion')
      .not('fraccion_classified_at', 'is', null)
      .not('fraccion', 'is', null)
      .limit(5000),
    supabase.from('expediente_documentos')
      .select('trafico_id, doc_type')
      .limit(5000),
    // v8 audit feed — company-scoped
    supabase.from('audit_log')
      .select('id, table_name, action, record_id, changed_at, company_id')
      .eq('company_id', companyId)
      .order('changed_at', { ascending: false })
      .limit(8),
  ])

  const companyName = (companyRow?.data?.name as string) ?? ''

  // Telemetry — fire-and-forget
  const opId = cookieStore.get('operator_id')?.value
  logOperatorAction({
    operatorId: opId,
    actionType: 'view_page',
    targetId: '/inicio',
    companyId,
    payload: {
      event: 'cliente_inicio_viewed',
      active_traficos: activeTraficos.length,
      documentos: documentos.length,
      notificaciones: notificaciones.length,
    },
  })

  const traficosActivosSeries = bucketDailySeries(traficosActivosSeriesRes.data as Array<Record<string, unknown>> | null, 'updated_at', 14, now)
  const pedimentosListosSeries = bucketDailySeries(pedimentosListosSeriesRes.data as Array<Record<string, unknown>> | null, 'updated_at', 14, now)
  const expedientesSeries = bucketDailySeries(expedientesSeriesRes.data as Array<Record<string, unknown>> | null, 'created_at', 14, now)
  const entradasSeries = bucketDailySeries(entradasSeriesRes.data as Array<Record<string, unknown>> | null, 'fecha_llegada_mercancia', 14, now)
  const clasificacionesSeries = bucketDailySeries(clasificacionesSeriesRes.data as Array<Record<string, unknown>> | null, 'fraccion_classified_at', 14, now)
  const cruzadosMesSeries = bucketDailySeries(cruzadosMesSeriesRes.data as Array<Record<string, unknown>> | null, 'updated_at', 14, now)

  // Hero KPIs for client — silver tone only, no deltas (invariant 24).
  const heroKPIs: CockpitHeroKPI[] = [
    {
      key: 'traficos',
      label: 'Tráficos activos',
      value: activeTraficos.length,
      series: traficosActivosSeries,
      href: '/traficos',
      tone: 'silver',
    },
    {
      key: 'entradas',
      label: 'Entradas esta semana',
      value: entradasSemanaRes.count ?? 0,
      series: entradasSeries,
      href: '/entradas',
      tone: 'silver',
    },
    {
      key: 'pedimentos',
      label: 'Pedimentos listos',
      value: pedimentosListosCountRes.count ?? 0,
      series: pedimentosListosSeries,
      href: '/pedimentos',
      tone: 'silver',
    },
    {
      key: 'cruces',
      label: 'Cruces este mes',
      value: cruzadosMesRes.count ?? 0,
      series: cruzadosMesSeries,
      href: '/traficos?estatus=Cruzado',
      tone: 'silver',
    },
  ]

  // v8 secondary-signal derivations (client)
  const cruzados7d = cruzados7dRes.count ?? 0
  const pedimentosMonth = pedimentosMonthRes.count ?? 0
  const lastPedRow = (lastPedimentoRes.data ?? [])[0] as { updated_at: string | null } | undefined
  const daysSinceLastPedimento = lastPedRow?.updated_at
    ? Math.floor((Date.now() - new Date(lastPedRow.updated_at).getTime()) / 86400000)
    : null
  const catalogoYtdUsd = ((catalogoYtdRowsRes.data ?? []) as { importe_total: number | null }[])
    .reduce((s, r) => s + (Number(r.importe_total) || 0), 0)
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

  const navCounts: NavCounts = {
    traficos: {
      count: activeTraficos.length,
      series: traficosActivosSeries,
      microStatus: `${cruzados7d} cruzaron esta semana`,
    },
    pedimentos: {
      count: pedimentosMonth,
      series: pedimentosListosSeries,
      microStatus: daysSinceLastPedimento != null
        ? `Último hace ${daysSinceLastPedimento} día${daysSinceLastPedimento === 1 ? '' : 's'}`
        : 'Sin pedimentos recientes',
    },
    expedientes: {
      count: expPct,
      countSuffix: '%',
      series: expedientesSeries,
      microStatus: `${expPendientes} pendiente${expPendientes === 1 ? '' : 's'} de documento`,
    },
    catalogo: {
      count: catalogoCountRes.count ?? 0,
      series: [],
      microStatus: `${fmtUSDCompact(catalogoYtdUsd) || '$0'} importado este año`,
    },
    entradas: {
      count: entradasSemanaRes.count ?? 0,
      series: entradasSeries,
      microStatus: `${entradasSemanaRes.count ?? 0} recibida${(entradasSemanaRes.count ?? 0) === 1 ? '' : 's'} esta semana`,
    },
    clasificaciones: {
      count: uniqueFracciones,
      series: clasificacionesSeries,
      microStatus: `${tmecCount} con T-MEC aplicado`,
    },
  }

  // Actividad reciente — audit_log (AGUILA v8 canonical). Company-scoped.
  const actividad = ((auditRes.data ?? []) as AuditRow[]).slice(0, 8).map(auditRowToTimelineItem)
  // Legacy notifications kept populated for backward compat; not rendered in v8 feed.
  void notificaciones

  const estadoSections = (
    <ClienteEstado
      activeTraficos={activeTraficos}
      documentos={documentos}
    />
  )

  const summaryLine = activeTraficos.length > 0
    ? `${activeTraficos.length} tráfico${activeTraficos.length === 1 ? '' : 's'} en movimiento. Tu patente, en tiempo real.`
    : 'Sin tráficos activos. Tus próximas operaciones aparecerán aquí.'

  return (
    <CockpitInicio
      role="client"
      name={companyName || 'Tu portal'}
      companyName={companyName || 'Tu portal'}
      heroKPIs={heroKPIs}
      navCounts={navCounts}
      estadoSections={estadoSections}
      actividad={actividad}
      actividadEmptyLabel="Sin actividad reciente."
      summaryLine={summaryLine}
      pulseSignal={activeTraficos.length > 0}
      metaPills={[
        { label: 'Activos', value: activeTraficos.length },
        { label: 'Semana', value: entradasSemanaRes.count ?? 0 },
        { label: 'Completos', value: `${expPct}%` },
        { label: 'Mes', value: pedimentosMonth },
      ]}
    />
  )
}
