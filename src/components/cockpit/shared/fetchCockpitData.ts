import { createServerClient } from '@/lib/supabase-server'

// ── Types ──────────────────────────────────────────────

export interface AdminData {
  agentDecisions24h: { total: number; correct: number; accuracy: number }
  agentDecisions30d: { total: number; correct: number; accuracy: number }
  agentDecisionsAllTime: { total: number }
  workflowEvents24h: { total: number; byStage: Record<string, number> }
  workflowEvents30d: { total: number }
  operatorActions24h: { total: number; hoursSaved: number }
  operatorActions30d: { total: number; hoursSaved: number }
  /** Business-level summary for the hero card */
  businessSummary: {
    totalTraficos: number
    activeTraficos: number
    cruzadosThisMonth: number
    cruzadosLastMonth: number
    last30Days: number
    valorYtdUsd: number
    activeClients: number
    oldestActiveAgeDays: number | null
  }
  escalations: Array<{
    id: string; type: string; description: string
    company: string; urgency: string; created_at: string
  }>
  smartQueue: Array<{
    trafico: string; company_id: string; estatus: string
    priority: number; reason: string; descripcion: string
    valor_usd: number
  }>
  teamStats: Array<{
    operator_id: string; name: string; assigned: number
    avgResponseMin: number
  }>
  unassignedCount: number
  companies: Array<{
    company_id: string; name: string; trafico_count: number
    valor_ytd: number; last_activity: string | null
  }>
  bridges: Array<{
    name: string; nameEs: string; commercial: number | null
    status: string
  }>
  intelligenceFeed: Array<{
    id: string; title: string; severity: string; body: string
  }>
  syncStatus: {
    sources: Array<{ source: string; healthy: boolean; minutesAgo: number | null }>
    allHealthy: boolean
  }
  /** Intelligence data — risk, compliance, email patterns */
  intelligence: {
    riskAlerts: number
    criticalAlerts: number
    emailsToday: number
    classificationsToday: number
    otroRate: number
  }
  /** Financial pipeline — cartera aging */
  financialPipeline: {
    carteraTotal: number
    cartera30d: number
    cartera60d: number
    cartera90plus: number
  }
  /** Weekly activity trend (last 7 days) */
  weeklyTrend: Array<{ day: string; actions: number }>
}

export interface OperatorData {
  nextUp: {
    id: string; trafico: string; company: string
    description: string; valor_usd: number; arrived_ago: string
    suggestion: { decision_id: string; fraccion: string; confidence: number } | null
    /** Document completeness for the next-up trafico */
    docs: { total: number; present: number; missing: string[] } | null
  } | null
  myDay: {
    assigned: number; completed: number; inProgress: number
    nextDeadline: { trafico: string; deadline: string } | null
  }
  teamStats: Array<{ name: string; assigned: number }>
  unassignedCount: number
  blocked: Array<{
    id: string; trafico: string; reason: string
    type: 'waiting_doc' | 'waiting_approval'
    /** Specific missing documents when type is waiting_doc */
    missingDocs: string[]
  }>
  /** Operator performance metrics */
  performance: {
    completedToday: number
    completedThisWeek: number
    completedThisMonth: number
    yesterdayCount: number
    personalRecord: number
    currentStreak: number
    teamRank: number
    teamSize: number
  }
}

export interface ClientInsight {
  type: 'anomaly' | 'positive' | 'action'
  text: string
  severity: 'critical' | 'warning' | 'info'
  entityLink?: string
}

export interface ClientSuggestedAction {
  label: string
  href: string
  reason: string
  urgency: 'high' | 'medium' | 'low'
}

export interface ClientData {
  statusLevel: 'green' | 'amber' | 'red'
  statusSentence: string
  entradasThisMonth: number
  activeShipments: number
  nextCrossing: { trafico: string; expected: string } | null
  weekAhead: Array<{
    trafico: string; description: string; valor_usd: number
    status: string; statusIcon: string
  }>
  financial: {
    facturadoThisMonth: number; facturadoLastMonth: number
    arancelesThisMonth: number; arancelesLastMonth: number
  }
  inventory: { bultos: number; tons: number; oldestDays: number; pendingRelease: number }
  atRiskShipments: Array<{
    id: string; trafico: string; description: string
    valor_usd: number; status: string; daysActive: number
  }>
  pedimentosEnProceso: number
  cruzadosYTD: number
  recentActivity: Array<{
    trafico: string; estatus: string; updated_at: string
    description: string
  }>
  // KPI deltas
  entradasLastWeek: number
  activeShipmentsYesterday: number
  cruzadosLastMonth: number
  // Nav card micro-status
  navMicroStatus: {
    traficos: { active: number; delayed: number; atRisk: number }
    entradas: { thisMonth: number; withFaltantes: number }
    pedimentos: { active: number; todayActivity: boolean }
  }
  // Server-computed insights
  computedInsights: ClientInsight[]
  // Suggested next actions
  suggestedActions: ClientSuggestedAction[]
}

export interface CockpitData {
  admin?: AdminData
  operator?: OperatorData
  client?: ClientData
}

// ── Helpers ─────────────────────────────────────────────

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<{ data: T; error?: string }> {
  try {
    return { data: await fn() }
  } catch (err) {
    return { data: fallback, error: (err as Error).message }
  }
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600000).toISOString()
}

function startOfMonth(offset = 0): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1)).toISOString()
}

function startOfWeek(): string {
  const d = new Date()
  const diff = d.getUTCDate() - d.getUTCDay()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff)).toISOString()
}

