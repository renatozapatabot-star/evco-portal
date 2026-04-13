/**
 * Block 2 · Unified Search Extension — entity registry.
 *
 * Single source of truth for the 12 groups surfaced by the palette and the
 * 13 structured fields on the advanced-search modal. Display order here is
 * display order in the UI.
 *
 * The icon field is kept as a string identifier (not a LucideIcon binding)
 * so this module stays framework-agnostic and tree-shakes cleanly on the
 * server side of /api/search/advanced.
 */

import type {
  AdvancedSearchCriteria,
  EntityId,
  EntityScope,
} from '@/types/search'
import {
  AGUILA_BG_ELEVATED,
  ACCENT_SILVER,
  BORDER_HAIRLINE,
  TEXT_TERTIARY,
} from '@/lib/design-system'

export interface EntityConfig {
  id: EntityId
  labelEs: string
  labelSingularEs: string
  iconName: string
  searchFields: string[]
  listHref: string
  scope: EntityScope
  maxResultsPerGroup: number
  emptyMessage?: string
}

/**
 * 12 groups. Order = display order in the palette.
 */
export const SEARCH_ENTITIES: readonly EntityConfig[] = [
  {
    id: 'traficos',
    labelEs: 'Embarques',
    labelSingularEs: 'Embarque',
    iconName: 'truck',
    searchFields: ['trafico', 'descripcion_mercancia', 'pedimento'],
    listHref: '/embarques',
    scope: 'company',
    maxResultsPerGroup: 5,
  },
  {
    id: 'pedimentos',
    labelEs: 'Pedimentos',
    labelSingularEs: 'Pedimento',
    iconName: 'file-text',
    searchFields: ['pedimento', 'referencia', 'proveedor'],
    listHref: '/pedimentos',
    scope: 'client_clave',
    maxResultsPerGroup: 5,
  },
  {
    id: 'entradas',
    labelEs: 'Entradas',
    labelSingularEs: 'Entrada',
    iconName: 'package',
    searchFields: ['cve_entrada', 'descripcion_mercancia', 'trafico'],
    listHref: '/entradas',
    scope: 'company',
    maxResultsPerGroup: 5,
  },
  {
    id: 'facturas',
    labelEs: 'Facturas',
    labelSingularEs: 'Factura',
    iconName: 'receipt',
    searchFields: ['num_factura', 'proveedor', 'referencia'],
    listHref: '/pedimentos',
    scope: 'client_clave',
    maxResultsPerGroup: 5,
  },
  {
    id: 'partidas',
    labelEs: 'Partidas',
    labelSingularEs: 'Partida',
    iconName: 'list',
    searchFields: ['descripcion', 'cve_trafico', 'numero_parte'],
    listHref: '/fracciones',
    scope: 'company',
    maxResultsPerGroup: 5,
  },
  {
    id: 'productos',
    labelEs: 'Productos',
    labelSingularEs: 'Producto',
    iconName: 'box',
    searchFields: ['cve_producto', 'descripcion', 'fraccion'],
    listHref: '/fracciones',
    scope: 'company',
    maxResultsPerGroup: 5,
  },
  {
    id: 'fracciones',
    labelEs: 'Fracciones',
    labelSingularEs: 'Fracción',
    iconName: 'hash',
    searchFields: ['fraccion_arancelaria'],
    listHref: '/fracciones',
    scope: 'company',
    maxResultsPerGroup: 5,
  },
  {
    id: 'clientes',
    labelEs: 'Clientes',
    labelSingularEs: 'Cliente',
    iconName: 'building',
    searchFields: ['name', 'clave_cliente', 'company_id'],
    listHref: '/clientes',
    scope: 'internal',
    maxResultsPerGroup: 5,
  },
  {
    id: 'proveedores',
    labelEs: 'Proveedores',
    labelSingularEs: 'Proveedor',
    iconName: 'users',
    searchFields: ['nombre', 'cve_proveedor', 'id_fiscal'],
    listHref: '/proveedores',
    scope: 'company',
    maxResultsPerGroup: 5,
  },
  {
    id: 'operadores',
    labelEs: 'Operadores',
    labelSingularEs: 'Operador',
    iconName: 'user',
    searchFields: ['name', 'email'],
    listHref: '/clientes',
    scope: 'internal',
    maxResultsPerGroup: 5,
  },
  {
    id: 'documentos',
    labelEs: 'Documentos',
    labelSingularEs: 'Documento',
    iconName: 'file',
    searchFields: ['nombre', 'doc_type'],
    listHref: '/documentos',
    scope: 'company',
    maxResultsPerGroup: 5,
  },
  {
    id: 'ordenes_carga',
    labelEs: 'Órdenes de carga',
    labelSingularEs: 'Orden de carga',
    iconName: 'truck',
    searchFields: [],
    listHref: '/embarques',
    scope: 'stub',
    maxResultsPerGroup: 0,
    emptyMessage: 'Por llegar — esperando sistema de cargas',
  },
] as const

