import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { WORKFLOW_ORDER } from '@/lib/workflow-events'
import { AdminCockpit } from './_components/AdminCockpit'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value
  if (role !== 'admin') redirect('/login')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const requestTime = new Date()
  const since24h = new Date(requestTime.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(requestTime.getTime() - 7 * 86400000).toISOString()
  const fortyEightHoursAgo = new Date(requestTime.getTime() - 48 * 3600000).toISOString()
  const thirtyMinAgo = new Date(requestTime.getTime() - 30 * 60000).toISOString()

  // ── Parallel data fetch ──
  const [
    companiesRes, alertsRes, healthRes, workflowEventsRes, recentClassRes,
    pendingExceptionsRes, draftsCountRes, topDraftRes,
    leaderboardRes, stuckRes, recentActionsRes, operatorsRes,
    pipelineRes,
  ] = await Promise.all([
    supabase.from('companies').select('*').eq('active', true).order('traficos_count', { ascending: false, nullsFirst: false }),
    supabase.from('compliance_predictions').select('company_id, severity').eq('resolved', false),
    supabase.from('integration_health').select('*').order('checked_at', { ascending: false }),
    supabase.from('workflow_events').select('workflow, status, created_at').gte('created_at', since24h).order('created_at', { ascending: false }).limit(1000),
    supabase.from('globalpc_productos').select('company_id, cve_producto, descripcion, fraccion, fraccion_source, fraccion_classified_at').not('fraccion_classified_at', 'is', null).order('fraccion_classified_at', { ascending: false }).limit(50),
    // Hero: exception urgency counts
    supabase.from('workflow_events').select('id, created_at, status').in('status', ['pending', 'failed', 'dead_letter']),
    // Hero: pending drafts count
    supabase.from('pedimento_drafts').select('id', { count: 'exact', head: true }).in('status', ['ready_for_approval', 'draft', 'pending']),
    // Action Engine: top pending draft
    supabase.from('pedimento_drafts').select('id, trafico_id, company_id, draft_data, created_at, status').in('status', ['ready_for_approval', 'draft', 'pending']).order('created_at', { ascending: true }).limit(1).maybeSingle(),
    // Below fold: operator leaderboard
    supabase.from('operator_actions').select('operator_id, action_type, created_at').gte('created_at', sevenDaysAgo),
    supabase.from('traficos').select('id, trafico, company_id, descripcion_mercancia, importe_total, assigned_to_operator_id, created_at, semaforo').eq('estatus', 'En Proceso').lt('created_at', fortyEightHoursAgo).order('created_at', { ascending: true }).limit(10),
    supabase.from('operator_actions').select('id, operator_id, action_type, target_id, payload, created_at').order('created_at', { ascending: false }).limit(20),
    supabase.from('operators').select('id, full_name, email, role, company_id'),
    // Pipeline funnel
    supabase.from('traficos').select('estatus').not('estatus', 'is', null),
  ])

  // ── Process data ──
  const companies = companiesRes.data || []
  const alerts = alertsRes.data || []
  const opDetails = operatorsRes.data || []
  const opNames: Record<string, string> = Object.fromEntries(opDetails.map(o => [o.id, o.full_name]))
  const opEmails: Record<string, string> = Object.fromEntries(opDetails.filter(o => o.email).map(o => [o.id, o.email]))

  // Alert map
  const alertMap: Record<string, number> = {}
  alerts.forEach(a => { alertMap[a.company_id] = (alertMap[a.company_id] || 0) + 1 })

  // Hero: exception urgency buckets
  const exceptions = pendingExceptionsRes.data || []
  let criticos = 0, urgentes = 0, normales = 0
  for (const e of exceptions) {
    const ageH = (requestTime.getTime() - new Date(e.created_at).getTime()) / 3600000
    if (ageH > 6) criticos++
    else if (ageH > 2) urgentes++
    else normales++
  }

  // Action Engine: enrich top draft with company name
  let topDraft = null
  if (topDraftRes.data) {
    const { data: company } = await supabase.from('companies').select('name').eq('company_id', topDraftRes.data.company_id).maybeSingle()
    topDraft = {
      ...topDraftRes.data,
      company_name: company?.name || topDraftRes.data.company_id,
      draft_data: (topDraftRes.data.draft_data || {}) as Record<string, unknown>,
    }
  }

  // Pipeline funnel
  const pipelineMap: Record<string, number> = {}
  for (const t of pipelineRes.data || []) {
    pipelineMap[t.estatus] = (pipelineMap[t.estatus] || 0) + 1
  }
  const pipeline = Object.entries(pipelineMap).map(([estatus, count]) => ({ estatus, count })).sort((a, b) => b.count - a.count)

  // Activity feed (last 10 with names)
  const recentActions = recentActionsRes.data || []
  const activity = recentActions.slice(0, 10).map(a => ({
    ...a,
    operator_name: opNames[a.operator_id] || 'Operador',
  }))

  // Active team (actions in last 30 min)
  const activeOpIds = new Set<string>()
  const todayActionsCount: Record<string, number> = {}
  for (const a of recentActions) {
    if (a.created_at >= thirtyMinAgo) activeOpIds.add(a.operator_id)
    const todayStart = new Date(requestTime.getFullYear(), requestTime.getMonth(), requestTime.getDate()).toISOString()
    if (a.created_at >= todayStart) {
      todayActionsCount[a.operator_id] = (todayActionsCount[a.operator_id] || 0) + 1
    }
  }
  const team = opDetails.map(op => ({
    id: op.id,
    full_name: op.full_name,
    role: op.role,
    isOnline: activeOpIds.has(op.id),
    actionsToday: todayActionsCount[op.id] || 0,
  }))

  // Workflow health (24h)
  const wfEvents = workflowEventsRes.data || []
  const stuckThresholdMs = 10 * 60 * 1000
  const wfByType: Record<string, { total: number; completed: number; failed: number }> = {}
  let stuckCount = 0, oldestStuckAge = 0, failedOrDead = 0
  for (const evt of wfEvents) {
    if (!wfByType[evt.workflow]) wfByType[evt.workflow] = { total: 0, completed: 0, failed: 0 }
    wfByType[evt.workflow].total++
    if (evt.status === 'completed') wfByType[evt.workflow].completed++
    if (evt.status === 'failed' || evt.status === 'dead_letter') {
      wfByType[evt.workflow].failed++
      failedOrDead++
    }
    if (evt.status === 'pending') {
      const age = requestTime.getTime() - new Date(evt.created_at).getTime()
      if (age > stuckThresholdMs) {
        stuckCount++
        if (age > oldestStuckAge) oldestStuckAge = age
      }
    }
  }
  const workflowStats = WORKFLOW_ORDER.filter(w => wfByType[w]).map(w => ({ workflow: w, ...wfByType[w] }))

  // Leaderboard
  const byOperator = new Map<string, { totalActions: number; classifications: number; assignments: number; lastActiveAt: string | null }>()
  for (const row of leaderboardRes.data || []) {
    if (!byOperator.has(row.operator_id)) byOperator.set(row.operator_id, { totalActions: 0, classifications: 0, assignments: 0, lastActiveAt: null })
    const stats = byOperator.get(row.operator_id)!
    stats.totalActions++
    if (row.action_type === 'vote_classification' || row.action_type === 'override_ai_decision') stats.classifications++
    if (row.action_type === 'assign_trafico') stats.assignments++
    if (!stats.lastActiveAt || row.created_at > stats.lastActiveAt) stats.lastActiveAt = row.created_at
  }
  const leaderboard = opDetails
    .filter(op => byOperator.has(op.id))
    .map(op => ({ ...op, ...byOperator.get(op.id)! }))
    .sort((a, b) => b.totalActions - a.totalActions)

  // Sync coverage (top 10)
  const top10 = companies.slice(0, 10)
  const syncCoverageResults = await Promise.all(
    top10.map(async (c: { company_id: string; name: string }) => {
      const [totalRes, fracRes, descRes] = await Promise.all([
        supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', c.company_id),
        supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', c.company_id).not('fraccion', 'is', null),
        supabase.from('globalpc_productos').select('id', { count: 'exact', head: true }).eq('company_id', c.company_id).not('descripcion', 'is', null),
      ])
      return { company_id: c.company_id, name: c.name, total: totalRes.count || 0, withFraccion: fracRes.count || 0, withDescripcion: descRes.count || 0 }
    })
  )
  const syncCoverage = syncCoverageResults.filter(s => s.total > 0)

  // Companies with alerts
  const companiesWithAlerts = companies.map(c => ({
    company_id: c.company_id,
    name: c.name,
    clave_cliente: c.clave_cliente || null,
    traficos_count: c.traficos_count || 0,
    health_score: c.health_score || 0,
    last_sync: c.last_sync || null,
    alerts: alertMap[c.company_id] || 0,
  }))

  const stuckTraficos = stuckRes.data || []
  const recentClassifications = recentClassRes.data || []

  return (
    <AdminCockpit
      criticos={criticos}
      urgentes={urgentes}
      normales={normales}
      decisionesHoy={draftsCountRes.count || 0}
      topDraft={topDraft}
      totalPending={draftsCountRes.count || 0}
      pipeline={pipeline}
      activity={activity}
      team={team}
      companies={companiesWithAlerts}
      workflowStats={workflowStats}
      totalWfEvents={wfEvents.length}
      stuckCount={stuckCount}
      oldestStuckMin={Math.round(oldestStuckAge / 60000)}
      failedOrDead={failedOrDead}
      syncCoverage={syncCoverage}
      leaderboard={leaderboard}
      stuckTraficos={stuckTraficos}
      recentActions={recentActions.map(a => ({ ...a, operator_name: opNames[a.operator_id] || 'Operador' }))}
      opNames={opNames}
      opEmails={opEmails}
      recentClassifications={recentClassifications}
    />
  )
}
