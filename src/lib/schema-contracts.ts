/**
 * Schema contracts — compile-time real-column guards.
 *
 * Problem this module solves:
 *   Supabase queries like `.from('traficos').select('proveedor, fecha_pago')`
 *   compile fine even when `proveedor` isn't a real column. Production
 *   gets a silent PostgREST 400 that the soft-query wrapper swallows.
 *   The class of bug took 3 marathons (M12 + M14 + M15 + M16) to fully
 *   eradicate. Never again.
 *
 * How this prevents recurrence:
 *   Every tenant-scoped table has a `TABLE_COLUMNS` tuple of its real
 *   columns. Helpers like `assertColumn<'traficos'>(col)` force the
 *   column name through a type-level check. Wrong column → TypeScript
 *   error at compile time.
 *
 * Usage pattern (optional, not mandatory):
 *   ```ts
 *   import { col } from '@/lib/schema-contracts'
 *   const { data } = await sb.from('traficos')
 *     .select(`${col('traficos', 'trafico')}, ${col('traficos', 'pedimento')}`)
 *   ```
 *
 *   The `col()` call trips a TS error if you pass a phantom name.
 *
 * Lower-cost approach: just import the `TraficosColumns` union type for
 * documentation / grep; don't have to wrap every select() in col().
 * The ratchet in gsd-verify catches drift at merge time; this module
 * catches it at edit time.
 *
 * Kept intentionally small — the value is the types, not runtime code.
 */

// ── Real-column tuples (SSOT) ─────────────────────────────────────

export const TRAFICOS_COLUMNS = [
  'id', 'trafico', 'pedimento', 'fecha_cruce', 'fecha_llegada', 'fecha_pago',
  'semaforo', 'estatus', 'regimen', 'aduana', 'patente', 'tipo_cambio',
  'importe_total', 'descripcion_mercancia', 'bultos_recibidos', 'peso_bruto',
  'peso_bruto_unidad', 'peso_volumetrico', 'contenedor', 'referencia_cliente',
  'proveedores', 'facturas', 'client_id', 'company_id', 'tenant_id',
  'tenant_slug', 'assigned_to_operator_id', 'broker_id', 'embarque', 'oficina',
  'pais_procedencia', 'predicted_at', 'predicted_fraccion', 'predicted_igi',
  'predicted_landed_cost', 'predicted_tmec', 'prediction_confidence',
  'score_reasons', 'transportista_extranjero', 'transportista_mexicano',
  'created_at', 'updated_at',
] as const

export const GLOBALPC_PARTIDAS_COLUMNS = [
  'id', 'folio', 'numero_item', 'cve_producto', 'cve_cliente', 'cve_proveedor',
  'cantidad', 'precio_unitario', 'peso', 'pais_origen', 'marca', 'modelo',
  'serie', 'company_id', 'tenant_id', 'created_at',
] as const

export const GLOBALPC_FACTURAS_COLUMNS = [
  'id', 'folio', 'cve_trafico', 'cve_proveedor', 'cve_cliente',
  'valor_comercial', 'moneda', 'fecha_facturacion', 'numero', 'cove_vucem',
  'incoterm', 'flete', 'seguros', 'deducibles', 'embalajes', 'incrementables',
  'company_id', 'tenant_id', 'created_at', 'updated_at',
] as const

export const GLOBALPC_PRODUCTOS_COLUMNS = [
  'id', 'cve_producto', 'cve_cliente', 'cve_proveedor', 'descripcion',
  'descripcion_ingles', 'fraccion', 'fraccion_classified_at', 'fraccion_source',
  'umt', 'marca', 'nico', 'pais_origen', 'precio_unitario', 'globalpc_folio',
  'company_id', 'tenant_id', 'created_at',
] as const

export const GLOBALPC_PROVEEDORES_COLUMNS = [
  'id', 'cve_proveedor', 'nombre', 'id_fiscal', 'alias', 'calle', 'ciudad',
  'pais', 'telefono', 'email_contacto', 'contacto', 'cve_cliente',
  'company_id', 'tenant_id', 'created_at',
] as const

export const COMPANIES_COLUMNS = [
  'id', 'company_id', 'name', 'rfc', 'patente', 'aduana', 'clave_cliente',
  'globalpc_clave', 'active', 'branding', 'features', 'contact_name',
  'contact_email', 'contact_phone', 'immex', 'language', 'tmec_eligible',
  'portal_password', 'portal_url', 'onboarded_at', 'first_login_at',
  'first_question_at', 'last_sync', 'health_score', 'health_grade',
  'health_details', 'health_breakdown', 'health_score_updated',
  'traficos_count', 'created_at',
] as const

export const EXPEDIENTE_DOCUMENTOS_COLUMNS = [
  'id', 'doc_type', 'file_name', 'file_size', 'file_url', 'metadata',
  'pedimento_id', 'uploaded_at', 'uploaded_by', 'company_id',
] as const