/**
 * 13 structured fields for the advanced-search modal.
 * `dataSource` maps to the table we'll filter against at runtime.
 */
export interface AdvancedFieldConfig {
  id: keyof AdvancedSearchCriteria
  labelEs: string
  kind: 'text' | 'date' | 'date_from' | 'date_to' | 'select' | 'multi_select'
  dataSource?: string
  placeholder?: string
  flag?: 'stub' | 'placeholder' | 'conditional'
}

export const ADVANCED_SEARCH_FIELDS: readonly AdvancedFieldConfig[] = [
  { id: 'traficoKey', labelEs: 'Clave de embarque', kind: 'text', dataSource: 'traficos.trafico' },
  { id: 'pedimentoNumber', labelEs: 'Número de pedimento', kind: 'text', dataSource: 'traficos.pedimento' },
  { id: 'invoiceNumber', labelEs: 'Número de factura', kind: 'text', dataSource: 'aduanet_facturas.num_factura' },
  { id: 'productNumber', labelEs: 'Número de producto', kind: 'text', dataSource: 'globalpc_productos.cve_producto' },
  { id: 'tariffFraction', labelEs: 'Fracción arancelaria', kind: 'text', dataSource: 'globalpc_partidas.fraccion_arancelaria' },
  { id: 'orderNumber', labelEs: 'Número de orden', kind: 'text', flag: 'stub', placeholder: 'Sin fuente de datos aún' },
  { id: 'warehouseEntryKey', labelEs: 'Clave de entrada', kind: 'text', dataSource: 'entradas.cve_entrada' },
  { id: 'trailerBoxNumber', labelEs: 'Caja / trailer', kind: 'text', flag: 'conditional', dataSource: 'entradas.num_caja_trailer' },
  { id: 'mpCertificateNumber', labelEs: 'Certificado MP', kind: 'text', flag: 'placeholder' },
  { id: 'dateFrom', labelEs: 'Desde', kind: 'date_from', dataSource: 'traficos.fecha_llegada' },
  { id: 'dateTo', labelEs: 'Hasta', kind: 'date_to', dataSource: 'traficos.fecha_llegada' },
  { id: 'clientCompanyId', labelEs: 'Cliente', kind: 'select', dataSource: 'companies' },
  { id: 'statusCategory', labelEs: 'Estatus', kind: 'multi_select', dataSource: 'workflow_events' },
  { id: 'operatorId', labelEs: 'Operador asignado', kind: 'select', dataSource: 'client_users' },
] as const

/**
 * Blank-submit guard. Returns { valid: false, message } if every criterion
 * is null/empty/whitespace. Called both client-side (disable button) and
 * server-side (hard wall — never unbounded query).
 */
export function validateAdvancedCriteria(
  c: AdvancedSearchCriteria,
): { valid: true } | { valid: false; message: string } {
  const hasAny = Object.values(c).some((v) => {
    if (v == null) return false
    if (typeof v === 'string') return v.trim().length > 0
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'object') {
      return Object.values(v as Record<string, unknown>).some((x) => {
        if (x == null) return false
        return String(x).trim().length > 0
      })
    }
    return true
  })
  return hasAny
    ? { valid: true }
    : { valid: false, message: 'Especifica al menos un criterio de búsqueda' }
}

/**
 * Convenience: find config by id.
 */
export function getEntityConfig(id: EntityId): EntityConfig {
  const match = SEARCH_ENTITIES.find((e) => e.id === id)
  if (!match) throw new Error(`Unknown entity id: ${id}`)
  return match
}

// ── AGUILA re-exports (scoped to search surface) ──
export const AGUILA = {
  BG_ELEVATED: AGUILA_BG_ELEVATED,
  BORDER_HAIRLINE,
  ACCENT_SILVER,
  TEXT_TERTIARY,
} as const

/**
 * Operator search role whitelist (plan §Decisions locked).
 * NOTE: `client_users.role` CHECK constraint today is
 * ('admin','editor','viewer') — only `admin` rows match this filter until
 * the schema catches up. Flagged in BLOCK2_UNIFIED_SEARCH_AUDIT.md.
 */
export const OPERATOR_SEARCH_ROLES = [
  'operator',
  'admin',
  'broker',
  'warehouse',
  'contabilidad',
] as const
