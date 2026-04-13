/**
 * Block 3 · Dynamic Report Builder — entity registry.
 *
 * Single source of truth for the 10 reportable entities. Shape mirrors
 * search-registry so the two surfaces stay alignable. Role gating + scope
 * enforced by report-engine, not here.
 */
import type { ReportEntity, ReportEntityId, ColumnSpec } from '@/types/reports'

const TEXT_OPS = ['eq', 'neq', 'contains', 'is_null', 'is_not_null', 'in'] as const
const NUM_OPS = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'between', 'is_null', 'is_not_null'] as const
const DATE_OPS = ['eq', 'gt', 'lt', 'gte', 'lte', 'between', 'in_last_days', 'is_null', 'is_not_null'] as const
const ENUM_OPS = ['eq', 'neq', 'in', 'is_null', 'is_not_null'] as const
const BOOL_OPS = ['eq', 'is_null', 'is_not_null'] as const

function col(
  key: string,
  label: string,
  type: ColumnSpec['type'],
  extras: Partial<ColumnSpec> = {},
): ColumnSpec {
  const operators =
    type === 'number' || type === 'currency'
      ? [...NUM_OPS]
      : type === 'date'
        ? [...DATE_OPS]
        : type === 'enum'
          ? [...ENUM_OPS]
          : type === 'boolean'
            ? [...BOOL_OPS]
            : [...TEXT_OPS]
  return { key, label, type, operators, ...extras }
}