export const ENTRADAS_COLUMNS = [
  'id', 'cve_entrada', 'cve_embarque', 'trafico', 'tipo_operacion',
  'tipo_carga', 'fecha_llegada_mercancia', 'fecha_ingreso',
  'num_caja_trailer', 'num_pedido', 'num_talon', 'in_bond', 'flete_pagado',
  'material_peligroso', 'mercancia_danada', 'tiene_faltantes',
  'comentarios_danada', 'comentarios_faltantes', 'comentarios_generales',
  'recibido_por', 'recibio_facturas', 'recibio_packing_list',
  'cantidad_bultos', 'peso_bruto', 'peso_neto', 'descripcion_mercancia',
  'embarcador', 'transportista_americano', 'transportista_mexicano',
  'prioridad', 'cve_cliente', 'cve_proveedor', 'company_id', 'tenant_id',
  'tenant_slug', 'broker_id', 'created_at', 'updated_at',
  'fecha_actualizacion',
] as const

// ── Types ─────────────────────────────────────────────────────────

export type TraficosColumn = (typeof TRAFICOS_COLUMNS)[number]
export type GlobalpcPartidasColumn = (typeof GLOBALPC_PARTIDAS_COLUMNS)[number]
export type GlobalpcFacturasColumn = (typeof GLOBALPC_FACTURAS_COLUMNS)[number]
export type GlobalpcProductosColumn = (typeof GLOBALPC_PRODUCTOS_COLUMNS)[number]
export type GlobalpcProveedoresColumn = (typeof GLOBALPC_PROVEEDORES_COLUMNS)[number]
export type CompaniesColumn = (typeof COMPANIES_COLUMNS)[number]
export type ExpedienteDocumentosColumn = (typeof EXPEDIENTE_DOCUMENTOS_COLUMNS)[number]
export type EntradasColumn = (typeof ENTRADAS_COLUMNS)[number]

export interface SchemaColumnMap {
  traficos: TraficosColumn
  globalpc_partidas: GlobalpcPartidasColumn
  globalpc_facturas: GlobalpcFacturasColumn
  globalpc_productos: GlobalpcProductosColumn
  globalpc_proveedores: GlobalpcProveedoresColumn
  companies: CompaniesColumn
  expediente_documentos: ExpedienteDocumentosColumn
  entradas: EntradasColumn
}

export type SchemaTable = keyof SchemaColumnMap

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Assert a column name belongs to the real schema at compile time.
 * Returns the column name unchanged so you can inline it in a select():
 *   sb.from('traficos').select(col('traficos', 'trafico'))
 * Passing a phantom name errors at TypeScript check time.
 */
export function col<T extends SchemaTable>(
  _table: T,
  column: SchemaColumnMap[T],
): SchemaColumnMap[T] {
  return column
}

/**
 * Assert a comma-separated column list against a table's real columns.
 * Use for inline .select() strings:
 *   sb.from('traficos').select(cols('traficos', 'trafico, pedimento'))
 *
 * Runtime: splits on commas, validates each token in dev (NODE_ENV !==
 * 'production'). In prod it's a no-op to avoid per-query overhead.
 * Compile time: the list is still a plain string — this helper is a
 * runtime safety net complementing the compile-time `col()` helper.
 */
export function cols<T extends SchemaTable>(
  table: T,
  list: string,
): string {
  if (process.env.NODE_ENV !== 'production') {
    const real = TABLE_COLUMNS[table]
    for (const raw of list.split(',')) {
      const trimmed = raw.trim().split(/\s+/)[0] // drop alias syntax "col as X"
      if (!trimmed) continue
      if (!(real as readonly string[]).includes(trimmed)) {
        throw new Error(
          `schema-contract violation: '${trimmed}' is not a real column on '${table}'. ` +
            `Real columns: ${real.join(', ')}.`,
        )
      }
    }
  }
  return list
}

const TABLE_COLUMNS: Record<SchemaTable, readonly string[]> = {
  traficos: TRAFICOS_COLUMNS,
  globalpc_partidas: GLOBALPC_PARTIDAS_COLUMNS,
  globalpc_facturas: GLOBALPC_FACTURAS_COLUMNS,
  globalpc_productos: GLOBALPC_PRODUCTOS_COLUMNS,
  globalpc_proveedores: GLOBALPC_PROVEEDORES_COLUMNS,
  companies: COMPANIES_COLUMNS,
  expediente_documentos: EXPEDIENTE_DOCUMENTOS_COLUMNS,
  entradas: ENTRADAS_COLUMNS,
}

/** Return the real-column tuple for a table (for debug/introspection). */
export function realColumns<T extends SchemaTable>(table: T): readonly string[] {
  return TABLE_COLUMNS[table]
}
