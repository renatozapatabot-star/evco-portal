import { z } from 'zod'

/** /api/auth — login */
export const authSchema = z.object({
  password: z.string().min(1).max(100),
})

/** /api/cruz-chat — AI chat */
export const cruzChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.union([z.string(), z.array(z.any())]),
  })).min(1).max(50),
  sessionId: z.string().max(100).optional(),
  context: z.object({
    page: z.string().max(500).optional(),
    timestamp: z.string().optional(),
    voice_mode: z.boolean().optional(),
  }).optional(),
})

/** /api/data — generic data query */
const ALLOWED_TABLES = [
  'traficos', 'aduanet_facturas', 'entradas', 'documents', 'soia_cruces', 'soia_payment_status',
  'globalpc_facturas', 'globalpc_partidas', 'globalpc_eventos', 'globalpc_contenedores',
  'globalpc_ordenes_carga', 'globalpc_proveedores', 'globalpc_productos', 'globalpc_bultos',
  'econta_facturas', 'econta_facturas_detalle', 'econta_cartera', 'econta_aplicaciones',
  'econta_ingresos', 'econta_egresos', 'econta_anticipos', 'econta_polizas',
  'product_intelligence', 'financial_intelligence', 'crossing_intelligence', 'warehouse_intelligence',
  'pre_arrival_briefs', 'duplicates_detected', 'compliance_predictions', 'pedimento_risk_scores',
  'anomaly_baselines', 'supplier_contacts', 'crossing_predictions', 'monthly_intelligence_reports',
  'client_benchmarks', 'oca_database', 'supplier_network', 'bridge_intelligence',
  'regulatory_alerts', 'document_metadata', 'communication_events', 'compliance_events',
  'trade_prospects', 'prospect_sightings', 'competitor_sightings',
  'pipeline_overview', 'trafico_completeness', 'expediente_documentos',
] as const

export const dataQuerySchema = z.object({
  table: z.enum(ALLOWED_TABLES),
  limit: z.coerce.number().int().min(1).max(5000).default(50),
  company_id: z.string().max(50).optional(),
  clave_cliente: z.string().max(20).optional(),
  cve_cliente: z.string().max(20).optional(),
  trafico_prefix: z.string().max(20).optional(),
  cve_trafico: z.string().max(30).optional(),
  order_by: z.string().max(50).optional(),
  order_dir: z.enum(['asc', 'desc']).optional(),
  gte_field: z.string().max(50).optional(),
  gte_value: z.string().max(50).optional(),
  not_null: z.string().max(50).optional(),
})

/** /api/pedimento-package — pedimento data bundle */
export const pedimentoPackageSchema = z.object({
  trafico: z.string().regex(/^[\w-]+$/, 'Formato de tráfico inválido').max(30),
})

/** /api/search — global search */
export const searchSchema = z.object({
  q: z.string().min(2).max(100),
})
