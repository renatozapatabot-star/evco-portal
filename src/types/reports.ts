/**
 * Block 3 · Dynamic Report Builder — shared types.
 *
 * ReportConfig is the serialisable shape persisted in report_templates.config
 * and posted to /api/reports/{preview,build,export}. Keep it transport-stable.
 */
import type { PortalRole } from '@/lib/session'

export type ColumnType = 'text' | 'number' | 'date' | 'currency' | 'enum' | 'boolean' | 'json'

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'contains'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'between'
  | 'in_last_days'
  | 'is_null'
  | 'is_not_null'
  | 'in'

export type TemplateScope = 'private' | 'team' | 'seed'

export interface ColumnSpec {
  key: string
  label: string
  type: ColumnType
  operators: FilterOperator[]
  advanced?: boolean
  enumValues?: readonly string[]
  format?: 'MXN' | 'USD' | 'es-MX-date' | 'es-MX-datetime'
}

export type EntityScope = 'company' | 'clave_cliente' | 'internal'

export type ReportEntityId =
  | 'traficos'
  | 'pedimentos'
  | 'facturas'
  | 'partidas'
  | 'productos'
  | 'entradas'
  | 'clientes'
  | 'proveedores'
  | 'eventos'
  | 'operaciones'

export interface ReportEntity {
  id: ReportEntityId
  table: string
  label: string
  iconName: string
  scope: EntityScope
  primaryDateColumn?: string
  roleGate?: readonly PortalRole[]
  columns: readonly ColumnSpec[]
}

export interface FilterNode {
  column: string
  operator: FilterOperator
  value?: string | number | boolean | null
  valueTo?: string | number | null
  values?: ReadonlyArray<string | number>
  days?: number
}

export type LogicJoin = 'and' | 'or'

export interface ReportConfig {
  sourceEntity: ReportEntityId
  columns: string[]
  filters: FilterNode[]
  filterJoin?: LogicJoin
  groupBy?: string
  orderBy?: { column: string; direction: 'asc' | 'desc' }
  limit?: number
}

export interface ReportTemplateRow {
  id: string
  company_id: string
  created_by: string
  name: string
  source_entity: ReportEntityId
  config: ReportConfig
  scope: TemplateScope
  schedule_cron: string | null
  schedule_recipients: string[] | null
  created_at: string
  updated_at: string
}

export interface ReportTemplateSeed {
  name: string
  source_entity: ReportEntityId
  config: ReportConfig
  requiresTable?: string // if set, only seed when probe confirms table exists
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf'

export interface ReportQueryOk {
  ok: true
  rows: Record<string, unknown>[]
  count: number
  truncated: boolean
}

export interface ReportQueryErr {
  ok: false
  message: string
}

export type ReportQueryResult = ReportQueryOk | ReportQueryErr

export interface ProbeResult {
  alive: ReportEntityId[]
  missing: ReportEntityId[]
}
