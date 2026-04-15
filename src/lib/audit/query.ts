/**
 * ZAPATA AI V1.5 · F16 — audit log query helpers.
 *
 * Thin layer over the `audit_log` table. The API route is the only
 * call-site in the portal; tests exercise `diffBeforeAfter` directly.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE'

export interface AuditLogRow {
  id: number
  table_name: string
  record_id: string
  action: AuditAction
  changed_by: string | null
  company_id: string | null
  changed_at: string
  before_jsonb: Record<string, unknown> | null
  after_jsonb: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
}

export interface AuditLogFilters {
  table?: string
  recordId?: string
  changedBy?: string
  from?: string
  to?: string
  limit?: number
  cursor?: number
}

export interface AuditLogQueryResult {
  rows: AuditLogRow[]
  nextCursor: number | null
}

const ALLOWED_TABLES = new Set(['traficos', 'partidas', 'pedimentos', 'clientes'])

export async function queryAuditLog(
  supabase: SupabaseClient,
  companyId: string,
  filters: AuditLogFilters = {},
): Promise<AuditLogQueryResult> {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200)

  let q = supabase
    .from('audit_log')
    .select('*')
    .eq('company_id', companyId)
    .order('changed_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (filters.table && filters.table !== 'all' && ALLOWED_TABLES.has(filters.table)) {
    q = q.eq('table_name', filters.table)
  }
  if (filters.recordId) q = q.eq('record_id', filters.recordId)
  if (filters.changedBy) q = q.eq('changed_by', filters.changedBy)
  if (filters.from) q = q.gte('changed_at', filters.from)
  if (filters.to) q = q.lte('changed_at', filters.to)
  if (typeof filters.cursor === 'number') q = q.lt('id', filters.cursor)

  const { data, error } = await q
  if (error) throw new Error(`queryAuditLog failed: ${error.message}`)

  const rows = (data ?? []) as AuditLogRow[]
  const hasMore = rows.length > limit
  const trimmed = hasMore ? rows.slice(0, limit) : rows
  const nextCursor = hasMore ? trimmed[trimmed.length - 1].id : null

  return { rows: trimmed, nextCursor }
}

export interface FieldDiff {
  field: string
  before: unknown
  after: unknown
}

/**
 * Return only the fields whose value changed between `before` and `after`.
 * Noise fields like updated_at are collapsed to keep the diff readable.
 */
export function diffBeforeAfter(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): FieldDiff[] {
  const NOISE = new Set(['updated_at'])
  const keys = new Set<string>([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ])
  const diffs: FieldDiff[] = []
  for (const key of keys) {
    if (NOISE.has(key)) continue
    const b = before?.[key]
    const a = after?.[key]
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diffs.push({ field: key, before: b, after: a })
    }
  }
  return diffs.sort((x, y) => x.field.localeCompare(y.field))
}