function todayStart(): string {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString()
}

// ── Admin Data ──────────────────────────────────────────

async function fetchAdminData(): Promise<AdminData> {
  const sb = createServerClient()
  const h24 = hoursAgo(24)
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString()
  const thisMonthStart = startOfMonth(0)
  const lastMonthStart = startOfMonth(-1)
  const ytdStart = new Date(new Date().getFullYear(), 0, 1).toISOString()

  const results = await Promise.allSettled([
    // 0: agent_decisions last 24h
    sb.from('agent_decisions')
      .select('id, was_correct, confidence, trigger_type, company_id, payload, created_at')
      .gte('created_at', h24)
      .limit(500),
    // 1: workflow_events last 24h
    sb.from('workflow_events')
      .select('id, workflow, event_type, status, created_at')
      .gte('created_at', h24)
      .limit(500),
    // 2: operator_actions last 24h
    sb.from('operator_actions')
      .select('id, operator_id, action_type, duration_ms, created_at')
      .gte('created_at', h24)
      .limit(500),
    // 3: escalations — drafts needing intervention
    sb.from('pedimento_drafts')
      .select('id, trafico_id, status, company_id, created_at, draft_data')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(20),
    // 4: operators with their assigned traficos
    sb.from('operators')
      .select('id, full_name, role, active')
      .eq('active', true)
      .eq('role', 'operator'),
    // 5: unassigned active traficos
    sb.from('traficos')
      .select('id, trafico, company_id, estatus, descripcion_mercancia, importe_total, assigned_to_operator_id')
      .in('estatus', ['En Proceso', 'Documentacion', 'En Aduana'])
      .is('assigned_to_operator_id', null)
      .gte('fecha_llegada', '2024-01-01')
      .limit(100),
    // 6: companies with active trafico counts
    sb.from('companies')
      .select('company_id, name')
      .limit(100),
    // 7: all traficos since 2024 for team stats + company portfolio (includes all statuses for YTD valor)
    sb.from('traficos')
      .select('id, trafico, assigned_to_operator_id, estatus, company_id, importe_total, fecha_llegada')
      .gte('fecha_llegada', '2024-01-01')
      .limit(5000),
    // 8: agent_decisions last 30 days (for quiet-period fallback)
    sb.from('agent_decisions')
      .select('id, was_correct, created_at')
      .gte('created_at', d30)
      .limit(2000),
    // 9: agent_decisions all-time count
    sb.from('agent_decisions')
      .select('id', { count: 'exact', head: true }),
    // 10: workflow_events last 30 days count
    sb.from('workflow_events')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', d30),
    // 11: operator_actions last 30 days
    sb.from('operator_actions')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', d30),
    // 12: business summary — total traficos
    sb.from('traficos')
      .select('id', { count: 'exact', head: true }),
    // 13: business summary — cruzados this month
    sb.from('traficos')
      .select('id', { count: 'exact', head: true })
      .eq('estatus', 'Cruzado')
      .gte('fecha_cruce', thisMonthStart),
    // 14: business summary — cruzados last month
    sb.from('traficos')
      .select('id', { count: 'exact', head: true })
      .eq('estatus', 'Cruzado')
      .gte('fecha_cruce', lastMonthStart)
      .lt('fecha_cruce', thisMonthStart),
    // 15: business summary — last 30 days traficos
    sb.from('traficos')
      .select('id', { count: 'exact', head: true })
      .gte('fecha_llegada', d30),
    // 16: business summary — YTD value from traficos
    sb.from('traficos')
      .select('importe_total')
      .gte('fecha_llegada', ytdStart)
      .not('importe_total', 'is', null)
      .limit(5000),
    // 17: business summary — active clients (companies with active traficos)
    sb.from('traficos')
      .select('company_id')
      .in('estatus', ['En Proceso', 'Documentacion', 'En Aduana', 'Pedimento Pagado'])
      .gte('fecha_llegada', '2024-01-01')
      .limit(5000),
    // 18: oldest active trafico (for aging)
    sb.from('traficos')
      .select('fecha_llegada')
      .in('estatus', ['En Proceso', 'Documentacion', 'En Aduana'])
      .not('fecha_llegada', 'is', null)
      .order('fecha_llegada', { ascending: true })
      .limit(1),
    // 19: compliance/risk alerts
    sb.from('compliance_predictions')
      .select('id, severity')
      .eq('resolved', false)
      .limit(100),
    // 20: email intelligence today
    sb.from('email_intelligence')
      .select('id')
      .gte('created_at', todayStart())
      .limit(500),
    // 21: shadow classifications today
    sb.from('shadow_classifications')
      .select('id, doc_type')
      .gte('created_at', todayStart())
      .limit(200),
    // 22: econta cartera for aging
    sb.from('econta_cartera')
      .select('fecha, importe, tipo')
      .limit(5000),
    // 23: operator actions last 7 days for trend
    sb.from('operator_actions')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())
      .limit(5000),
  ])

  // Extract settled values with safe defaults
  const decisions = results[0].status === 'fulfilled' ? results[0].value.data ?? [] : []
  const wfEvents = results[1].status === 'fulfilled' ? results[1].value.data ?? [] : []
  const opActions = results[2].status === 'fulfilled' ? results[2].value.data ?? [] : []
  const drafts = results[3].status === 'fulfilled' ? results[3].value.data ?? [] : []
  const operators = results[4].status === 'fulfilled' ? results[4].value.data ?? [] : []
  const unassignedTraficos = results[5].status === 'fulfilled' ? results[5].value.data ?? [] : []
  const companies = results[6].status === 'fulfilled' ? results[6].value.data ?? [] : []
  const allActiveTraficos = results[7].status === 'fulfilled' ? results[7].value.data ?? [] : []

  // Agent decisions metrics
  const reviewed = decisions.filter((d: Record<string, unknown>) => d.was_correct !== null)
  const correct = reviewed.filter((d: Record<string, unknown>) => d.was_correct === true)
  const accuracy = reviewed.length > 0 ? Math.round((correct.length / reviewed.length) * 100) : 0

  // Workflow by stage
  const byStage: Record<string, number> = {}
  for (const e of wfEvents) {
    const w = (e as Record<string, unknown>).workflow as string
    byStage[w] = (byStage[w] || 0) + 1
  }

  // Hours saved estimate: avg 3 min per automated action
  const hoursSaved = Math.round((opActions.length * 3) / 60 * 10) / 10

  // Escalations from pending drafts
  const escalations = drafts.map((d: Record<string, unknown>) => ({
    id: d.id as string,
    type: 'pedimento_draft',
    description: `Borrador pendiente: ${d.trafico_id || 'sin trafico'}`,
    company: (d.company_id as string) || 'desconocido',
    urgency: 'amber' as string,
    created_at: d.created_at as string,
  }))

  // Team stats
  const teamStats = operators.map((op: Record<string, unknown>) => {
    const assigned = allActiveTraficos.filter(
      (t: Record<string, unknown>) => t.assigned_to_operator_id === op.id
    ).length
    return {
      operator_id: op.id as string,
      name: op.full_name as string,
      assigned,
      avgResponseMin: 0, // TODO(v1.5): calculate from operator_actions
    }
  })

  // Companies with trafico counts, YTD value, and last activity
  const companyStats = companies.map((c: Record<string, unknown>) => {
    const traficos = allActiveTraficos.filter(
      (t: Record<string, unknown>) => t.company_id === c.company_id
    )
    const valorYtd = traficos.reduce(
      (s: number, t: Record<string, unknown>) => s + Number(t.importe_total || 0), 0
    )
    const dates = traficos
      .map((t: Record<string, unknown>) => t.fecha_llegada as string | null)
      .filter(Boolean)
      .sort()
    const lastActivity = dates.length > 0 ? dates[dates.length - 1] : null
    return {
      company_id: c.company_id as string,
      name: c.name as string,
      trafico_count: traficos.length,
      valor_ytd: valorYtd,
      last_activity: lastActivity,
    }
  }).filter(c => c.trafico_count > 0)
    .sort((a, b) => b.trafico_count - a.trafico_count)

  // Smart queue — top 5 from unassigned by simple priority
  const smartQueue = unassignedTraficos
    .map((t: Record<string, unknown>) => ({
      trafico: t.trafico as string,
      company_id: (t.company_id as string) || '',
      estatus: (t.estatus as string) || '',
      priority: 50,
      reason: 'Sin asignar',
      descripcion: (t.descripcion_mercancia as string) || '',
      valor_usd: Number(t.importe_total || 0),
    }))
    .slice(0, 5)

  // 30-day agent decisions
  const decisions30d = results[8].status === 'fulfilled' ? results[8].value.data ?? [] : []
  const reviewed30d = decisions30d.filter((d: Record<string, unknown>) => d.was_correct !== null)
  const correct30d = reviewed30d.filter((d: Record<string, unknown>) => d.was_correct === true)
  const accuracy30d = reviewed30d.length > 0 ? Math.round((correct30d.length / reviewed30d.length) * 100) : 0

  // All-time agent decisions count
  const decisionsAllTimeCount = results[9].status === 'fulfilled' ? results[9].value.count ?? 0 : 0

  // 30-day workflow + operator counts
  const wfEvents30dCount = results[10].status === 'fulfilled' ? results[10].value.count ?? 0 : 0
  const opActions30dCount = results[11].status === 'fulfilled' ? results[11].value.count ?? 0 : 0

  // Business summary
  const totalTraficos = results[12].status === 'fulfilled' ? results[12].value.count ?? 0 : 0
  const cruzadosThisMonth = results[13].status === 'fulfilled' ? results[13].value.count ?? 0 : 0
  const cruzadosLastMonth = results[14].status === 'fulfilled' ? results[14].value.count ?? 0 : 0
  const last30Days = results[15].status === 'fulfilled' ? results[15].value.count ?? 0 : 0

  const ytdRows = results[16].status === 'fulfilled' ? results[16].value.data ?? [] : []
  const valorYtdUsd = ytdRows.reduce((s: number, r: Record<string, unknown>) => s + Number(r.importe_total || 0), 0)

  const activeClientRows = results[17].status === 'fulfilled' ? results[17].value.data ?? [] : []
  const activeClients = new Set(activeClientRows.map((r: Record<string, unknown>) => r.company_id)).size

  const oldestActiveRow = results[18].status === 'fulfilled' ? results[18].value.data?.[0] : null
  const oldestActiveAgeDays = oldestActiveRow?.fecha_llegada
    ? Math.floor((Date.now() - new Date(oldestActiveRow.fecha_llegada as string).getTime()) / 86400000)
    : null

  return {
    agentDecisions24h: { total: decisions.length, correct: correct.length, accuracy },
    agentDecisions30d: { total: decisions30d.length, correct: correct30d.length, accuracy: accuracy30d },
    agentDecisionsAllTime: { total: decisionsAllTimeCount },
    workflowEvents24h: { total: wfEvents.length, byStage },
    workflowEvents30d: { total: wfEvents30dCount },
    operatorActions24h: { total: opActions.length, hoursSaved },
    operatorActions30d: { total: opActions30dCount, hoursSaved: Math.round((opActions30dCount * 3) / 60 * 10) / 10 },
    businessSummary: {
      totalTraficos,
      activeTraficos: allActiveTraficos.length,
      cruzadosThisMonth,
      cruzadosLastMonth,
      last30Days,
      valorYtdUsd,
      activeClients,
      oldestActiveAgeDays,
    },
    escalations,
    smartQueue,
    teamStats,
    unassignedCount: unassignedTraficos.length,
    companies: companyStats,
    bridges: [], // Fetched client-side via /api/bridge-times (external API)
    intelligenceFeed: [], // Fetched client-side via /api/intelligence-feed
    syncStatus: { sources: [], allHealthy: true }, // Fetched client-side via /api/sync-status

    // Intelligence (from new queries 19-23)
    intelligence: (() => {
      const riskRows = results[19].status === 'fulfilled' ? results[19].value.data ?? [] : []
      const criticalAlerts = riskRows.filter((r: Record<string, unknown>) => r.severity === 'critical').length
      const emailRows = results[20].status === 'fulfilled' ? results[20].value.data ?? [] : []
      const classRows = results[21].status === 'fulfilled' ? results[21].value.data ?? [] : []
      const otroCount = classRows.filter((r: Record<string, unknown>) => r.doc_type === 'OTRO').length
      return {
        riskAlerts: riskRows.length,
        criticalAlerts,
        emailsToday: emailRows.length,
        classificationsToday: classRows.length,
        otroRate: classRows.length > 0 ? Math.round((otroCount / classRows.length) * 100) : 0,
      }
    })(),

    financialPipeline: (() => {
      const carteraRows = results[22].status === 'fulfilled' ? results[22].value.data ?? [] : []
      const nowMs = Date.now()
      let total = 0, d30 = 0, d60 = 0, d90plus = 0
      for (const r of carteraRows as Array<Record<string, unknown>>) {
        if (r.tipo !== 'C') continue
        const amt = Math.abs(Number(r.importe || 0))
        const days = r.fecha ? Math.floor((nowMs - new Date(r.fecha as string).getTime()) / 86400000) : 999
        total += amt
        if (days <= 30) d30 += amt
        else if (days <= 60) d60 += amt
        else d90plus += amt
      }
      return { carteraTotal: total, cartera30d: d30, cartera60d: d60, cartera90plus: d90plus }
    })(),

    weeklyTrend: (() => {
      const actionRows = results[23].status === 'fulfilled' ? results[23].value.data ?? [] : []
      const days: Record<string, number> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000)
        const key = d.toLocaleDateString('es-MX', { weekday: 'short', timeZone: 'America/Chicago' })
        days[key] = 0
      }
      for (const a of actionRows as Array<Record<string, unknown>>) {
        const d = new Date(a.created_at as string)
        const key = d.toLocaleDateString('es-MX', { weekday: 'short', timeZone: 'America/Chicago' })
        if (key in days) days[key]++
      }
      return Object.entries(days).map(([day, actions]) => ({ day, actions }))
    })(),
  }
}