export const REPORT_ENTITIES: readonly ReportEntity[] = [
  {
    id: 'traficos',
    table: 'traficos',
    label: 'Embarques',
    iconName: 'Truck',
    scope: 'company',
    primaryDateColumn: 'fecha_llegada',
    columns: [
      col('trafico', 'Embarque', 'text'),
      col('pedimento', 'Pedimento', 'text'),
      col('estatus', 'Estatus', 'text'),
      col('descripcion_mercancia', 'Descripción', 'text'),
      col('fecha_llegada', 'Fecha llegada', 'date', { format: 'es-MX-date' }),
      col('dias_activos', 'Días activos', 'number'),
      col('tipo_operacion', 'Tipo de operación', 'text'),
      col('cliente', 'Cliente', 'text'),
      col('assigned_to_operator_id', 'Operador', 'text', { advanced: true }),
      col('company_id', 'Empresa', 'text', { advanced: true }),
      col('created_at', 'Creado', 'date', { advanced: true, format: 'es-MX-datetime' }),
    ],
  },
  {
    id: 'pedimentos',
    table: 'aduanet_facturas',
    label: 'Pedimentos',
    iconName: 'FileStack',
    scope: 'clave_cliente',
    primaryDateColumn: 'fecha',
    columns: [
      col('pedimento', 'Pedimento', 'text'),
      col('referencia', 'Referencia', 'text'),
      col('proveedor', 'Proveedor', 'text'),
      col('num_factura', 'Factura', 'text'),
      col('valor_total', 'Valor total', 'currency', { format: 'USD' }),
      col('fecha', 'Fecha', 'date', { format: 'es-MX-date' }),
      col('clave_cliente', 'Clave cliente', 'text', { advanced: true }),
    ],
  },
  {
    id: 'facturas',
    table: 'aduanet_facturas',
    label: 'Facturas',
    iconName: 'Receipt',
    scope: 'clave_cliente',
    primaryDateColumn: 'fecha',
    columns: [
      col('num_factura', 'Factura', 'text'),
      col('proveedor', 'Proveedor', 'text'),
      col('referencia', 'Referencia', 'text'),
      col('pedimento', 'Pedimento', 'text'),
      col('valor_total', 'Valor', 'currency', { format: 'USD' }),
      col('fecha', 'Fecha', 'date', { format: 'es-MX-date' }),
    ],
  },
  {
    id: 'partidas',
    table: 'globalpc_partidas',
    label: 'Partidas',
    iconName: 'ListOrdered',
    scope: 'internal',
    columns: [
      col('cve_trafico', 'Embarque', 'text'),
      col('numero_parte', 'Número de parte', 'text'),
      col('descripcion', 'Descripción', 'text'),
      col('fraccion_arancelaria', 'Fracción', 'text'),
      col('cantidad', 'Cantidad', 'number'),
      col('valor_aduana', 'Valor aduana', 'currency', { format: 'USD' }),
      col('clave_docto', 'Clave documento', 'text', { advanced: true }),
    ],
  },
  {
    id: 'productos',
    table: 'globalpc_productos',
    label: 'Productos',
    iconName: 'Package',
    scope: 'internal',
    columns: [
      col('cve_producto', 'Producto', 'text'),
      col('descripcion', 'Descripción', 'text'),
      col('fraccion', 'Fracción', 'text'),
      col('cve_proveedor', 'Proveedor', 'text'),
      col('pais_origen', 'País origen', 'text'),
    ],
  },
  {
    id: 'entradas',
    table: 'entradas',
    label: 'Entradas',
    iconName: 'PackageOpen',
    scope: 'company',
    primaryDateColumn: 'fecha_entrada',
    columns: [
      col('cve_entrada', 'Entrada', 'text'),
      col('trafico', 'Embarque', 'text'),
      col('descripcion_mercancia', 'Descripción', 'text'),
      col('fecha_entrada', 'Fecha entrada', 'date', { format: 'es-MX-date' }),
      col('bultos', 'Bultos', 'number'),
      col('peso', 'Peso (kg)', 'number'),
      col('proveedor', 'Proveedor', 'text'),
      col('transporte', 'Transporte', 'text'),
    ],
  },
  {
    id: 'clientes',
    table: 'companies',
    label: 'Clientes',
    iconName: 'Building2',
    scope: 'internal',
    columns: [
      col('company_id', 'Empresa', 'text'),
      col('name', 'Nombre', 'text'),
      col('clave_cliente', 'Clave cliente', 'text'),
      col('rfc', 'RFC', 'text', { advanced: true }),
    ],
  },
  {
    id: 'proveedores',
    table: 'globalpc_proveedores',
    label: 'Proveedores',
    iconName: 'Factory',
    scope: 'internal',
    columns: [
      col('cve_proveedor', 'Clave proveedor', 'text'),
      col('nombre', 'Nombre', 'text'),
      col('id_fiscal', 'ID fiscal', 'text'),
      col('pais', 'País', 'text'),
    ],
  },
  {
    id: 'eventos',
    table: 'trafico_events',
    label: 'Eventos',
    iconName: 'Activity',
    scope: 'company',
    primaryDateColumn: 'created_at',
    columns: [
      col('event_type', 'Tipo de evento', 'text'),
      col('display_name_es', 'Descripción', 'text'),
      col('trafico', 'Embarque', 'text'),
      col('category', 'Categoría', 'text'),
      col('author_id', 'Autor', 'text', { advanced: true }),
      col('created_at', 'Fecha', 'date', { format: 'es-MX-datetime' }),
    ],
  },
  {
    id: 'operaciones',
    table: 'operational_decisions',
    label: 'Decisiones operativas',
    iconName: 'Brain',
    scope: 'internal',
    primaryDateColumn: 'created_at',
    roleGate: ['broker', 'admin'] as const,
    columns: [
      col('decision_type', 'Tipo', 'text'),
      col('decision', 'Decisión', 'text'),
      col('reasoning', 'Razonamiento', 'text'),
      col('trafico', 'Embarque', 'text'),
      col('alternatives_considered', 'Alternativas', 'text', { advanced: true }),
      col('data_points_used', 'Datos utilizados', 'text', { advanced: true }),
      col('created_at', 'Fecha', 'date', { format: 'es-MX-datetime' }),
    ],
  },
] as const

export function getReportEntity(id: ReportEntityId): ReportEntity {
  const match = REPORT_ENTITIES.find((e) => e.id === id)
  if (!match) throw new Error(`Unknown report entity: ${id}`)
  return match
}

export function isReportEntityId(s: string): s is ReportEntityId {
  return REPORT_ENTITIES.some((e) => e.id === s)
}
