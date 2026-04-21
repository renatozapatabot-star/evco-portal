/**
 * Block 3 · Dynamic Report Builder — execution engine.
 *
 * Single query builder for preview + full-build. Enforces:
 *   - column whitelist (against registry)
 *   - role gate (operaciones → broker/admin)
 *   - tenant scope (company_id / clave_cliente / internal)
 *   - hard 5000-row cap
 *
 * Every execution logs to operational_decisions via logDecision.
 */
import { createServerClient } from '@/lib/supabase-server'
import { sanitizeIlike } from '@/lib/sanitize'
import { logDecision } from '@/lib/decision-logger'
import { getReportEntity, isReportEntityId } from '@/lib/report-registry'
import type {
  ColumnSpec,
  FilterNode,
  ReportConfig,
  ReportEntity,
  ReportQueryResult,
} from '@/types/reports'
import type { PortalRole } from '@/lib/session'

export const ROW_CAP = 5000
const PREVIEW_LIMIT = 20

export interface ReportSession {
  companyId: string
  role: PortalRole
  claveCliente?: string | null
}

function isInternalRole(role: PortalRole): boolean {
  return role === 'broker' || role === 'admin'
}

function columnAllowed(entity: ReportEntity, key: string): ColumnSpec | null {
  return entity.columns.find((c) => c.key === key) ?? null
}

// Supabase's typed chain fights dynamic select(string); narrow to the
// subset of methods we actually use and route everything through this.
interface ChainableQuery {
  eq(col: string, value: unknown): ChainableQuery
  neq(col: string, value: unknown): ChainableQuery
  gt(col: string, value: unknown): ChainableQuery
  lt(col: string, value: unknown): ChainableQuery
  gte(col: string, value: unknown): ChainableQuery
  lte(col: string, value: unknown): ChainableQuery
  ilike(col: string, pattern: string): ChainableQuery
  is(col: string, value: null): ChainableQuery
  not(col: string, op: string, value: unknown): ChainableQuery
  in(col: string, values: (string | number)[]): ChainableQuery
  order(col: string, opts: { ascending: boolean }): ChainableQuery
  limit(n: number): ChainableQuery
  then: PromiseLike<{ data: unknown; error: { message: string } | null }>['then']
}

function applyScope(
  q: ChainableQuery,
  entity: ReportEntity,
  session: ReportSession,
): ChainableQuery {
  const internal = isInternalRole(session.role)
  if (entity.scope === 'company') {
    if (!internal && session.companyId) {
      return q.eq('company_id', session.companyId)
    }
  } else if (entity.scope === 'clave_cliente') {
    if (!internal) {
      if (!session.claveCliente) return q.eq('clave_cliente', '__none__')
      return q.eq('clave_cliente', session.claveCliente)
    }
  }
  return q
}

function applyFilter(
  qb: ChainableQuery,
  entity: ReportEntity,
  filter: FilterNode,
): ChainableQuery | null {
  const spec = columnAllowed(entity, filter.column)
  if (!spec) return null
  if (!spec.operators.includes(filter.operator)) return null
  const col = spec.key

  switch (filter.operator) {
    case 'eq':
      return qb.eq(col, filter.value ?? null)
    case 'neq':
      return qb.neq(col, filter.value ?? null)
    case 'contains': {
      const v = String(filter.value ?? '')
      if (!v) return qb
      return qb.ilike(col, `%${sanitizeIlike(v)}%`)
    }
    case 'gt':
      return qb.gt(col, filter.value ?? 0)
    case 'lt':
      return qb.lt(col, filter.value ?? 0)
    case 'gte':
      return qb.gte(col, filter.value ?? 0)
    case 'lte':
      return qb.lte(col, filter.value ?? 0)
    case 'between': {
      if (filter.value == null || filter.valueTo == null) return qb
      return qb.gte(col, filter.value).lte(col, filter.valueTo)
    }
    case 'in_last_days': {
      const days = Math.max(1, Math.min(3650, Number(filter.days ?? 30)))
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
      return qb.gte(col, cutoff)
    }
    case 'is_null':
      return qb.is(col, null)
    case 'is_not_null':
      return qb.not(col, 'is', null)
    case 'in': {
      const vals = (filter.values ?? []).filter((x) => x != null)
      if (vals.length === 0) return qb
      return qb.in(col, vals as (string | number)[])
    }
    default:
      return qb
  }
}

async function executeQuery(
  config: ReportConfig,
  session: ReportSession,
  limit: number,
): Promise<ReportQueryResult> {
  if (!isReportEntityId(config.sourceEntity)) {
    return { ok: false, message: 'Fuente inválida' }
  }
  const entity = getReportEntity(config.sourceEntity)

  if (entity.roleGate && !entity.roleGate.includes(session.role)) {
    return { ok: false, message: 'Sin permiso para esta fuente' }
  }

  const cols = (config.columns ?? []).filter((c) => columnAllowed(entity, c))
  if (cols.length === 0) {
    return { ok: false, message: 'Selecciona al menos una columna' }
  }

  const sb = createServerClient()
  // Dynamic select + filter chain — narrow through ChainableQuery.
  let qb = sb.from(entity.table).select(cols.join(',')) as unknown as ChainableQuery
  qb = applyScope(qb, entity, session)

  for (const f of config.filters ?? []) {
    const next = applyFilter(qb, entity, f)
    if (next == null) return { ok: false, message: `Filtro inválido: ${f.column}` }
    qb = next
  }

  if (config.orderBy && columnAllowed(entity, config.orderBy.column)) {
    qb = qb.order(config.orderBy.column, {
      ascending: config.orderBy.direction !== 'desc',
    })
  }

  const capped = Math.min(limit, ROW_CAP + 1)
  qb = qb.limit(capped)

  const { data, error } = (await qb) as {
    data: Record<string, unknown>[] | null
    error: { message: string } | null
  }
  if (error) {
    return { ok: false, message: error.message }
  }
  const rows = data ?? []
  const truncated = limit >= ROW_CAP && rows.length > ROW_CAP
  if (truncated) {
    return {
      ok: false,
      message: 'Resultado excede 5000 filas — agrega más filtros.',
    }
  }
  return { ok: true, rows, count: rows.length, truncated: false }
}

export async function runReportQuery(
  config: ReportConfig,
  session: ReportSession,
): Promise<ReportQueryResult> {
  const result = await executeQuery(config, session, ROW_CAP + 1)
  void logDecision({
    decision_type: 'report_built',
    decision: `report:${config.sourceEntity}:${result.ok ? result.count : 'error'}`,
    reasoning: `Report executed by ${session.role} in ${session.companyId}`,
    dataPoints: {
      source: config.sourceEntity,
      columns: config.columns,
      filter_count: config.filters?.length ?? 0,
      ok: result.ok,
      count: result.ok ? result.count : null,
    },
    company_id: session.companyId,
  })
  return result
}

export async function runReportPreview(
  config: ReportConfig,
  session: ReportSession,
): Promise<ReportQueryResult> {
  return executeQuery(config, session, PREVIEW_LIMIT)
}
