/**
 * Block 3 · Dynamic Report Builder — pre-seeded templates.
 *
 * 8 seed configs per plan §Pre-seeded templates. Seeded idempotently on
 * first /reportes visit per company via UNIQUE (company_id, name).
 * Template 8 only seeds when expediente_documentos probes alive.
 */
import type { ReportTemplateSeed } from '@/types/reports'

export const SEED_TEMPLATES: readonly ReportTemplateSeed[] = [
  {
    name: 'Tráficos activos',
    source_entity: 'traficos',
    config: {
      sourceEntity: 'traficos',
      columns: [
        'trafico',
        'cliente',
        'estatus',
        'fecha_llegada',
        'dias_activos',
        'pedimento',
        'assigned_to_operator_id',
      ],
      filters: [{ column: 'estatus', operator: 'neq', value: 'Cruzado' }],
      orderBy: { column: 'dias_activos', direction: 'desc' },
    },
  },
  {
    name: 'Pedimentos del mes',
    source_entity: 'pedimentos',
    config: {
      sourceEntity: 'pedimentos',
      columns: ['pedimento', 'referencia', 'proveedor', 'num_factura', 'valor_total', 'fecha'],
      filters: [{ column: 'fecha', operator: 'in_last_days', days: 30 }],
      orderBy: { column: 'fecha', direction: 'desc' },
    },
  },
  {
    name: 'Facturas pendientes de asignación',
    source_entity: 'facturas',
    config: {
      sourceEntity: 'facturas',
      columns: ['num_factura', 'proveedor', 'valor_total', 'referencia', 'fecha'],
      filters: [{ column: 'pedimento', operator: 'is_null' }],
      orderBy: { column: 'fecha', direction: 'desc' },
    },
  },
  {
    name: 'Productos sin clasificar',
    source_entity: 'productos',
    config: {
      sourceEntity: 'productos',
      columns: ['cve_producto', 'descripcion', 'cve_proveedor', 'pais_origen'],
      filters: [{ column: 'fraccion', operator: 'is_null' }],
      orderBy: { column: 'cve_producto', direction: 'asc' },
    },
  },
  {
    name: 'Eventos críticos esta semana',
    source_entity: 'eventos',
    config: {
      sourceEntity: 'eventos',
      columns: ['event_type', 'display_name_es', 'trafico', 'created_at', 'author_id'],
      filters: [
        { column: 'category', operator: 'eq', value: 'exception' },
        { column: 'created_at', operator: 'in_last_days', days: 7 },
      ],
      orderBy: { column: 'created_at', direction: 'desc' },
    },
  },
  {
    name: 'Resumen por cliente',
    source_entity: 'traficos',
    config: {
      sourceEntity: 'traficos',
      columns: ['cliente', 'trafico', 'estatus', 'fecha_llegada'],
      filters: [],
      groupBy: 'cliente',
      orderBy: { column: 'fecha_llegada', direction: 'desc' },
    },
  },
  {
    name: 'Anexo 24 simple',
    source_entity: 'partidas',
    config: {
      sourceEntity: 'partidas',
      columns: [
        'cve_trafico',
        'fraccion_arancelaria',
        'descripcion',
        'cantidad',
        'valor_aduana',
        'clave_docto',
      ],
      filters: [],
      orderBy: { column: 'cve_trafico', direction: 'desc' },
    },
  },
  {
    name: 'Documentos faltantes',
    source_entity: 'eventos',
    requiresTable: 'expediente_documentos',
    config: {
      sourceEntity: 'eventos',
      columns: ['trafico', 'event_type', 'display_name_es', 'created_at'],
      filters: [
        { column: 'event_type', operator: 'contains', value: 'document' },
        { column: 'created_at', operator: 'in_last_days', days: 14 },
      ],
      orderBy: { column: 'created_at', direction: 'desc' },
    },
  },
] as const
