/**
 * Block 2 · Unified Search Extension — shared search types.
 *
 * EntityId covers all 12 groups surfaced by the palette registry.
 * Kept in one place so registry, API routes, and components agree.
 */

export type EntityId =
  | 'traficos'
  | 'pedimentos'
  | 'entradas'
  | 'facturas'
  | 'partidas'
  | 'productos'
  | 'fracciones'
  | 'clientes'
  | 'proveedores'
  | 'operadores'
  | 'documentos'
  | 'ordenes_carga'

export type EntityScope = 'company' | 'internal' | 'client_clave' | 'stub'

export interface SearchResult {
  entityId: EntityId
  id: string
  title: string
  subtitle: string
  href: string
}

export interface SearchResponse {
  query: string
  groups: Record<EntityId, SearchResult[]>
  took_ms: number
}

/**
 * Advanced search criteria — 13 structured fields surfaced by AdvancedSearchModal.
 * All fields optional. Blank submit is rejected by validateAdvancedCriteria.
 */
export interface AdvancedSearchCriteria {
  traficoKey?: string
  pedimentoNumber?: string
  invoiceNumber?: string
  productNumber?: string
  tariffFraction?: string
  orderNumber?: string
  warehouseEntryKey?: string
  trailerBoxNumber?: string
  mpCertificateNumber?: string
  dateFrom?: string
  dateTo?: string
  clientCompanyId?: string
  statusCategory?: string[]
  operatorId?: string
}

export interface AdvancedSearchResultRow {
  trafico: string
  estatus: string | null
  descripcion_mercancia: string | null
  fecha_llegada: string | null
  pedimento: string | null
  company_id: string | null
}

export interface AdvancedSearchResponse {
  ok: boolean
  results: AdvancedSearchResultRow[]
  count: number
  truncated: boolean
  message?: string
}
