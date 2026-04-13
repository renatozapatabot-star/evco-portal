import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase-server'
import { logOperatorAction } from '@/lib/operator-actions'
import { InicioClient } from './InicioClient'
import { bucketDailySeries, sumRange, startOfToday, daysAgo } from '@/lib/cockpit/fetch'
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

  // Nav card data for the canonical 6 tiles.
  const navCounts: import('@/lib/cockpit/nav-tiles').NavCounts = {
    traficos:        { count: personalRes.count ?? 0,               series: activosSeries },
    pedimentos:      { count: kpis.pendientes,                      series: pendientesSeries },
    expedientes:     { count: expedientesPendingRes.count ?? 0,     series: expedientesSeries },
    catalogo:        { count: null,                                  series: [] },
    entradas:        { count: kpis.entradasHoy,                     series: entradasSeries },
    clasificaciones: { count: clasificacionesTotalRes.count ?? 0,   series: clasificacionesSeries },
  }

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
    />
  )
}
