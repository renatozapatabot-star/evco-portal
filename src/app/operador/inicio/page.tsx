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
  ])

  const kpis = {
    entradasHoy: entradasHoyRes.count || 0,
    activos: activosRes.count || 0,
    pendientes: pendientesRes.count || 0,
    atrasados: atrasadosRes.count || 0,
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
    />
  )
}
