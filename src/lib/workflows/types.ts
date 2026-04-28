/**
 * Shared types for the 3 Killer Daily Driver Workflows.
 *
 * The detector contract:
 *   - `detect(ctx)` returns DetectedFinding[] — pure data, no writes.
 *   - `runner.ts` upserts findings + blends feedback into confidence.
 *
 * Shadow-mode invariant: nothing in this module executes a side-effect.
 * Every proposal is stored for human review via the dashboard widget.
 */

export type WorkflowKind =
  | 'missing_nom'
  | 'high_value_risk'
  | 'duplicate_shipment'

export type WorkflowSeverity = 'info' | 'warning' | 'critical'

export type WorkflowStatus =
  | 'shadow'
  | 'acknowledged'
  | 'dismissed'
  | 'resolved'

/** Pure-data finding the detector returns; the runner adds storage
 *  metadata (confidence blend, seen_count, timestamps). */
export interface DetectedFinding {
  kind: WorkflowKind
  /** Stable idempotency key within (company_id, kind). Never includes
   *  volatile bits like timestamps. Example:
   *  `missing_nom:trafico:26-24-3596-6500441:fraccion:3901.20.01` */
  signature: string
  severity: WorkflowSeverity
  subject_type: 'trafico' | 'pedimento' | 'entrada' | 'factura'
  subject_id: string
  title_es: string
  detail_es: string
  /** Base confidence in [0,1] before feedback priors are blended. */
  base_confidence: number
  /** Structured evidence rendered in the widget detail panel. */
  evidence: Record<string, unknown>
  /** Structured proposal — what we'd ask a human to authorize.
   *  Shadow mode: the runner stores this. No one executes it. */
  proposal: WorkflowProposal
}

export type WorkflowProposal =
  | MensajeriaProposal
  | MergeShipmentsProposal
  | FlagForReviewProposal
  | NoActionProposal

export interface MensajeriaProposal {
  action: 'draft_mensajeria'
  recipient_role: 'supplier' | 'operator' | 'anabel'
  recipient_label_es: string
  subject_es: string
  body_es: string
  /** Attach which documents (by doc_type) if any */
  attach_doc_types: string[]
}

export interface MergeShipmentsProposal {
  action: 'merge_shipments'
  primary_trafico: string
  duplicate_trafico: string
  rationale_es: string
  fields_to_reconcile: string[]
}

export interface FlagForReviewProposal {
  action: 'flag_for_review'
  reviewer_role: 'operator' | 'broker' | 'tito'
  reason_es: string
}

export interface NoActionProposal {
  action: 'none'
  rationale_es: string
}

/** Stored shape — what /api/workflows/findings returns. */
export interface StoredFinding {
  id: string
  kind: WorkflowKind
  signature: string
  severity: WorkflowSeverity
  subject_type: string
  subject_id: string
  title_es: string
  detail_es: string
  evidence: Record<string, unknown>
  proposal: WorkflowProposal
  confidence: number
  seen_count: number
  status: WorkflowStatus
  created_at: string
  last_seen_at: string
}

/** Context each detector receives. The runner fetches the tenant
 *  slice once per run and hands the same payload to all 3 detectors
 *  so we don't over-query Supabase. */
export interface DetectorContext {
  companyId: string
  /** Active + recent traficos for the tenant (last 90d). */
  traficos: TraficoRow[]
  /** Partidas keyed by trafico number for fracción lookups. */
  partidasByTrafico: Map<string, PartidaRow[]>
  /** Recent entradas (invoice arrivals) for duplicate invoice detection. */
  entradas: EntradaRow[]
  /** Known Mexican NOM-regulated fracción prefixes (4-digit). */
  nomRegulatedFracciones: ReadonlySet<string>
}

export interface TraficoRow {
  trafico: string
  estatus: string | null
  fecha_llegada: string | null
  pedimento: string | null
  proveedores: string | null
  valor_aduana_mxn: number | null
  valor_comercial_usd: number | null
  company_id: string
}

export interface PartidaRow {
  trafico: string
  fraccion: string | null
  descripcion: string | null
  valor_comercial_usd: number | null
  cantidad: number | null
  unidad: string | null
  nom_certificate: string | null
}

export interface EntradaRow {
  id: string
  trafico: string | null
  proveedor: string | null
  invoice_number: string | null
  valor_usd: number | null
  fecha_llegada_mercancia: string | null
  company_id: string
}
