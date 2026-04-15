/**
 * Events catalog — client-side lookup + state-machine helpers.
 *
 * Source of truth for the 55-event GlobalPC lifecycle vocabulary.
 * Rows live in `events_catalog` (see supabase/migrations/20260412_events_catalog.sql).
 * This module mirrors the seed so UI can render icons/colors without a round-trip,
 * and encodes the transition map that drives Acciones Rápidas.
 *
 * Recon source: docs/recon/V2_GLOBALPC_RECON.md
 */

import {
  ACCENT_SILVER,
  GOLD,
  GREEN,
  RED,
  TEXT_MUTED,
} from '@/lib/design-system'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Category =
  | 'lifecycle'
  | 'payment'
  | 'inspection'
  | 'exception'
  | 'export'
  | 'load_order'
  | 'vucem'
  | 'document'
  | 'manual'

export type Workflow =
  | 'pedimento'
  | 'invoice'
  | 'crossing'
  | 'docs'
  | 'intake'
  | 'email'
  | 'monitor'

export type EventCatalogRow = {
  event_type: string
  category: Category
  visibility: 'public' | 'private'
  display_name_es: string
  description_es: string | null
  icon_name: string | null
  color_token: string | null
}

export type SuggestedAction = {
  id: string
  label_es: string
  icon: string
  category: Category
  /** Event type to fire when clicked, or null for custom handlers. */
  event_type: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Category → color + workflow maps
// ─────────────────────────────────────────────────────────────────────────────

export const EVENT_CATEGORY_COLORS: Record<Category, string> = {
  lifecycle: ACCENT_SILVER,
  payment: GOLD,
  inspection: ACCENT_SILVER, // row-level override: green vs red by event_type
  exception: RED,
  export: ACCENT_SILVER,
  load_order: ACCENT_SILVER,
  vucem: ACCENT_SILVER,
  document: ACCENT_SILVER,
  manual: TEXT_MUTED,
}

export const CATEGORY_TO_WORKFLOW: Record<Category, Workflow> = {
  lifecycle: 'pedimento',
  payment: 'invoice',
  inspection: 'crossing',
  exception: 'pedimento',
  export: 'pedimento',
  load_order: 'crossing',
  vucem: 'pedimento',
  document: 'docs',
  manual: 'intake',
}

/**
 * Row-level color resolver — honours inspection green/red split and
 * falls back to the category color for everything else.
 */
export function resolveEventColor(row: Pick<EventCatalogRow, 'category' | 'color_token'>): string {
  switch (row.color_token) {
    case 'GREEN':
      return GREEN
    case 'RED':
      return RED
    case 'GOLD':
      return GOLD
    case 'ACCENT_SILVER':
      return ACCENT_SILVER
    case 'TEXT_MUTED':
      return TEXT_MUTED
    default:
      return EVENT_CATEGORY_COLORS[row.category]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Suggested-action configs (composed into transition map below)
// ─────────────────────────────────────────────────────────────────────────────

export const ACTION_CAPTURE_INITIAL: SuggestedAction = {
  id: 'capture_initial',
  label_es: 'Capturar datos iniciales',
  icon: 'file-text',
  category: 'lifecycle',
  event_type: 'initial_pedimento_data_captured',
}

export const ACTION_ASSIGN_INVOICES: SuggestedAction = {
  id: 'assign_invoices',
  label_es: 'Asignar facturas',
  icon: 'receipt',
  category: 'lifecycle',
  event_type: 'invoices_assigned',
}

export const ACTION_GENERATE_CLASSIFICATION_SHEET: SuggestedAction = {
  id: 'generate_classification_sheet',
  label_es: 'Generar hoja de clasificación',
  icon: 'layers',
  category: 'lifecycle',
  event_type: 'classification_sheet_generated',
}

export const ACTION_GENERATE_PEDIMENTO_INTERFACE: SuggestedAction = {
  id: 'generate_pedimento_interface',
  label_es: 'Generar interfaz de pedimento',
  icon: 'upload',
  category: 'lifecycle',
  event_type: 'pedimento_interface_generated',
}

export const ACTION_ISSUE_PAYMENT_NOTICE: SuggestedAction = {
  id: 'issue_payment_notice',
  label_es: 'Emitir aviso de pago',
  icon: 'dollar-sign',
  category: 'lifecycle',
  event_type: 'payment_notice_issued',
}

export const ACTION_RECORD_PAYMENT: SuggestedAction = {
  id: 'record_payment',
  label_es: 'Registrar pago',
  icon: 'credit-card',
  category: 'payment',
  event_type: null, // bank-specific; opens a chooser
}

export const ACTION_REQUEST_COVE: SuggestedAction = {
  id: 'request_cove',
  label_es: 'Solicitar COVE',
  icon: 'cloud-upload',
  category: 'vucem',
  event_type: 'cove_requested',
}

export const ACTION_VALIDATE_COVE: SuggestedAction = {
  id: 'validate_cove',
  label_es: 'Validar COVE (U4)',
  icon: 'check-circle',
  category: 'vucem',
  event_type: 'cove_u4_validated',
}

export const ACTION_ISSUE_LOAD_ORDER: SuggestedAction = {
  id: 'issue_load_order',
  label_es: 'Emitir orden de carga',
  icon: 'truck',
  category: 'lifecycle',
  event_type: 'load_order_issued',
}

export const ACTION_MARK_WAREHOUSE_EXIT: SuggestedAction = {
  id: 'mark_warehouse_exit',
  label_es: 'Registrar salida de bodega',
  icon: 'truck',
  category: 'load_order',
  event_type: 'load_order_warehouse_exit',
}

export const ACTION_MARK_CUSTOMS_CLEARED: SuggestedAction = {
  id: 'mark_customs_cleared',
  label_es: 'Marcar mercancía despachada',
  icon: 'check-circle',
  category: 'lifecycle',
  event_type: 'merchandise_customs_cleared',
}

export const ACTION_GENERATE_DIGITAL_FILE: SuggestedAction = {
  id: 'generate_digital_file',
  label_es: 'Generar expediente digital',
  icon: 'folder',
  category: 'lifecycle',
  event_type: 'digital_file_generated',
}

export const ACTION_SEND_TO_CLIENT: SuggestedAction = {
  id: 'send_to_client',
  label_es: 'Enviar expediente al cliente',
  icon: 'mail',
  category: 'document',
  event_type: 'documents_sent_to_client',
}

export const ACTION_REQUEST_DOCS: SuggestedAction = {
  id: 'request_docs',
  label_es: 'Solicitar documentos al proveedor',
  icon: 'mail',
  category: 'document',
  event_type: 'supplier_solicitation_sent',
}

export const ACTION_ASSIGN_OPERATOR: SuggestedAction = {
  id: 'assign_operator',
  label_es: 'Asignar operador',
  icon: 'user-plus',
  category: 'manual',
  event_type: 'operator_assigned',
}

export const ACTION_ADD_NOTE: SuggestedAction = {
  id: 'add_note',
  label_es: 'Agregar nota',
  icon: 'message-square',
  category: 'manual',
  event_type: null, // handled by Notas tab composer
}

export const ACTION_ESCALATE: SuggestedAction = {
  id: 'escalate',
  label_es: 'Escalar al broker',
  icon: 'arrow-up',
  category: 'manual',
  event_type: 'operator_escalation',
}

export const ACTION_MARK_RECEIVED: SuggestedAction = {
  id: 'mark_received',
  label_es: 'Marcar recepción en bodega',
  icon: 'package',
  category: 'lifecycle',
  event_type: 'warehouse_entry_received',
}

export const ACTION_FILE_RECTIFICATION: SuggestedAction = {
  id: 'file_rectification',
  label_es: 'Presentar rectificación',
  icon: 'edit',
  category: 'exception',
  event_type: 'rectification_filed',
}

// Initial state — what an operator sees on a brand new embarque.
export const STARTER_ACTIONS: SuggestedAction[] = [
  ACTION_MARK_RECEIVED,
  ACTION_CAPTURE_INITIAL,
  ACTION_ASSIGN_OPERATOR,
  ACTION_REQUEST_DOCS,
  ACTION_ADD_NOTE,
]

// ─────────────────────────────────────────────────────────────────────────────
// State machine — transition map
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapping from last-observed event_type → ordered suggested actions.
 * Every entry is capped at 5 after append of generic actions.
 * Keys cover the happy path (lifecycle + payment + VUCEM + load order +
 * clearance + dispatch) and common off-ramps (exceptions, inspection red).
 */
const TRANSITIONS: Record<string, SuggestedAction[]> = {
  warehouse_entry_received: [ACTION_CAPTURE_INITIAL, ACTION_ASSIGN_OPERATOR, ACTION_REQUEST_DOCS],
  trafico_created: [ACTION_CAPTURE_INITIAL, ACTION_ASSIGN_OPERATOR, ACTION_ADD_NOTE],
  initial_pedimento_data_captured: [ACTION_ASSIGN_INVOICES, ACTION_REQUEST_DOCS],
  invoices_assigned: [ACTION_GENERATE_CLASSIFICATION_SHEET, ACTION_REQUEST_COVE],
  classification_sheet_generated: [ACTION_GENERATE_PEDIMENTO_INTERFACE, ACTION_REQUEST_COVE],
  pedimento_interface_generated: [ACTION_ISSUE_PAYMENT_NOTICE, ACTION_VALIDATE_COVE],
  payment_notice_issued: [ACTION_RECORD_PAYMENT],
  payment_all_banks: [ACTION_ISSUE_LOAD_ORDER, ACTION_VALIDATE_COVE],
  cove_requested: [ACTION_VALIDATE_COVE],
  cove_received: [ACTION_VALIDATE_COVE],
  cove_u4_validated: [ACTION_ISSUE_LOAD_ORDER, ACTION_ISSUE_PAYMENT_NOTICE],
  load_order_issued: [ACTION_MARK_WAREHOUSE_EXIT],
  load_order_created: [ACTION_MARK_WAREHOUSE_EXIT],
  load_order_warehouse_exit: [ACTION_MARK_CUSTOMS_CLEARED],
  semaforo_first_green: [ACTION_MARK_CUSTOMS_CLEARED],
  semaforo_first_red: [ACTION_ESCALATE, ACTION_FILE_RECTIFICATION, ACTION_ADD_NOTE],
  semaforo_second_red: [ACTION_ESCALATE, ACTION_FILE_RECTIFICATION],
  recognition_first_with_incidents: [ACTION_ESCALATE, ACTION_FILE_RECTIFICATION],
  merchandise_customs_cleared: [ACTION_GENERATE_DIGITAL_FILE, ACTION_SEND_TO_CLIENT],
  digital_file_generated: [ACTION_SEND_TO_CLIENT],
  supplier_solicitation_sent: [ACTION_ADD_NOTE, ACTION_ASSIGN_INVOICES],
  supplier_solicitation_received: [ACTION_ASSIGN_INVOICES, ACTION_GENERATE_CLASSIFICATION_SHEET],
  documents_received: [ACTION_ASSIGN_INVOICES, ACTION_ADD_NOTE],
  document_missing_flagged: [ACTION_REQUEST_DOCS, ACTION_ESCALATE],
  embargo_initiated: [ACTION_ESCALATE, ACTION_ADD_NOTE],
  investigation_opened: [ACTION_ESCALATE, ACTION_ADD_NOTE],
}

const GENERIC_TAIL: SuggestedAction[] = [ACTION_ADD_NOTE, ACTION_ESCALATE]

/**
 * Given the current lifecycle state (most recent event_type), return up to
 * 5 context-aware actions for the Acciones Rápidas panel. Specific
 * transitions first, then a generic tail, de-duplicated by `id`.
 */
export function getSuggestedActions(currentState: string | null): SuggestedAction[] {
  if (!currentState) return STARTER_ACTIONS

  const specific = TRANSITIONS[currentState] ?? []
  const merged: SuggestedAction[] = []
  const seen = new Set<string>()

  for (const action of [...specific, ...GENERIC_TAIL]) {
    if (seen.has(action.id)) continue
    seen.add(action.id)
    merged.push(action)
    if (merged.length === 5) break
  }

  return merged
}

/**
 * Derive the current lifecycle state from a list of workflow_events.
 * Assumes the caller sorts by `created_at DESC` (newest first). Returns
 * the most recent event_type, or null when the embarque has no events yet.
 */
export function getCurrentState(
  events: Array<{ event_type: string; created_at: string }>,
): string | null {
  if (events.length === 0) return null
  const sorted = [...events].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
  return sorted[0]?.event_type ?? null
}