// ── Operator Data ───────────────────────────────────────

async function fetchOperatorData(operatorId: string): Promise<OperatorData> {
  const sb = createServerClient()
  const today = todayStart()

  const results = await Promise.allSettled([
    // 0: assigned active traficos for this operator
    sb.from('traficos')
      .select('id, trafico, company_id, estatus, descripcion_mercancia, importe_total, fecha_llegada, assigned_to_operator_id')
      .eq('assigned_to_operator_id', operatorId)
      .in('estatus', ['En Proceso', 'Documentacion', 'En Aduana'])
      .gte('fecha_llegada', '2024-01-01')
      .order('fecha_llegada', { ascending: true })
      .limit(50),
    // 1: operator actions today for this operator
    sb.from('operator_actions')
      .select('id, action_type, created_at')
      .eq('operator_id', operatorId)
      .gte('created_at', today)
      .limit(200),
    // 2: all operators for team stats
    sb.from('operators')
      .select('id, full_name, role, active')
      .eq('active', true)
      .eq('role', 'operator'),
    // 3: unassigned traficos count
    sb.from('traficos')
      .select('id', { count: 'exact', head: true })
      .in('estatus', ['En Proceso', 'Documentacion', 'En Aduana'])
      .is('assigned_to_operator_id', null)
      .gte('fecha_llegada', '2024-01-01'),
    // 4: all active traficos for team counts
    sb.from('traficos')
      .select('id, assigned_to_operator_id')
      .in('estatus', ['En Proceso', 'Documentacion', 'En Aduana'])
      .not('assigned_to_operator_id', 'is', null)
      .gte('fecha_llegada', '2024-01-01')
      .limit(500),
    // 5: unreviewed agent decisions for this operator's traficos
    sb.from('agent_decisions')
      .select('id, decision, confidence, payload, created_at, company_id')
      .eq('trigger_type', 'classification')
      .is('was_correct', null)
      .order('confidence', { ascending: true })
      .limit(10),
    // 6: expediente docs for assigned traficos (doc completeness)
    sb.from('expediente_documentos')
      .select('pedimento_id, doc_type, company_id')
      .limit(2000),
    // 7: operator actions this week (performance)
    sb.from('operator_actions')
      .select('id, action_type, created_at')
      .eq('operator_id', operatorId)
      .gte('created_at', startOfWeek())
      .limit(500),
    // 8: operator actions this month (performance)
    sb.from('operator_actions')
      .select('id', { count: 'exact', head: true })
      .eq('operator_id', operatorId)
      .gte('created_at', startOfMonth(0)),
  ])

  const myTraficos = results[0].status === 'fulfilled' ? results[0].value.data ?? [] : []
  const myActions = results[1].status === 'fulfilled' ? results[1].value.data ?? [] : []
  const allOperators = results[2].status === 'fulfilled' ? results[2].value.data ?? [] : []
  const unassignedResult = results[3].status === 'fulfilled' ? results[3].value : null
  const allAssigned = results[4].status === 'fulfilled' ? results[4].value.data ?? [] : []
  const pendingDecisions = results[5].status === 'fulfilled' ? results[5].value.data ?? [] : []

  // Next up: highest priority unhandled trafico
  let nextUp: OperatorData['nextUp'] = null
  if (myTraficos.length > 0) {
    const first = myTraficos[0] as Record<string, unknown>
    const arrivedDate = first.fecha_llegada ? new Date(first.fecha_llegada as string) : null
    const hoursAgoVal = arrivedDate ? Math.round((Date.now() - arrivedDate.getTime()) / 3600000) : 0
    const arrivedStr = hoursAgoVal < 1 ? 'menos de 1h' : hoursAgoVal < 24 ? `${hoursAgoVal}h` : `${Math.round(hoursAgoVal / 24)}d`

    // Find matching classification suggestion
    let suggestion: { decision_id: string; fraccion: string; confidence: number } | null = null
    const matchingDecision = pendingDecisions.find(
      (d: Record<string, unknown>) => {
        const payload = d.payload as Record<string, unknown> | null
        return payload?.trafico === first.trafico
      }
    )
    if (matchingDecision) {
      const md = matchingDecision as Record<string, unknown>
      suggestion = {
        decision_id: md.id as string,
        fraccion: (md.decision as string) || '',
        confidence: Math.round(Number(md.confidence || 0) * 100),
      }
    }

    // Doc completeness for next-up trafico
    const REQUIRED_DOC_TYPES = ['factura_comercial', 'packing_list', 'conocimiento_embarque', 'cove', 'pedimento_detallado']
    const allDocs = results[6].status === 'fulfilled' ? results[6].value.data ?? [] : []
    const traficoId = first.trafico as string
    const trafikoDocs = allDocs.filter((d: Record<string, unknown>) => {
      const pid = String(d.pedimento_id || '')
      return pid.includes(traficoId.split('-').pop() || '___none')
    })
    const presentTypes = new Set(trafikoDocs.map((d: Record<string, unknown>) => d.doc_type as string))
    const missingDocTypes = REQUIRED_DOC_TYPES.filter(t => !presentTypes.has(t))

    const docsInfo = {
      total: REQUIRED_DOC_TYPES.length,
      present: REQUIRED_DOC_TYPES.length - missingDocTypes.length,
      missing: missingDocTypes.map(t => t.replace(/_/g, ' ')),
    }

    nextUp = {
      id: first.id as string,
      trafico: first.trafico as string,
      company: (first.company_id as string) || '',
      description: (first.descripcion_mercancia as string) || '',
      valor_usd: Number(first.importe_total || 0),
      arrived_ago: arrivedStr,
      suggestion,
      docs: docsInfo,
    }
  }

  // My day stats
  const completedActions = myActions.filter(
    (a: Record<string, unknown>) =>
      a.action_type === 'vote_classification' || a.action_type === 'complete_trafico'
  ).length

  const myDay = {
    assigned: myTraficos.length,
    completed: completedActions,
    inProgress: myTraficos.length - completedActions,
    nextDeadline: null as { trafico: string; deadline: string } | null,
  }

  // Team stats
  const teamStats = allOperators
    .filter((op: Record<string, unknown>) => op.id !== operatorId)
    .map((op: Record<string, unknown>) => ({
      name: op.full_name as string,
      assigned: allAssigned.filter(
        (t: Record<string, unknown>) => t.assigned_to_operator_id === op.id
      ).length,
    }))

  // Blocked items with specific missing doc reasons
  const REQUIRED_DOCS_SHORT = ['factura_comercial', 'packing_list', 'conocimiento_embarque', 'cove', 'pedimento_detallado']
  const allDocsForBlocked = results[6].status === 'fulfilled' ? results[6].value.data ?? [] : []

  const blocked = myTraficos
    .filter((t: Record<string, unknown>) =>
      (t.estatus as string) === 'Documentacion'
    )
    .map((t: Record<string, unknown>) => {
      const tid = (t.trafico as string) || ''
      const suffix = tid.split('-').pop() || '___none'
      const docs = allDocsForBlocked.filter((d: Record<string, unknown>) =>
        String(d.pedimento_id || '').includes(suffix)
      )
      const present = new Set(docs.map((d: Record<string, unknown>) => d.doc_type as string))
      const missing = REQUIRED_DOCS_SHORT.filter(dt => !present.has(dt))
        .map(dt => dt.replace(/_/g, ' '))

      return {
        id: t.id as string,
        trafico: t.trafico as string,
        reason: missing.length > 0 ? `Falta: ${missing.join(', ')}` : 'Esperando documentos',
        type: 'waiting_doc' as const,
        missingDocs: missing,
      }
    })

  // Performance metrics
  const weekActions = results[7].status === 'fulfilled' ? results[7].value.data ?? [] : []
  const monthActionCount = results[8].status === 'fulfilled' ? results[8].value.count ?? 0 : 0
  const completedWeek = weekActions.filter(
    (a: Record<string, unknown>) => a.action_type === 'vote_classification' || a.action_type === 'complete_trafico'
  ).length

  return {
    nextUp,
    myDay,
    teamStats,
    unassignedCount: unassignedResult?.count ?? 0,
    blocked,
    performance: {
      completedToday: completedActions,
      completedThisWeek: completedWeek,
      completedThisMonth: monthActionCount,
      yesterdayCount: 0, // computed from weekActions if needed
      personalRecord: Math.max(completedActions, completedWeek > 0 ? Math.ceil(completedWeek / 5) : 0),
      currentStreak: completedActions > 0 ? 1 : 0,
      teamRank: 1,
      teamSize: Math.max(allOperators.length, 1),
    },
  }
}

