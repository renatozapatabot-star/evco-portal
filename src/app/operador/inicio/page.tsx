import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { Suspense } from 'react'
import { createServerClient } from '@/lib/supabase-server'
import { logOperatorAction } from '@/lib/operator-actions'
import { InicioClient } from './InicioClient'
import { bucketDailySeries, sumRange, startOfToday, daysAgo } from '@/lib/cockpit/fetch'
import { softCount, softData, softFirst } from '@/lib/cockpit/safe-query'
import { auditLogAvailable } from '@/lib/cockpit/table-availability'
import { fetchOperatorMensajeriaFeed, fetchEscalatedThreads } from '@/lib/mensajeria/feed'
import { parseMonthParam } from '@/lib/cockpit/month-window'
import { CockpitSkeleton } from '@/components/aguila'
import type { TraficoRow, DecisionRow, SystemStatus } from './types'
import type { AuditRow } from '@/lib/cockpit/audit-format'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/** Hard timeout race — every helper bounded so SSR never blocks past Vercel function limits. */
function withHardTimeout<T>(p: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    Promise.resolve(p).catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

export default async function OperadorInicioPage({ searchParams }: { searchParams?: Promise<{ month?: string }> }) {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value
  const opId = cookieStore.get('operator_id')?.value
  const opName = cookieStore.get('operator_name')?.value || 'Operador'

  if (!role || !['admin', 'broker', 'operator'].includes(role)) {
    redirect('/')
  }

  const sp = (await searchParams) ?? {}
  const month = parseMonthParam(sp.month).ym

  if (opId) {
    try {
      logOperatorAction({ operatorId: opId, actionType: 'view_page', targetId: '/operador/inicio' })
    } catch { /* telemetry never crashes the page */ }
  }

  return (
    <Suspense fallback={<CockpitSkeleton />}>
      <OperatorCockpitContent role={role} opId={opId || ''} opName={opName} month={month} />
    </Suspense>
  )
}

async function OperatorCockpitContent({ role, opId, opName, month }: { role: string; opId: string; opName: string; month: string }) {
  void role
  return await loadOperatorCockpit(opId, opName, month).catch((err) => {
    return (
      <div style={{ padding: 40, color: '#E6EDF3', fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
        No se pudo cargar el cockpit del operador: {err instanceof Error ? err.message : String(err)}
      </div>
    )
  })
}

async function loadOperatorCockpit(opId: string, opName: string, month: string) {

  const sb = createServerClient()
  const now = new Date()
  const todayStartIso = startOfToday(now).toISOString()
  const sevenDaysAgoIso = daysAgo(7, now).toISOString()
  const fourteenDaysAgoIso = daysAgo(14, now).toISOString()
  const weekEndIso = new Date(now.getTime() + 7 * 86400000).toISOString()
  const monthStartIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [
    entradasHoyCount,
    activosCount,
    pendientesCount,
    atrasadosCount,
    activeTraficosRows,
    operationalDecisionsRows,
    personalAssignedCount,
    personalDoneCount,
    colaCount,
    personalCompletedThisWeekCount,
    personalCompletedLastWeekCount,
    entradasSeriesRows,
    activosSeriesRows,
    pendientesSeriesRows,
    atrasadosSeriesRows,
    expedientesSeriesRows,
    expedientesTotalCount,
    clasificacionesSeriesRows,
    clasificacionesTotalCount,
    cruzados7dCount,
    pedimentosMonthCount,
    lastPedimento,
    entradas7dCount,
    auditAvailable,
    mensajeriaMessages,
    escalatedThreads,
  ] = await Promise.all([
    softCount(sb.from('entradas').select('cve_entrada', { count: 'exact', head: true }).gte('fecha_llegada_mercancia', todayStartIso)),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).eq('estatus', 'En Proceso')),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).is('pedimento', null).lte('fecha_llegada', weekEndIso)),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).eq('estatus', 'En Proceso').lte('updated_at', sevenDaysAgoIso)),
    softData<TraficoRow>(
      sb.from('traficos')
        .select('trafico, company_id, estatus, descripcion_mercancia, pedimento, fecha_llegada, updated_at, assigned_to_operator_id, proveedores')
        .eq('estatus', 'En Proceso')
        .order('updated_at', { ascending: false })
        .limit(25)
    ),
    softData<DecisionRow>(
      sb.from('operational_decisions')
        .select('id, trafico, company_id, decision_type, decision, created_at, data_points_used')
        .order('created_at', { ascending: false })
        .limit(10)
    ),
    opId
      ? softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).eq('assigned_to_operator_id', opId).eq('estatus', 'En Proceso'))
      : Promise.resolve(0),
    opId
      ? softCount(sb.from('operator_actions').select('id', { count: 'exact', head: true }).eq('operator_id', opId).gte('created_at', todayStartIso))
      : Promise.resolve(0),
    softCount(sb.from('workflow_events').select('id', { count: 'exact', head: true }).in('status', ['pending', 'failed', 'dead_letter'])),
    opId
      ? softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).eq('assigned_to_operator_id', opId).eq('estatus', 'Cruzado').gte('updated_at', sevenDaysAgoIso))
      : Promise.resolve(0),
    opId
      ? softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).eq('assigned_to_operator_id', opId).eq('estatus', 'Cruzado').gte('updated_at', fourteenDaysAgoIso).lt('updated_at', sevenDaysAgoIso))
      : Promise.resolve(0),
    softData<{ fecha_llegada_mercancia: string }>(
      sb.from('entradas').select('fecha_llegada_mercancia').gte('fecha_llegada_mercancia', fourteenDaysAgoIso).limit(2000)
    ),
    softData<{ updated_at: string }>(
      sb.from('traficos').select('updated_at').eq('estatus', 'En Proceso').gte('updated_at', fourteenDaysAgoIso).limit(2000)
    ),
    softData<{ fecha_llegada: string }>(
      sb.from('traficos').select('fecha_llegada').is('pedimento', null).gte('fecha_llegada', fourteenDaysAgoIso).limit(2000)
    ),
    softData<{ updated_at: string }>(
      sb.from('traficos').select('updated_at').eq('estatus', 'En Proceso').gte('updated_at', fourteenDaysAgoIso).lte('updated_at', sevenDaysAgoIso).limit(2000)
    ),
    softData<{ uploaded_at: string }>(
      sb.from('expediente_documentos').select('uploaded_at').gte('uploaded_at', fourteenDaysAgoIso).limit(2000)
    ),
    softCount(sb.from('expediente_documentos').select('id', { count: 'exact', head: true })),
    softData<{ fraccion_classified_at: string }>(
      sb.from('globalpc_productos').select('fraccion_classified_at').not('fraccion_classified_at', 'is', null).gte('fraccion_classified_at', fourteenDaysAgoIso).limit(2000)
    ),
    softCount(sb.from('globalpc_productos').select('id', { count: 'exact', head: true }).not('fraccion', 'is', null)),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).eq('estatus', 'Cruzado').gte('updated_at', sevenDaysAgoIso)),
    softCount(sb.from('traficos').select('trafico', { count: 'exact', head: true }).not('pedimento', 'is', null).gte('updated_at', monthStartIso)),
    softFirst<{ updated_at: string }>(
      sb.from('traficos').select('updated_at').not('pedimento', 'is', null).order('updated_at', { ascending: false }).limit(1)
    ),
    softCount(sb.from('entradas').select('id', { count: 'exact', head: true }).gte('fecha_llegada_mercancia', sevenDaysAgoIso)),
    withHardTimeout(auditLogAvailable(sb), 2000, false),
    withHardTimeout(fetchOperatorMensajeriaFeed(sb, 10), 3000, []),
    withHardTimeout(fetchEscalatedThreads(sb, 3), 3000, []),
  ])

  const entradasSeries = bucketDailySeries(entradasSeriesRows as Array<Record<string, unknown>>, 'fecha_llegada_mercancia', 14, now)
  const activosSeries  = bucketDailySeries(activosSeriesRows  as Array<Record<string, unknown>>, 'updated_at', 14, now)
  const pendientesSeries = bucketDailySeries(pendientesSeriesRows as Array<Record<string, unknown>>, 'fecha_llegada', 14, now)
  const atrasadosSeries  = bucketDailySeries(atrasadosSeriesRows  as Array<Record<string, unknown>>, 'updated_at', 14, now)
  const expedientesSeries = bucketDailySeries(expedientesSeriesRows as Array<Record<string, unknown>>, 'uploaded_at', 14, now)
  const clasificacionesSeries = bucketDailySeries(clasificacionesSeriesRows as Array<Record<string, unknown>>, 'fraccion_classified_at', 14, now)

  const kpis = {
    entradasHoy: entradasHoyCount,
    // Hero "Tráficos activos" is the operator's own assignments — NOT ops-wide.
    // The ops-wide count (activosCount) stays available for other purposes but
    // would mislead Eduardo to see 176 when he has a few assigned.
    activos: personalAssignedCount,
    activosAllCount: activosCount, // kept for future ops-wide use
    pendientes: pendientesCount,
    atrasados: atrasadosCount,
    entradasSeries, activosSeries, pendientesSeries, atrasadosSeries,
    entradasCurr7: sumRange(entradasSeries, 7, 14),
    entradasPrev7: sumRange(entradasSeries, 0, 7),
    activosCurr7:  sumRange(activosSeries, 7, 14),
    activosPrev7:  sumRange(activosSeries, 0, 7),
    pendientesCurr7: sumRange(pendientesSeries, 7, 14),
    pendientesPrev7: sumRange(pendientesSeries, 0, 7),
    atrasadosCurr7:  sumRange(atrasadosSeries, 7, 14),
    atrasadosPrev7:  sumRange(atrasadosSeries, 0, 7),
  }

  const systemStatus: SystemStatus =
    kpis.atrasados > 0 || colaCount > 0 ? 'warning' : 'healthy'
  const summaryLine = colaCount > 0
    ? `${colaCount} en cola${kpis.atrasados > 0 ? ` · ${kpis.atrasados} atrasados` : ''}`
    : kpis.atrasados > 0
    ? `${kpis.atrasados} tráfico${kpis.atrasados === 1 ? '' : 's'} atrasado${kpis.atrasados === 1 ? '' : 's'} >7 días`
    : 'Sin pendientes inmediatos.'

  const daysSinceLastPedimento = lastPedimento?.updated_at
    ? Math.floor((Date.now() - new Date(lastPedimento.updated_at).getTime()) / 86400000)
    : null

  const navCounts: import('@/lib/cockpit/nav-tiles').NavCounts = {
    traficos: {
      count: personalAssignedCount,
      series: activosSeries,
      microStatus: `${cruzados7dCount} cruzaron esta semana`,
    },
    pedimentos: {
      count: pedimentosMonthCount,
      series: pendientesSeries,
      microStatus: daysSinceLastPedimento != null
        ? `Último hace ${daysSinceLastPedimento} día${daysSinceLastPedimento === 1 ? '' : 's'}`
        : 'Sin pedimentos recientes',
    },
    expedientes: {
      count: expedientesTotalCount,
      series: expedientesSeries,
      microStatus: `${expedientesTotalCount} documento${expedientesTotalCount === 1 ? '' : 's'} totales`,
    },
    catalogo: {
      count: null,
      series: [],
      microStatus: '—',
    },
    entradas: {
      count: kpis.entradasHoy,
      series: entradasSeries,
      microStatus: `${entradas7dCount} recibida${entradas7dCount === 1 ? '' : 's'} esta semana`,
    },
    clasificaciones: {
      count: clasificacionesTotalCount,
      series: clasificacionesSeries,
      microStatus: `${clasificacionesTotalCount} fracciones clasificadas`,
    },
  }

  // Audit rows for operator feed — only if table exists.
  let auditRows: AuditRow[] = []
  if (auditAvailable) {
    auditRows = await softData<AuditRow>(
      sb.from('audit_log')
        .select('id, table_name, action, record_id, changed_at, company_id')
        .order('changed_at', { ascending: false })
        .limit(10)
    )
  }

  const inTransit = kpis.activos > 0

  return (
    <InicioClient
      operatorName={opName}
      operatorId={opId || ''}
      kpis={kpis}
      traficos={activeTraficosRows}
      feed={operationalDecisionsRows}
      personalAssigned={personalAssignedCount}
      personalDone={personalDoneCount}
      colaCount={colaCount}
      systemStatus={systemStatus}
      summaryLine={summaryLine}
      personalCompletedThisWeek={personalCompletedThisWeekCount}
      personalCompletedLastWeek={personalCompletedLastWeekCount}
      navCounts={navCounts}
      auditRows={auditRows}
      mensajeriaMessages={mensajeriaMessages}
      escalatedThreads={escalatedThreads}
      pulseSignal={inTransit}
      month={month}
    />
  )
}
