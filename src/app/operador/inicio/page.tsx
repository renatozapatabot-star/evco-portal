import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createServerClient } from '@/lib/supabase-server'
import { logOperatorAction } from '@/lib/operator-actions'
import { InicioClient } from './InicioClient'
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
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString()
  const weekEnd = new Date(now.getTime() + 7 * 86400000).toISOString()

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
  ] = await Promise.all([
    sb.from('entradas')
      .select('cve_entrada', { count: 'exact', head: true })
      .gte('fecha_llegada_mercancia', todayStart),
    sb.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .eq('estatus', 'En Proceso'),
    sb.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .is('pedimento', null)
      .lte('fecha_llegada', weekEnd),
    sb.from('traficos')
      .select('trafico', { count: 'exact', head: true })
      .eq('estatus', 'En Proceso')
      .lte('updated_at', sevenDaysAgo),
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
          .gte('created_at', todayStart)
      : Promise.resolve({ count: 0 }),
    sb.from('workflow_events')
      .select('id', { count: 'exact', head: true })
      .in('status', ['pending', 'failed', 'dead_letter']),
    opId
      ? sb.from('traficos')
          .select('trafico', { count: 'exact', head: true })
          .eq('assigned_to_operator_id', opId)
          .eq('estatus', 'Cruzado')
          .gte('updated_at', sevenDaysAgo)
      : Promise.resolve({ count: 0 }),
    opId
      ? sb.from('traficos')
          .select('trafico', { count: 'exact', head: true })
          .eq('assigned_to_operator_id', opId)
          .eq('estatus', 'Cruzado')
          .gte('updated_at', fourteenDaysAgo)
          .lt('updated_at', sevenDaysAgo)
      : Promise.resolve({ count: 0 }),
    // 14-day series — bounded pulls, bucketed in JS below. Limit 2000 rows covers
    // EVCO volume comfortably; additional clients can graduate to an RPC if needed.
    sb.from('entradas')
      .select('fecha_llegada_mercancia')
      .gte('fecha_llegada_mercancia', fourteenDaysAgo)
      .limit(2000),
    sb.from('traficos')
      .select('updated_at')
      .eq('estatus', 'En Proceso')
      .gte('updated_at', fourteenDaysAgo)
      .limit(2000),
    sb.from('traficos')
      .select('fecha_llegada')
      .is('pedimento', null)
      .gte('fecha_llegada', fourteenDaysAgo)
      .limit(2000),
    sb.from('traficos')
      .select('updated_at')
      .eq('estatus', 'En Proceso')
      .gte('updated_at', fourteenDaysAgo)
      .lte('updated_at', sevenDaysAgo)
      .limit(2000),
  ])

  // Bucket timestamp rows into 14 daily counts (oldest → newest).
  const bucketDailySeries = (
    rows: Array<Record<string, unknown>> | null | undefined,
    key: string,
  ): number[] => {
    const buckets = new Array(14).fill(0)
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    for (const row of rows ?? []) {
      const v = row?.[key]
      if (typeof v !== 'string') continue
      const t = new Date(v).getTime()
      if (!Number.isFinite(t)) continue
      const daysAgo = Math.floor((dayStart - t) / 86400000)
      if (daysAgo < 0 || daysAgo > 13) continue
      buckets[13 - daysAgo] += 1
    }
    return buckets
  }
  const sumRange = (arr: number[], from: number, to: number) =>
    arr.slice(from, to).reduce((s, n) => s + n, 0)

  const entradasSeries  = bucketDailySeries(entradasSeriesRes.data as Array<Record<string, unknown>> | null, 'fecha_llegada_mercancia')
  const activosSeries   = bucketDailySeries(activosSeriesRes.data as Array<Record<string, unknown>> | null, 'updated_at')
  const pendientesSeries = bucketDailySeries(pendientesSeriesRes.data as Array<Record<string, unknown>> | null, 'fecha_llegada')
  const atrasadosSeries = bucketDailySeries(atrasadosSeriesRes.data as Array<Record<string, unknown>> | null, 'updated_at')

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
    />
  )
}
