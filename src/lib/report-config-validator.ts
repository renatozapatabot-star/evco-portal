/**
 * Block 3 · Dynamic Report Builder — Zod validator.
 * Kept separate so API routes stay thin.
 */
import { z } from 'zod'
import type { ReportConfig } from '@/types/reports'
import { isReportEntityId } from '@/lib/report-registry'

const OPERATOR = z.enum([
  'eq', 'neq', 'contains', 'gt', 'lt', 'gte', 'lte',
  'between', 'in_last_days', 'is_null', 'is_not_null', 'in',
])

const PrimValue = z.union([z.string().max(256), z.number(), z.boolean(), z.null()])

const FilterSchema = z.object({
  column: z.string().min(1).max(64),
  operator: OPERATOR,
  value: PrimValue.optional(),
  valueTo: PrimValue.optional(),
  values: z.array(z.union([z.string().max(256), z.number()])).max(100).optional(),
  days: z.number().int().min(1).max(3650).optional(),
})

const ConfigSchema = z.object({
  sourceEntity: z.string().min(1).max(64),
  columns: z.array(z.string().min(1).max(64)).min(1).max(50),
  filters: z.array(FilterSchema).max(20).default([]),
  filterJoin: z.enum(['and', 'or']).optional(),
  groupBy: z.string().max(64).optional(),
  orderBy: z
    .object({ column: z.string().max(64), direction: z.enum(['asc', 'desc']) })
    .optional(),
  limit: z.number().int().positive().max(5000).optional(),
})

export type ParseResult =
  | { ok: true; config: ReportConfig }
  | { ok: false; message: string }

export function parseReportConfig(raw: unknown): ParseResult {
  const parsed = ConfigSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, message: parsed.error.message }
  }
  if (!isReportEntityId(parsed.data.sourceEntity)) {
    return { ok: false, message: 'sourceEntity desconocido' }
  }
  return { ok: true, config: parsed.data as ReportConfig }
}
