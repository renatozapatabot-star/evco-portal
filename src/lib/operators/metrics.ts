/**
 * ZAPATA AI · V1.5 F10 — Operator performance metrics.
 *
 * Computes per-operator metrics for a given company in a date range.
 *
 * Sources (all null-safe — missing tables/columns degrade gracefully):
 *   - operators                 (canonical source: id, full_name, role, active)
 *   - operator_actions          (actions authored by operator_id in range)
 *   - workflow_events           (trafico lifecycle events)
 *   - traficos                  (assigned_to_operator_id, for cycle + MVE grouping)
 *   - mve_alerts                (per-embarque MVE exposure)
 *   - document_classifications  (F14-shaped table; graceful absent)
 *
 * Contract:
 *   - Pure reader. Never writes. Never throws.
 *   - Applies company_id scoping on every query (defense in depth beyond RLS).
 *   - Returns one row per operator that is either active or had any activity
 *     in the requested window.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = { from: (table: string) => any }

export interface OperatorMetricsRange {
  /** ISO timestamp inclusive lower bound */
  from: string
  /** ISO timestamp inclusive upper bound */
  to: string
}

export interface OperatorMetricsRow {
  operatorId: string
  name: string
  role: string
  traficosHandled: number
  avgCycleHours: number | null
  errorRate: number | null
  classificationAccuracy: number | null
  mveComplianceRate: number | null
  lastActiveAt: string | null
}

interface OperatorRow {
  id: string
  full_name: string | null
  role: string | null
  company_id: string | null
  active: boolean | null
}

interface ActionRow {
  operator_id: string
  action_type: string | null
  target_table: string | null
  target_id: string | null
  created_at: string
}

interface EventRow {
  event_type: string | null
  trigger_id: string | null
  created_at: string
}

interface TraficoRow {
  trafico: string
  assigned_to_operator_id: string | null
}

interface MveRow {
  trafico_id: string | null
}

interface ClassRow {
  confirmed_by: string | null
  confirmed_match: boolean | null
}

