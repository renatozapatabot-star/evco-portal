/**
 * CRUZ 2.0 — Workflow Event Types
 *
 * TypeScript definitions matching the workflow_events DB schema.
 * Used by portal components to display real-time workflow timelines.
 */

export type WorkflowType =
  | 'intake'
  | 'classify'
  | 'docs'
  | 'pedimento'
  | 'crossing'
  | 'post_op'
  | 'invoice'

export type WorkflowEventStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'dead_letter'

export interface WorkflowEvent {
  id: string
  workflow: WorkflowType
  event_type: string
  trigger_id: string | null
  company_id: string
  payload: Record<string, unknown>
  status: WorkflowEventStatus
  attempt_count: number
  error_message: string | null
  created_at: string
  processing_at: string | null
  completed_at: string | null
  parent_event_id: string | null
}

export interface WorkflowChain {
  id: string
  source_workflow: WorkflowType
  source_event: string
  target_workflow: WorkflowType
  target_event: string
  enabled: boolean
  description: string | null
  created_at: string
}

export interface WorkflowMetrics {
  id: string
  workflow: WorkflowType
  company_id: string
  date: string
  events_total: number
  events_completed: number
  events_failed: number
  avg_duration_ms: number | null
  created_at: string
}

/** Display labels for each workflow (Spanish primary) */
export const WORKFLOW_LABELS: Record<WorkflowType, string> = {
  intake: 'Recepción',
  classify: 'Clasificación',
  docs: 'Documentos',
  pedimento: 'Pedimento',
  crossing: 'Cruce',
  post_op: 'Post-operación',
  invoice: 'Facturación',
}

/** Display labels for common event types (Spanish) */
export const EVENT_LABELS: Record<string, string> = {
  email_processed: 'Email procesado',
  document_attached: 'Documento adjunto',
  product_needs_classification: 'Producto por clasificar',
  classification_complete: 'Clasificación completa',
  needs_human_review: 'Requiere revisión',
  document_received: 'Documento recibido',
  completeness_check: 'Verificación de expediente',
  expediente_complete: 'Expediente completo',
  solicitation_needed: 'Solicitud necesaria',
  solicitation_sent: 'Solicitud enviada',
  duties_calculated: 'Contribuciones calculadas',
  ready_for_approval: 'Listo para aprobación',
  approved: 'Aprobado',
  pedimento_paid: 'Pedimento pagado',
  dispatch_ready: 'Despacho listo',
  crossing_complete: 'Cruce completado',
  operation_scored: 'Operación evaluada',
  operation_accumulated: 'Acumulado para factura',
  invoice_ready: 'Factura lista',
}

/** Status colors matching the design system */
export const STATUS_VARIANTS: Record<WorkflowEventStatus, string> = {
  pending: 'gray',
  processing: 'amber',
  completed: 'green',
  failed: 'red',
  dead_letter: 'red',
}

/**
 * Calculate duration in milliseconds between created_at and completed_at.
 * Returns null if event is not yet completed.
 */
export function getEventDuration(event: WorkflowEvent): number | null {
  if (!event.completed_at) return null
  return new Date(event.completed_at).getTime() - new Date(event.created_at).getTime()
}

/**
 * Get the ordered workflow sequence for display.
 * Returns the canonical order of the 7 workflows.
 */
export const WORKFLOW_ORDER: WorkflowType[] = [
  'intake',
  'classify',
  'docs',
  'pedimento',
  'crossing',
  'post_op',
  'invoice',
]
