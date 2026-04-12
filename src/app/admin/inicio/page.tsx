import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/session'
import { createServerClient } from '@/lib/supabase-server'
import { InicioCockpit } from './InicioCockpit'
import type { InicioData, ClientHealth, TeamActivity, SystemStatus } from './types'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const MOTION_STATUSES = ['En Proceso', 'Documentacion', 'En Aduana', 'Pedimento Pagado']

function startOfWeekCST(): string {
  const now = new Date()
  const cst = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }))
  const day = cst.getDay()
  const diff = cst.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(cst.getFullYear(), cst.getMonth(), diff)
  return monday.toISOString()
}

export default async function InicioPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('portal_session')?.value
  if (!token) redirect('/login')

  const session = await verifySession(token)
  if (!session) redirect('/login')
  if (session.role !== 'admin' && session.role !== 'broker') redirect('/')

  const sb = createServerClient()
  const now = new Date()
  const weekStart = startOfWeekCST()
  const last24h = new Date(now.getTime() - 24 * 3600_000).toISOString()
  const last7d = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const last14d = new Date(now.getTime() - 14 * 86_400_000).toISOString()
  const staleCutoff = new Date(now.getTime() - 5 * 86_400_000).toISOString()

  const [
    activeClientsRes,
    motionTraficosRes,
    weekPedimentosRes,
    atRiskStaleRes,
    workflowFailedRes,
    redSemaforoRes,
    recentTraficosRes,
    teamActivityRes,
    systemSpendRes,
    workflowHealthRes,
    brokerDecisionsRes,
    autonomyThisWeekRes,
    autonomyLastWeekRes,
  ] = await Promise.all([
    sb.from('companies').select('company_id', { count: 'exact', head: true }).eq('active', true),
    sb.from('traficos')
      .select('id, company_id, importe_total, estatus, fecha_llegada, pedimento, updated_at')
      .in('estatus', MOTION_STATUSES)
      .limit(2000),
    sb.from('traficos').select('id', { count: 'exact', head: true })
      .not('pedimento', 'is', null)
      .gte('fecha_llegada', weekStart),
    sb.from('traficos').select('id', { count: 'exact', head: true })
      .eq('estatus', 'En Proceso')
      .lt('fecha_llegada', staleCutoff),
    sb.from('workflow_events').select('id', { count: 'exact', head: true })
      .in('status', ['failed', 'dead_letter']),
    sb.from('traficos').select('fecha_llegada').eq('semaforo', 'rojo')
      .order('fecha_llegada', { ascending: false }).limit(1),
    sb.from('traficos')
      .select('id, company_id, estatus, fecha_llegada, importe_total, pedimento, updated_at')
      .gte('updated_at', last7d)
      .order('updated_at', { ascending: false })
      .limit(500),
    sb.from('operational_decisions').select('operator_id, created_at')
      .gte('created_at', last24h).limit(1000),
    sb.from('api_cost_log').select('cost_usd').gte('created_at', last24h).limit(5000),
    sb.from('workflow_events').select('status')
      .in('status', ['pending', 'failed', 'dead_letter']).limit(500),
    sb.from('pedimento_drafts').select('id', { count: 'exact', head: true })
      .eq('status', 'ready_for_approval'),
    sb.from('operational_decisions').select('id', { count: 'exact', head: true })
      .not('outcome', 'is', null)
      .gte('created_at', last7d),
    sb.from('operational_decisions').select('id', { count: 'exact', head: true })
      .not('outcome', 'is', null)
      .gte('created_at', last14d)
      .lt('created_at', last7d),
  ])

  const companyIds = new Set<string>()
  ;(motionTraficosRes.data || []).forEach(t => t.company_id && companyIds.add(t.company_id))
  ;(recentTraficosRes.data || []).forEach(t => t.company_id && companyIds.add(t.company_id))

  const { data: companiesData } = await sb
    .from('companies')
    .select('company_id, name, active')
    .in('company_id', Array.from(companyIds))

  const companyMap = new Map<string, { name: string; active: boolean }>()
  ;(companiesData || []).forEach(c => companyMap.set(c.company_id, { name: c.name, active: c.active }))

  const operatorIds = new Set<string>()
  ;(teamActivityRes.data || []).forEach(d => d.operator_id && operatorIds.add(d.operator_id))
  let operatorNames: Record<string, string> = {}
  if (operatorIds.size > 0) {
    const { data: ops } = await sb.from('users')
      .select('id, name, email').in('id', Array.from(operatorIds))
    operatorNames = Object.fromEntries(
      (ops || []).map(o => [o.id, o.name || o.email || o.id])
    )
  }

  const motion = motionTraficosRes.data || []
  const valorEnTransito = motion.reduce((sum, t) => sum + (Number(t.importe_total) || 0), 0)
  const atRiskCount = (atRiskStaleRes.count || 0) + (workflowFailedRes.count || 0)

  const lastRed = redSemaforoRes.data?.[0]?.fecha_llegada
  const diasSinRojo = lastRed
    ? Math.floor((now.getTime() - new Date(lastRed).getTime()) / 86_400_000)
    : 999

  type Agg = { traficos: number; value: number; red: boolean; yellow: boolean; last: string | null }
  const byCompany = new Map<string, Agg>()
  ;(recentTraficosRes.data || []).forEach(t => {
    if (!t.company_id) return
    const a = byCompany.get(t.company_id) || { traficos: 0, value: 0, red: false, yellow: false, last: null }
    a.traficos += 1
    a.value += Number(t.importe_total) || 0
    if (t.estatus === 'En Proceso' && t.fecha_llegada && t.fecha_llegada < staleCutoff) a.red = true
    if (t.estatus === 'En Proceso' && !t.pedimento) a.yellow = true
    if (!a.last || (t.updated_at && t.updated_at > a.last)) a.last = t.updated_at
    byCompany.set(t.company_id, a)
  })

  const clientHealth: ClientHealth[] = Array.from(byCompany.entries())
    .map(([id, a]) => {
      const status: 'red' | 'yellow' | 'green' = a.red ? 'red' : a.yellow ? 'yellow' : 'green'
      const info = companyMap.get(id)
      return {
        company_id: id,
        name: info?.name || id,
        status,
        traficos: a.traficos,
        value_usd: a.value,
        last_activity: a.last,
        summary: status === 'red'
          ? `${a.traficos} tráfico${a.traficos === 1 ? '' : 's'} · revisión urgente`
          : status === 'yellow'
          ? `${a.traficos} tráfico${a.traficos === 1 ? '' : 's'} · pedimento pendiente`
          : `${a.traficos} tráfico${a.traficos === 1 ? '' : 's'} en curso`,
      }
    })
    .sort((a, b) => {
      const order = { red: 0, yellow: 1, green: 2 } as const
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
      return (b.last_activity || '').localeCompare(a.last_activity || '')
    })
    .slice(0, 6)

  const teamMap = new Map<string, number>()
  ;(teamActivityRes.data || []).forEach(d => {
    if (!d.operator_id) return
    teamMap.set(d.operator_id, (teamMap.get(d.operator_id) || 0) + 1)
  })
  const team: TeamActivity[] = Array.from(teamMap.entries())
    .map(([id, count]) => ({ operator_id: id, name: operatorNames[id] || 'Operador', actions: count }))
    .sort((a, b) => b.actions - a.actions)
    .slice(0, 5)

  const todaySpend = (systemSpendRes.data || [])
    .reduce((s, r) => s + (Number(r.cost_usd) || 0), 0)
  const wfHealth = workflowHealthRes.data || []
  const failedCount = wfHealth.filter(w => w.status === 'failed' || w.status === 'dead_letter').length
  const pendingCount = wfHealth.filter(w => w.status === 'pending').length

  // Greeting status
  const systemStatus: SystemStatus = failedCount > 0 ? 'critical' : pendingCount >= 10 ? 'warning' : 'healthy'
  const redClients = clientHealth.filter(c => c.status === 'red').length
  const summaryLine = failedCount > 0
    ? `${failedCount} evento${failedCount === 1 ? '' : 's'} fallido${failedCount === 1 ? '' : 's'} · revisar pipeline`
    : redClients > 0
    ? `${redClients} cliente${redClients === 1 ? '' : 's'} con atención urgente · ${motion.length} tráficos en motion`
    : pendingCount >= 10
    ? `${pendingCount} eventos en cola · ${motion.length} tráficos en motion`
    : `${motion.length} tráfico${motion.length === 1 ? '' : 's'} en motion · operación estable`

  const data: InicioData = {
    greeting: {
      name: 'Renato Zapata III',
      systemStatus,
      summaryLine,
    },
    hero: {
      clientes_activos: activeClientsRes.count || 0,
      traficos_motion: motion.length,
      pedimentos_semana: weekPedimentosRes.count || 0,
      valor_transito_usd: valorEnTransito,
      en_riesgo: atRiskCount,
      dias_sin_rojo: diasSinRojo,
    },
    clientHealth,
    autonomy: {
      thisWeekDecisions: autonomyThisWeekRes.count || 0,
      lastWeekDecisions: autonomyLastWeekRes.count || 0,
    },
    rightRail: {
      decisionesPendientes: brokerDecisionsRes.count || 0,
      team,
      system: {
        todaySpendUsd: todaySpend,
        workflowFailed: failedCount,
        workflowPending: pendingCount,
      },
    },
    generated_at: now.toISOString(),
  }

  return <InicioCockpit data={data} />
}
