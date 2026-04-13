import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase-server'
import { logOperatorAction } from '@/lib/operator-actions'
import { InicioClient } from './InicioClient'
import { bucketDailySeries, sumRange, startOfToday, daysAgo } from '@/lib/cockpit/fetch'
import { fmtUSDCompact } from '@/lib/format-utils'
import type { TraficoRow, DecisionRow, SystemStatus } from './types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OperadorInicioPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value
  const opId = cookieStore.get('operator_id')?.value
  const opName = cookieStore.get('operator_name')?.value || 'Operador'

  if (!role || !['admin', 'broker', 'operator'].includes(role)) {
    redirect('/')
  }

  if (opId) {
    logOperatorAction({ operatorId: opId, actionType: 'view_page', targetId: '/operador/inicio' })
  }

  const sb = createServerClient()
  const now = new Date()
  const todayStartIso = startOfToday(now).toISOString()
  const sevenDaysAgoIso = daysAgo(7, now).toISOString()
  const fourteenDaysAgoIso = daysAgo(14, now).toISOString()
  const weekEndIso = new Date(now.getTime() + 7 * 86400000).toISOString()

  const [
    entradasHoyRes,
    activosRes,
    pendientesRes,
    atrasadosRes,
    activeTraficosRes,
    feedRes,
    personalRes,
    personalDoneRes,
    colaCountRes,
    personalCompletedThisWeekRes,
    personalCompletedLastWeekRes,
    entradasSeriesRes,
    activosSeriesRes,
    pendientesSeriesRes,
    atrasadosSeriesRes,
    expedientesSeriesRes,
    expedientesPendingRes,
    clasificacionesSeriesRes,
    clasificacionesTotalRes,
    cruzados7dRes,
    pedimentosMonthRes,
    lastPedimentoRes,
    catalogoYtdRowsRes,
    entradas7dRes,
    tmecCountRes,
    fraccionesRes,
    expedientesRowsRes,
    auditRes,
  ] = await Promise.all([
    sb.from('entradas')
      .select('cve_entrada', { count: 'exact', head: true })
      .gte('fecha_llegada_mercancia', todayStartIso),
    sb.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .eq('estatus', 'En Proceso'),
    sb.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .is('pedimento', null)
      .lte('fecha_llegada', weekEndIso),
    sb.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .eq('estatus', 'En Proceso')
      .lte('updated_at', sevenDaysAgoIso),
    sb.from('traficos')
      .select('trafico, company_id, estatus, descripcion_mercancia, pedimento, fecha_llegada, updated_at, assigned_to_operator_id, proveedores')
      .eq('estatus', 'En Proceso')
      .order('updated_at', { ascending: false })
      .limit(25),
    sb.from('operational_decisions')
      .select('id, trafico, company_id, decision_type, decision, created_at, data_points_used')
      .order('created_at', { ascending: false })
      .limit(10),
    opId
      ? sb.from('traficos')
          .select('trafico', { count: 'exact', head: true })
          .eq('assigned_to_operator_id', opId)
          .eq('estatus', 'En Proceso')
      : Promise.resolve({ count: 0 }),
    opId
      ? sb.from('operator_actions')
          .select('id', { count: 'exact', head: true })
          .eq('operator_id', opId)
          .gte('created_at', todayStartIso)
      : Promise.resolve({ count: 0 }),
    sb.from('workflow_events')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'failed', 'dead_letter']),
    opId
      ? sb.from('traficos')
          .select('trafico', { count: 'exact', head: true })
          .eq('assigned_to_operator_id', opId)
          .eq('estatus', 'Cruzado')
          .gte('updated_at', sevenDaysAgoIso)
      : Promise.resolve({ count: 0 }),
    opId
      ? sb.from('traficos')
          .select('trafico', { count: 'exact', head: true })
          .eq('assigned_to_operator_id', opId)
          .eq('estatus', 'Cruzado')
          .gte('updated_at', fourteenDaysAgoIso)
          .lt('updated_at', sevenDaysAgoIso)
      : Promise.resolve({ count: 0 }),
    sb.from('entradas')
      .select('fecha_llegada_mercancia')
      .gte('fecha_llegada_mercancia', fourteenDaysAgoIso)
      .limit(2000),
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
    sb.from('traficos')
      .select('updated_at')
      .eq('estatus', 'En Proceso')
      .gte('updated_at', fourteenDaysAgoIso)
      .lte('updated_at', sevenDaysAgoIso)
      .limit(2000),
    sb.from('expediente_documentos')
      .select('created_at')
      .gte('created_at', fourteenDaysAgoIso)
      .limit(2000),
    sb.from('expediente_documentos')
      .select('id', { count: 'exact', head: true }),
    sb.from('globalpc_productos')
      .select('fraccion_classified_at')
      .not('fraccion_classified_at', 'is', null)
      .gte('fraccion_classified_at', fourteenDaysAgoIso)
      .limit(2000),
    sb.from('globalpc_productos')
      .select('id', { count: 'exact', head: true })
      .not('fraccion_classified_at', 'is', null),
    // v8 secondary signals (operator — ops-wide)
    sb.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .eq('estatus', 'Cruzado')
      .gte('updated_at', sevenDaysAgoIso),
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
      .gte('fecha_llegada_mercancia', sevenDaysAgoIso),
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
    // v8 audit feed — ops-wide for operator
    sb.from('audit_log')
      .select('id, table_name, action, record_id, changed_at, company_id')
      .order('changed_at', { ascending: false })
      .limit(8),
  ])

  const entradasSeries     = bucketDailySeries(entradasSeriesRes.data as Array<Record<string, unknown>> | null, 'fecha_llegada_mercancia', 14, now)
  const activosSeries      = bucketDailySeries(activosSeriesRes.data as Array<Record<string, unknown>> | null, 'updated_at', 14, now)
  const pendientesSeries   = bucketDailySeries(pendientesSeriesRes.data as Array<Record<string, unknown>> | null, 'fecha_llegada', 14, now)
  const atrasadosSeries    = bucketDailySeries(atrasadosSeriesRes.data as Array<Record<string, unknown>> | null, 'updated_at', 14, now)
  const expedientesSeries  = bucketDailySeries(expedientesSeriesRes.data as Array<Record<string, unknown>> | null, 'created_at', 14, now)
  const clasificacionesSeries = bucketDailySeries(clasificacionesSeriesRes.data as Array<Record<string, unknown>> | null, 'fraccion_classified_at', 14, now)

  const kpis = {
    entradasHoy: entradasHoyRes.count || 0,
    activos: activosRes.count || 0,
    pendientes: pendientesRes.count || 0,
    atrasados: atrasadosRes.count || 0,
    entradasSeries,
    activosSeries,
    pendientesSeries,
    atrasadosSeries,
    entradasCurr7: sumRange(entradasSeries, 7, 14),
    entradasPrev7: sumRange(entradasSeries, 0, 7),
    activosCurr7: sumRange(activosSeries, 7, 14),
    activosPrev7: sumRange(activosSeries, 0, 7),
    pendientesCurr7: sumRange(pendientesSeries, 7, 14),
    pendientesPrev7: sumRange(pendientesSeries, 0, 7),
    atrasadosCurr7: sumRange(atrasadosSeries, 7, 14),
    atrasadosPrev7: sumRange(atrasadosSeries, 0, 7),
  }

  const traficos = (activeTraficosRes.data || []) as TraficoRow[]
  const feed = (feedRes.data || []) as DecisionRow[]

  const colaCount = colaCountRes.count || 0
  const systemStatus: SystemStatus =
    kpis.atrasados > 0 || colaCount > 0 ? 'warning' : 'healthy'
  const summaryLine = colaCount > 0
    ? `${colaCount} en cola${kpis.atrasados > 0 ? ` · ${kpis.atrasados} atrasados` : ''}`
    : kpis.atrasados > 0
    ? `${kpis.atrasados} tráfico${kpis.atrasados === 1 ? '' : 's'} atrasado${kpis.atrasados === 1 ? '' : 's'} >7 días`
    : 'Sin pendientes inmediatos.'

  // v8 secondary-signal derivations
  const cruzados7d = cruzados7dRes.count ?? 0
  const pedimentosMonth = pedimentosMonthRes.count ?? 0
  const lastPedRow = (lastPedimentoRes.data ?? [])[0] as { updated_at: string | null } | undefined
  const daysSinceLastPedimento = lastPedRow?.updated_at
    ? Math.floor((Date.now() - new Date(lastPedRow.updated_at).getTime()) / 86400000)
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

  // Nav card data for the canonical 6 tiles (operator — ops-wide with secondary signal).
  const navCounts: import('@/lib/cockpit/nav-tiles').NavCounts = {
    traficos: {
      count: personalRes.count ?? 0,
      series: activosSeries,
      microStatus: `${cruzados7d} cruzaron esta semana`,
    },
    pedimentos: {
      count: pedimentosMonth,
      series: pendientesSeries,
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
      count: expedientesPendingRes.count ?? 0,
      series: [],
      microStatus: `${fmtUSDCompact(catalogoYtdUsd) || '$0'} importado este año`,
    },
    entradas: {
      count: kpis.entradasHoy,
      series: entradasSeries,
      microStatus: `${entradas7d} recibida${entradas7d === 1 ? '' : 's'} esta semana`,
    },
    clasificaciones: {
      count: uniqueFracciones,
      series: clasificacionesSeries,
      microStatus: `${tmecCount} con T-MEC aplicado`,
    },
  }

  // Audit rows for Actividad Reciente — ops-wide for operator
  const auditRows = (auditRes.data ?? []) as import('@/lib/cockpit/audit-format').AuditRow[]

  // pulseSignal — pulse when there's work in transit
  const inTransit = kpis.activos > 0

  return (
    <InicioClient
      operatorName={opName}
      operatorId={opId || ''}
      kpis={kpis}
      traficos={traficos}
      feed={feed}
      personalAssigned={personalRes.count || 0}
      personalDone={personalDoneRes.count || 0}
      colaCount={colaCount}
      systemStatus={systemStatus}
      summaryLine={summaryLine}
      personalCompletedThisWeek={personalCompletedThisWeekRes.count || 0}
      personalCompletedLastWeek={personalCompletedLastWeekRes.count || 0}
      navCounts={navCounts}
      auditRows={auditRows}
      pulseSignal={inTransit}
    />
  )
}
