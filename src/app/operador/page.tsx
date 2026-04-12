import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { logOperatorAction } from '@/lib/operator-actions'
import { OperatorCockpit } from './_components/OperatorCockpit'
import type { WorkflowEvent } from './cola/ExceptionCard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function OperadorPage() {
  const cookieStore = await cookies()
  const role = cookieStore.get('user_role')?.value
  const opId = cookieStore.get('operator_id')?.value

  if (!role || (role !== 'admin' && role !== 'broker')) {
    redirect('/')
  }

  if (opId) {
    logOperatorAction({ operatorId: opId, actionType: 'view_page', targetId: '/operador' })
  }

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Operator identity
  let operatorName = 'Operador'
  let operatorCompany: string | null = null
  if (opId) {
    const { data: op } = await sb.from('operators').select('full_name, company_id, role').eq('id', opId).maybeSingle()
    if (op) {
      operatorName = op.full_name
      operatorCompany = op.role === 'admin' ? null : op.company_id
    }
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()

  // Parallel data fetch
  const [queueRes, completedRes, streakRes, operatorsRes, recentActionsRes, entradasRes, classificationsRes, assignedRes] = await Promise.all([
    // Exception queue
    sb.from('workflow_events')
      .select('id, workflow, event_type, trigger_id, company_id, payload, status, created_at, error_message, attempt_count')
      .in('status', ['pending', 'failed', 'dead_letter'])
      .order('created_at', { ascending: true })
      .limit(50),
    // Completed today
    sb.from('workflow_events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('created_at', todayStart),
    // Streak: days with activity in last 30 days
    opId
      ? sb.from('operator_actions')
          .select('created_at')
          .eq('operator_id', opId)
          .gte('created_at', thirtyDaysAgo)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
    // Team
    sb.from('operators').select('id, full_name, role'),
    // Recent actions (for team online status)
    sb.from('operator_actions')
      .select('operator_id, created_at')
      .gte('created_at', thirtyMinAgo),
    // Recent entradas (below fold)
    (() => {
      const q = sb.from('entradas')
        .select('id, cve_entrada, descripcion_mercancia, cantidad_bultos, company_id')
        .is('trafico', null)
        .order('fecha_llegada_mercancia', { ascending: false })
        .limit(10)
      if (operatorCompany) q.eq('company_id', operatorCompany)
      return q
    })(),
    // Recent classifications (below fold)
    sb.from('globalpc_productos')
      .select('fraccion, descripcion, fraccion_classified_at')
      .not('fraccion_classified_at', 'is', null)
      .order('fraccion_classified_at', { ascending: false })
      .limit(10),
    // Assigned to this operator
    opId
      ? sb.from('traficos')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_to_operator_id', opId)
          .eq('estatus', 'En Proceso')
      : Promise.resolve({ count: 0 }),
  ])

  // Process exception queue
  const allEvents = (queueRes.data || []) as WorkflowEvent[]
  let urgentCount = 0, normalCount = 0
  for (const e of allEvents) {
    const ageH = (now.getTime() - new Date(e.created_at).getTime()) / 3600000
    if (ageH > 2) urgentCount++
    else normalCount++
  }
  const topException = allEvents[0] || null
  const queuePreview = allEvents.slice(1, 6)

  // Streak calculation
  const streakDays = computeStreak(streakRes.data || [])

  // Active team
  const opDetails = operatorsRes.data || []
  const activeOpIds = new Set<string>()
  const todayActionsCount: Record<string, number> = {}
  for (const a of recentActionsRes.data || []) {
    activeOpIds.add(a.operator_id)
    todayActionsCount[a.operator_id] = (todayActionsCount[a.operator_id] || 0) + 1
  }
  const team = opDetails.map(op => ({
    id: op.id,
    full_name: op.full_name,
    role: op.role,
    isOnline: activeOpIds.has(op.id),
    actionsToday: todayActionsCount[op.id] || 0,
  }))

  return (
    <OperatorCockpit
      operatorName={operatorName}
      operatorId={opId || ''}
      urgentCount={urgentCount}
      normalCount={normalCount}
      completedToday={completedRes.count || 0}
      streak={streakDays}
      topException={topException}
      queuePreview={queuePreview}
      team={team}
      assignedCount={assignedRes.count || 0}
      completedCount={completedRes.count || 0}
      recentClassifications={classificationsRes.data || []}
      recentEntradas={entradasRes.data || []}
    />
  )
}

function computeStreak(actions: Array<{ created_at: string }>): number {
  if (!actions.length) return 0

  const uniqueDays = new Set<string>()
  for (const a of actions) {
    const d = new Date(a.created_at)
    uniqueDays.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
  }

  const sortedDays = Array.from(uniqueDays).sort().reverse()
  let streak = 0
  const today = new Date()
  let checkDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())

  for (const dayStr of sortedDays) {
    const expectedKey = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`
    if (dayStr === expectedKey) {
      streak++
      checkDate = new Date(checkDate.getTime() - 86400000)
    } else {
      break
    }
  }

  return streak
}