// ── Client Data ─────────────────────────────────────────
// SECURITY: Every query MUST filter by company_id

async function fetchClientData(companyId: string): Promise<ClientData> {
  const sb = createServerClient()
  const weekStart = startOfWeek()
  const monthStart = startOfMonth(0)
  const lastMonthStart = startOfMonth(-1)
  const ytdStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)).toISOString()
  const today = todayStart()
  const lastWeekStart = new Date(new Date(weekStart).getTime() - 7 * 86400000).toISOString()

  const results = await Promise.allSettled([
    // 0: active traficos for this company (last 90 days — older = ghost, not active)
    sb.from('traficos')
      .select('id, trafico, estatus, descripcion_mercancia, importe_total, fecha_llegada, fecha_cruce')
      .eq('company_id', companyId)
      .in('estatus', ['En Proceso', 'Documentacion', 'En Aduana', 'Pedimento Pagado'])
      .gte('fecha_llegada', new Date(Date.now() - 90 * 86400000).toISOString())
      .order('fecha_llegada', { ascending: false })
      .limit(50),
    // 1: entradas this month
    sb.from('entradas')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', monthStart),
    // 2: traficos this month for financial
    sb.from('traficos')
      .select('importe_total, fecha_pago')
      .eq('company_id', companyId)
      .gte('fecha_pago', monthStart)
      .limit(500),
    // 3: traficos last month for financial comparison
    sb.from('traficos')
      .select('importe_total')
      .eq('company_id', companyId)
      .gte('fecha_pago', lastMonthStart)
      .lt('fecha_pago', monthStart)
      .limit(500),
    // 4: recently crossed (proxy for inventory)
    sb.from('traficos')
      .select('id, trafico, bultos, peso_bruto, fecha_cruce')
      .eq('company_id', companyId)
      .eq('estatus', 'Cruzado')
      .gte('fecha_cruce', new Date(Date.now() - 30 * 86400000).toISOString())
      .order('fecha_cruce', { ascending: false })
      .limit(50),
    // 5: at-risk shipments (last 90 days only — older = ghost, not alert-worthy)
    sb.from('traficos')
      .select('id, trafico, estatus, descripcion_mercancia, importe_total, fecha_llegada')
      .eq('company_id', companyId)
      .in('estatus', ['En Proceso', 'Documentacion', 'En Aduana'])
      .gte('fecha_llegada', new Date(Date.now() - 90 * 86400000).toISOString())
      .order('fecha_llegada', { ascending: true })
      .limit(5),
    // 6: pedimentos en proceso count
    sb.from('traficos')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('estatus', 'En Aduana')
      .gte('fecha_llegada', '2024-01-01'),
    // 7: cruzados YTD (by fecha_llegada — fecha_cruce is often null)
    sb.from('traficos')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('estatus', 'Cruzado')
      .gte('fecha_llegada', ytdStart),
    // 8: recent activity (last 48h status changes)
    sb.from('traficos')
      .select('trafico, estatus, updated_at, descripcion_mercancia')
      .eq('company_id', companyId)
      .gte('updated_at', hoursAgo(168))
      .order('updated_at', { ascending: false })
      .limit(15),
    // 9: entradas last week (for week-over-week delta)
    sb.from('entradas')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('created_at', lastWeekStart)
      .lt('created_at', weekStart),
    // 10: active traficos as of yesterday (for "+N hoy" delta)
    sb.from('traficos')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('estatus', ['En Proceso', 'Documentacion', 'En Aduana', 'Pedimento Pagado'])
      .gte('fecha_llegada', new Date(Date.now() - 90 * 86400000).toISOString())
      .lt('created_at', today),
    // 11: cruzados last month (for month-over-month delta)
    sb.from('traficos')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('estatus', 'Cruzado')
      .gte('updated_at', lastMonthStart)
      .lt('updated_at', monthStart),
    // 12: entradas with faltantes this week
    sb.from('entradas')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('tiene_faltantes', true)
      .gte('created_at', weekStart),
  ])

  const activeTraficos = results[0].status === 'fulfilled' ? results[0].value.data ?? [] : []
  const entradasResult = results[1].status === 'fulfilled' ? results[1].value : null
  const thisMonthTraficos = results[2].status === 'fulfilled' ? results[2].value.data ?? [] : []
  const lastMonthTraficos = results[3].status === 'fulfilled' ? results[3].value.data ?? [] : []
  const recentlyCrossed = results[4].status === 'fulfilled' ? results[4].value.data ?? [] : []
  const atRiskRaw = results[5].status === 'fulfilled' ? results[5].value.data ?? [] : []
  const pedimentosResult = results[6].status === 'fulfilled' ? results[6].value : null
  const cruzadosResult = results[7].status === 'fulfilled' ? results[7].value : null
  const recentActivityRaw = results[8].status === 'fulfilled' ? results[8].value.data ?? [] : []
  const entradasLastWeekResult = results[9].status === 'fulfilled' ? results[9].value : null
  const activeYesterdayResult = results[10].status === 'fulfilled' ? results[10].value : null
  const cruzadosLastMonthResult = results[11].status === 'fulfilled' ? results[11].value : null
  const faltantesResult = results[12].status === 'fulfilled' ? results[12].value : null

  // Status level
  const activeCount = activeTraficos.length
  const statusLevel: ClientData['statusLevel'] = activeCount === 0 ? 'green' : activeCount > 10 ? 'amber' : 'green'

  const statusSentence = activeCount === 0
    ? 'Sin envíos activos — todo en orden'
    : `${activeCount} envío${activeCount !== 1 ? 's' : ''} en proceso`

  // Next crossing
  const nextCrossing = activeTraficos.length > 0
    ? {
        trafico: (activeTraficos[0] as Record<string, unknown>).trafico as string,
        expected: (activeTraficos[0] as Record<string, unknown>).fecha_llegada as string || '',
      }
    : null

  // Week ahead
  const statusIcons: Record<string, string> = {
    'En Proceso': '⏳',
    'Documentacion': '📋',
    'En Aduana': '🏛',
    'Pedimento Pagado': '✅',
  }
  const weekAhead = activeTraficos.slice(0, 8).map((t: Record<string, unknown>) => ({
    trafico: t.trafico as string,
    description: (t.descripcion_mercancia as string) || '',
    valor_usd: Number(t.importe_total || 0),
    status: (t.estatus as string) || '',
    statusIcon: statusIcons[(t.estatus as string) || ''] || '📦',
  }))

  // Financial
  const sumImporte = (rows: Record<string, unknown>[]) =>
    rows.reduce((s, r) => s + Number(r.importe_total || 0), 0)

  const financial = {
    facturadoThisMonth: sumImporte(thisMonthTraficos as Record<string, unknown>[]),
    facturadoLastMonth: sumImporte(lastMonthTraficos as Record<string, unknown>[]),
    arancelesThisMonth: 0, // Would need pedimento_drafts.draft_data aggregation
    arancelesLastMonth: 0,
  }

  // Inventory proxy from recently crossed
  const bultos = (recentlyCrossed as Record<string, unknown>[]).reduce(
    (s, r) => s + Number(r.bultos || 0), 0
  )
  const tons = (recentlyCrossed as Record<string, unknown>[]).reduce(
    (s, r) => s + Number(r.peso_bruto || 0) / 1000, 0
  )
  const oldest = recentlyCrossed.length > 0
    ? Math.round((Date.now() - new Date((recentlyCrossed[recentlyCrossed.length - 1] as Record<string, unknown>).fecha_cruce as string).getTime()) / 86400000)
    : 0

  // Derived values for new fields
  const entradasThisMonth = entradasResult?.count ?? 0
  const entradasLastWeek = entradasLastWeekResult?.count ?? 0
  const activeShipmentsYesterday = activeYesterdayResult?.count ?? activeCount
  const pedimentosCount = pedimentosResult?.count ?? 0
  const cruzadosYTD = cruzadosResult?.count ?? 0
  const cruzadosLastMonth = cruzadosLastMonthResult?.count ?? 0
  const faltantesCount = faltantesResult?.count ?? 0

  // Map at-risk shipments
  const atRiskMapped = (atRiskRaw as Record<string, unknown>[]).map((t) => ({
    id: t.id as string,
    trafico: t.trafico as string,
    description: (t.descripcion_mercancia as string) || '',
    valor_usd: Number(t.importe_total || 0),
    status: (t.estatus as string) || '',
    daysActive: Math.round((Date.now() - new Date(t.fecha_llegada as string).getTime()) / 86400000),
  })).filter((t) => t.daysActive <= 90)

  // Delayed = active > 14 days
  const delayedCount = (activeTraficos as Record<string, unknown>[]).filter((t) => {
    const arrived = new Date(t.fecha_llegada as string).getTime()
    return (Date.now() - arrived) / 86400000 > 14
  }).length

  // Any pedimento activity today
  const pedimentoActivityToday = (recentActivityRaw as Record<string, unknown>[]).some(
    (t) => (t.estatus as string) === 'En Aduana' || (t.estatus as string) === 'Pedimento Pagado'
  )

  // Compute insights
  const computedInsights: ClientInsight[] = []
  const extremeRisk = atRiskMapped.find((s) => s.daysActive > 30)
  if (extremeRisk) {
    computedInsights.push({
      type: 'anomaly',
      text: `${extremeRisk.trafico} lleva ${extremeRisk.daysActive} días activo`,
      severity: 'critical',
      entityLink: `/embarques/${extremeRisk.id}`,
    })
  }
  if (pedimentosCount === 0 && activeCount > 0) {
    computedInsights.push({
      type: 'action',
      text: `${activeCount} embarque${activeCount !== 1 ? 's' : ''} activo${activeCount !== 1 ? 's' : ''} sin pedimento — contacta a tu agente`,
      severity: 'info',
      entityLink: '/aduana',
    })
  }
  if (cruzadosYTD > cruzadosLastMonth && cruzadosLastMonth > 0) {
    computedInsights.push({
      type: 'positive',
      text: `${cruzadosYTD} cruzados este año vs ${cruzadosLastMonth} el mes pasado`,
      severity: 'info',
    })
  }
  if (delayedCount > 0) {
    computedInsights.push({
      type: 'action',
      text: `${delayedCount} embarque${delayedCount !== 1 ? 's' : ''} con más de 14 días activo${delayedCount !== 1 ? 's' : ''}`,
      severity: 'warning',
      entityLink: '/embarques',
    })
  }

  // Compute suggested actions
  const suggestedActions: ClientSuggestedAction[] = []
  if (atRiskMapped.length > 0) {
    suggestedActions.push({
      label: `Revisar ${atRiskMapped.length} operación${atRiskMapped.length > 1 ? 'es' : ''} en riesgo`,
      href: `/embarques/${atRiskMapped[0].id}`,
      reason: `${atRiskMapped[0].daysActive} días activo`,
      urgency: 'high',
    })
  }
  // pedimentosCount === 0 anomaly is already shown in KPI strip + computed insights
  // No standalone suggested action needed — floating Aduana AI handles questions
  if (faltantesCount > 0) {
    suggestedActions.push({
      label: `${faltantesCount} entrada${faltantesCount !== 1 ? 's' : ''} con faltantes`,
      href: '/entradas',
      reason: 'Revisar mercancía incompleta',
      urgency: 'medium',
    })
  }

  return {
    statusLevel,
    statusSentence,
    entradasThisMonth,
    activeShipments: activeCount,
    nextCrossing,
    weekAhead,
    financial,
    inventory: {
      bultos: Math.round(bultos),
      tons: Math.round(tons * 10) / 10,
      oldestDays: oldest,
      pendingRelease: 0,
    },
    atRiskShipments: atRiskMapped,
    pedimentosEnProceso: pedimentosCount,
    cruzadosYTD,
    recentActivity: (recentActivityRaw as Record<string, unknown>[]).map((t) => ({
      trafico: t.trafico as string,
      estatus: (t.estatus as string) || '',
      updated_at: t.updated_at as string,
      description: (t.descripcion_mercancia as string) || '',
    })),
    entradasLastWeek,
    activeShipmentsYesterday,
    cruzadosLastMonth,
    navMicroStatus: {
      traficos: { active: activeCount, delayed: delayedCount, atRisk: atRiskMapped.length },
      entradas: { thisMonth: entradasThisMonth, withFaltantes: faltantesCount },
      pedimentos: { active: pedimentosCount, todayActivity: pedimentoActivityToday },
    },
    computedInsights,
    suggestedActions,
  }
}