async function safeSelect<T>(
  run: () => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  try {
    const { data, error } = await run()
    if (error) return []
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

const START_EVENTS = new Set(['supplier_confirmed', 'entrada_received'])
const END_EVENT = 'semaforo_verde'

function isErrorAction(action: string | null): boolean {
  if (!action) return false
  const a = action.toLowerCase()
  return a.includes('error') || a.includes('reject') || a.includes('failed')
}

/**
 * Compute per-operator metrics. Never throws.
 */
export async function computeOperatorMetrics(
  supabase: AnyClient,
  companyId: string,
  range: OperatorMetricsRange,
): Promise<OperatorMetricsRow[]> {
  const { from, to } = range

  // 1) Canonical operator roster — company-scoped + active.
  const operators = await safeSelect<OperatorRow>(() =>
    supabase
      .from('operators')
      .select('id, full_name, role, company_id, active')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('full_name', { ascending: true })
      .limit(500),
  )

  if (operators.length === 0) return []

  const opIds = operators.map((o) => o.id)

  // 2) Actions + events + traficos + mve + (optional) classifications in parallel.
  const [actions, events, traficos, mve, classifications] = await Promise.all([
    safeSelect<ActionRow>(() =>
      supabase
        .from('operator_actions')
        .select('operator_id, action_type, target_table, target_id, created_at')
        .in('operator_id', opIds)
        .gte('created_at', from)
        .lte('created_at', to)
        .limit(50000),
    ),
    safeSelect<EventRow>(() =>
      supabase
        .from('workflow_events')
        .select('event_type, trigger_id, created_at')
        .eq('company_id', companyId)
        .gte('created_at', from)
        .lte('created_at', to)
        .limit(50000),
    ),
    safeSelect<TraficoRow>(() =>
      supabase
        .from('traficos')
        .select('trafico, assigned_to_operator_id')
        .eq('company_id', companyId)
        .in('assigned_to_operator_id', opIds)
        .limit(50000),
    ),
    safeSelect<MveRow>(() =>
      supabase
        .from('mve_alerts')
        .select('trafico_id')
        .gte('created_at', from)
        .lte('created_at', to)
        .limit(50000),
    ),
    safeSelect<ClassRow>(() =>
      supabase
        .from('document_classifications')
        .select('confirmed_by, confirmed_match')
        .in('confirmed_by', opIds)
        .gte('created_at', from)
        .lte('created_at', to)
        .limit(50000),
    ),
  ])

  // 3) Index helpers.
  const actionsByOp = new Map<string, ActionRow[]>()
  for (const a of actions) {
    const arr = actionsByOp.get(a.operator_id) ?? []
    arr.push(a)
    actionsByOp.set(a.operator_id, arr)
  }

  const traficosByOp = new Map<string, string[]>()
  for (const t of traficos) {
    if (!t.assigned_to_operator_id) continue
    const arr = traficosByOp.get(t.assigned_to_operator_id) ?? []
    arr.push(t.trafico)
    traficosByOp.set(t.assigned_to_operator_id, arr)
  }

  const mveTraficos = new Set<string>()
  for (const m of mve) {
    if (m.trafico_id) mveTraficos.add(m.trafico_id)
  }

  const startByTrafico = new Map<string, string>()
  const endByTrafico = new Map<string, string>()
  for (const e of events) {
    if (!e.trigger_id || !e.event_type) continue
    if (START_EVENTS.has(e.event_type)) {
      const prev = startByTrafico.get(e.trigger_id)
      if (!prev || e.created_at < prev) startByTrafico.set(e.trigger_id, e.created_at)
    } else if (e.event_type === END_EVENT) {
      const prev = endByTrafico.get(e.trigger_id)
      if (!prev || e.created_at > prev) endByTrafico.set(e.trigger_id, e.created_at)
    }
  }

  const classByOp = new Map<string, { total: number; matches: number }>()
  for (const c of classifications) {
    if (!c.confirmed_by) continue
    const acc = classByOp.get(c.confirmed_by) ?? { total: 0, matches: 0 }
    acc.total += 1
    if (c.confirmed_match === true) acc.matches += 1
    classByOp.set(c.confirmed_by, acc)
  }

  // 4) Compose rows.
  const rows: OperatorMetricsRow[] = operators.map((op) => {
    const opActions = actionsByOp.get(op.id) ?? []

    // traficosHandled = distinct target_id from actions where target_table='traficos'
    const traficoTargets = new Set<string>()
    let errorCount = 0
    let lastActiveAt: string | null = null
    for (const a of opActions) {
      if (a.target_table === 'traficos' && a.target_id) traficoTargets.add(a.target_id)
      if (isErrorAction(a.action_type)) errorCount += 1
      if (!lastActiveAt || a.created_at > lastActiveAt) lastActiveAt = a.created_at
    }
    const traficosHandled = traficoTargets.size

    const errorRate = opActions.length > 0 ? errorCount / opActions.length : null

    // avgCycleHours — average (end - start) across embarques the operator is assigned to
    const assignedTraficos = traficosByOp.get(op.id) ?? []
    let cycleSum = 0
    let cycleCount = 0
    for (const tId of assignedTraficos) {
      const s = startByTrafico.get(tId)
      const e = endByTrafico.get(tId)
      if (!s || !e) continue
      const ms = new Date(e).getTime() - new Date(s).getTime()
      if (!Number.isFinite(ms) || ms <= 0) continue
      cycleSum += ms
      cycleCount += 1
    }
    const avgCycleHours = cycleCount > 0 ? cycleSum / cycleCount / 3600000 : null

    // mveComplianceRate — fraction of assigned embarques WITHOUT mve_alerts in range
    let mveClean = 0
    for (const tId of assignedTraficos) {
      if (!mveTraficos.has(tId)) mveClean += 1
    }
    const mveComplianceRate =
      assignedTraficos.length > 0 ? mveClean / assignedTraficos.length : null

    // classificationAccuracy — optional, from document_classifications
    const cls = classByOp.get(op.id)
    const classificationAccuracy =
      cls && cls.total > 0 ? cls.matches / cls.total : null

    return {
      operatorId: op.id,
      name: op.full_name ?? '—',
      role: op.role ?? 'operator',
      traficosHandled,
      avgCycleHours,
      errorRate,
      classificationAccuracy,
      mveComplianceRate,
      lastActiveAt,
    }
  })

  return rows
}

/**
 * Format helpers — kept in the lib so tests + UI agree on rounding.
 */
export function formatPct(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

export function formatHours(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—'
  if (value < 1) return `${(value * 60).toFixed(0)} min`
  return `${value.toFixed(1)} h`
}
