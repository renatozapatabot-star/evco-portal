/**
 * CRUZ Database Row Types
 * Shared interfaces for Supabase table rows used across components and API routes.
 * Canonical types for traficos/entradas/facturas live in @/lib/data — re-exported here.
 */

export type { Trafico, Entrada, Factura } from '@/lib/data'

/** Date-like input accepted by formatting functions */
export type DateInput = string | Date | null | undefined

/** Numeric input accepted by formatting functions */
export type NumberInput = number | string | null | undefined

// ── expediente_documentos ──

export interface ExpedienteDocumentoRow {
  id?: string
  pedimento_id: string
  doc_type: string
  nombre?: string | null
  file_name?: string | null
  file_url?: string | null
  company_id?: string
  source?: string | null
}

// ── notifications ──

export interface NotificationRow {
  id: string
  type: string
  severity: string
  title: string
  description: string | null
  trafico_id: string | null
  company_id?: string
  action_url?: string | null
  created_at?: string
  read?: boolean
}

// ── pedimento_drafts ──

export interface DraftProduct {
  descripcion?: string
  fraccion?: string
  valor_usd?: number
  confidence?: number
  cantidad?: number
  peso_bruto?: number
  pais_origen?: string
}

export interface DraftData {
  type?: string
  supplier?: string
  supplier_name?: string
  country?: string
  confidence?: number
  products?: DraftProduct[]
  valor_total_usd?: number
  tipo_cambio?: number
  regimen?: string
  checklist?: string[]
  trafico?: string
  trafico_id?: string
  invoice_number?: string
  currency?: string
  incoterm?: string
  extraction?: Record<string, unknown>
  classifications?: Array<{ fraccion?: string; confidence?: number; descripcion?: string; reasoning?: string }>
  contributions?: Record<string, unknown>
  email?: { sender?: string; subject?: string; received_at?: string; gmail_message_id?: string }
  missing_docs?: string[]
  missing_docs_labels?: string[]
  contact?: { name?: string; email?: string; company?: string }
}

export interface DraftRow {
  id: string
  trafico_id: string | null
  draft_data: DraftData
  status: string
  company_id?: string
  created_by?: string
  created_at: string
  escalation_level?: number
  needs_manual_intervention?: boolean
  last_escalation_at?: string | null
}

// ── bridge_intelligence ──

export interface BridgeIntelligenceRow {
  id?: string
  bridge_name: string
  crossing_hours: number
  day_of_week?: number
  hour_of_day?: number | null
  updated_at?: string
}

// ── compliance_predictions ──

export interface CompliancePredictionRow {
  id: string
  company_id?: string
  prediction_type?: string
  description?: string
  due_date?: string
  severity: string
  resolved?: boolean
  created_at?: string
}

// ── supplier_contacts ──

export interface SupplierContactRow {
  id: string
  proveedor: string
  supplier_name?: string | null
  contact_name: string | null
  contact_email: string | null
  contact_phone?: string | null
  address?: string | null
  company_id?: string
  usmca_eligible?: boolean | null
  tmec_eligible?: boolean | null
  updated_at?: string | null
  country?: string | null
}

// ── supplier_network ──

export interface SupplierNetworkRow {
  supplier_name: string
  supplier_name_normalized?: string | null
  reliability_score?: number | null
  tmec_eligible?: boolean | null
  incident_rate?: number | null
  total_operations?: number | null
  avg_value_usd?: number | null
  country?: string | null
}

// ── document_classifications ──

export interface DocumentClassificationRow {
  id?: string
  filename: string
  doc_type: string
  confidence?: number | null
  source?: string | null
  file_path?: string | null
  created_at?: string
}

// ── documents (generic document store) ──

export interface DocumentRow {
  id?: string
  trafico_id?: string
  document_type?: string
  doc_type?: string
  file_path?: string
  file_url?: string
  metadata?: Record<string, unknown> | null
  nombre?: string | null
}

// ── alert / risk types ──

export interface AlertRow {
  id: string
  company_id?: string
  type?: string
  severity: string
  title?: string
  description?: string
  trafico_id?: string | null
  created_at?: string
  resolved?: boolean
}

export interface RiskScoreRow {
  trafico_id: string
  overall_score?: number
  score?: number
  risk_factors?: string[]
  created_at?: string
}

// ── crossing / bridge ──

export interface CrossingWindowRow {
  bridge_name: string
  day_of_week: number
  hour_of_day: number
  avg_minutes: number
  sample_count?: number
}

// ── Anthropic API content blocks (used in chat routes) ──

export interface AnthropicTextBlock {
  type: 'text'
  text: string
}

export interface AnthropicToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock

// ── Partidas (line items on facturas) ──

export interface PartidaRow {
  fraccion_arancelaria?: string | null
  fraccion?: string | null
  descripcion_mercancia?: string | null
  cantidad?: number | null
  valor_comercial?: number | null
  precio_unitario?: number | null
  pais_origen?: string | null
}

// ── Knowledge base ──

export interface KnowledgeRow {
  id: string
  knowledge_type?: string
  title?: string
  content?: string
  summary?: string
  source?: string
  created_at?: string
}

// ── Market signals ──

export interface MarketSignalRow {
  id: string
  category?: string
  signal_type?: string
  description?: string
  source?: string
  severity?: string
  created_at?: string
}