// ── Main Fetcher ────────────────────────────────────────

export async function fetchCockpitData(
  role: string,
  companyId: string,
  operatorId?: string | null,
): Promise<CockpitData> {
  if (role === 'admin' || role === 'broker') {
    const admin = await safeQuery(() => fetchAdminData(), {
      agentDecisions24h: { total: 0, correct: 0, accuracy: 0 },
      agentDecisions30d: { total: 0, correct: 0, accuracy: 0 },
      agentDecisionsAllTime: { total: 0 },
      workflowEvents24h: { total: 0, byStage: {} },
      workflowEvents30d: { total: 0 },
      operatorActions24h: { total: 0, hoursSaved: 0 },
      operatorActions30d: { total: 0, hoursSaved: 0 },
      businessSummary: {
        totalTraficos: 0, activeTraficos: 0, cruzadosThisMonth: 0,
        cruzadosLastMonth: 0, last30Days: 0, valorYtdUsd: 0,
        activeClients: 0, oldestActiveAgeDays: null,
      },
      escalations: [], smartQueue: [], teamStats: [],
      unassignedCount: 0, companies: [],
      bridges: [], intelligenceFeed: [],
      syncStatus: { sources: [], allHealthy: true },
      intelligence: { riskAlerts: 0, criticalAlerts: 0, emailsToday: 0, classificationsToday: 0, otroRate: 0 },
      financialPipeline: { carteraTotal: 0, cartera30d: 0, cartera60d: 0, cartera90plus: 0 },
      weeklyTrend: [],
    })
    return { admin: admin.data }
  }

  if (role === 'operator' && operatorId) {
    const operator = await safeQuery(() => fetchOperatorData(operatorId), {
      nextUp: null,
      myDay: { assigned: 0, completed: 0, inProgress: 0, nextDeadline: null },
      teamStats: [], unassignedCount: 0, blocked: [],
      performance: { completedToday: 0, completedThisWeek: 0, completedThisMonth: 0, yesterdayCount: 0, personalRecord: 0, currentStreak: 0, teamRank: 1, teamSize: 1 },
    })
    return { operator: operator.data }
  }

  // Client — ALWAYS scoped to companyId
  const client = await safeQuery(() => fetchClientData(companyId), {
    statusLevel: 'green' as const,
    statusSentence: 'Cargando...',
    entradasThisMonth: 0,
    activeShipments: 0,
    nextCrossing: null,
    weekAhead: [],
    financial: { facturadoThisMonth: 0, facturadoLastMonth: 0, arancelesThisMonth: 0, arancelesLastMonth: 0 },
    inventory: { bultos: 0, tons: 0, oldestDays: 0, pendingRelease: 0 },
    atRiskShipments: [],
    pedimentosEnProceso: 0,
    cruzadosYTD: 0,
    recentActivity: [],
    entradasLastWeek: 0,
    activeShipmentsYesterday: 0,
    cruzadosLastMonth: 0,
    navMicroStatus: {
      traficos: { active: 0, delayed: 0, atRisk: 0 },
      entradas: { thisMonth: 0, withFaltantes: 0 },
      pedimentos: { active: 0, todayActivity: false },
    },
    computedInsights: [],
    suggestedActions: [],
  })
  return { client: client.data }
}
