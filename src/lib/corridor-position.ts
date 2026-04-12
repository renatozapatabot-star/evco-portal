// Block 7 · Corridor Map — event_type → landmark + severity resolver.
// Pure function. Maps real workflow_events.event_type values (from
// Block 1's events_catalog) to one of the 9 corridor landmarks, with
// a PulseSeverity. Fallback: `rz_office` / `at_rest` — never crash.

import type {
  CorridorPosition,
  Landmark,
  LandmarkId,
  PulseSeverity,
  WorkflowEventSlim,
} from '@/types/corridor'

type Mapping = {
  landmarkId: LandmarkId
  severity: PulseSeverity
  label: string
}

export const EVENT_TO_LANDMARK: Record<string, Mapping> = {
  // ── Office (lifecycle + pedimento prep) ──
  trafico_created: { landmarkId: 'rz_office', severity: 'at_rest', label: 'Tráfico creado' },
  initial_pedimento_data_captured: { landmarkId: 'rz_office', severity: 'inflight', label: 'Captura de pedimento' },
  pedimento_field_modified: { landmarkId: 'rz_office', severity: 'inflight', label: 'Edición de pedimento' },
  invoices_assigned: { landmarkId: 'rz_office', severity: 'inflight', label: 'Facturas asignadas' },
  classification_sheet_generated: { landmarkId: 'rz_office', severity: 'inflight', label: 'Hoja de clasificación' },
  pedimento_interface_generated: { landmarkId: 'rz_office', severity: 'awaiting', label: 'Interfaz generada' },

  // ── Documents ──
  documents_received: { landmarkId: 'rz_office', severity: 'inflight', label: 'Documentos recibidos' },
  documents_verified: { landmarkId: 'rz_office', severity: 'inflight', label: 'Documentos verificados' },
  document_missing_flagged: { landmarkId: 'rz_office', severity: 'awaiting', label: 'Documento faltante' },
  supplier_solicitation_sent: { landmarkId: 'rz_office', severity: 'awaiting', label: 'Solicitud enviada' },
  supplier_solicitation_received: { landmarkId: 'rz_office', severity: 'inflight', label: 'Respuesta del proveedor' },

  // ── Warehouse ──
  warehouse_entry_received: { landmarkId: 'rz_warehouse', severity: 'at_rest', label: 'Recepción en bodega' },
  load_order_created: { landmarkId: 'rz_warehouse', severity: 'inflight', label: 'Orden de carga creada' },
  load_order_issued: { landmarkId: 'rz_warehouse', severity: 'inflight', label: 'Orden de carga emitida' },
  load_order_processed_v2: { landmarkId: 'rz_warehouse', severity: 'inflight', label: 'Orden procesada' },
  load_order_post_processed: { landmarkId: 'rz_warehouse', severity: 'inflight', label: 'Post-procesamiento' },
  load_order_warehouse_exit: { landmarkId: 'mx_transfer_yard', severity: 'inflight', label: 'Salida de bodega' },

  // ── Payment (all routed to WTB; Tito may split by bank later) ──
  payment_notice_issued: { landmarkId: 'rz_office', severity: 'awaiting', label: 'Aviso de pago' },
  payment_banamex: { landmarkId: 'wtb', severity: 'inflight', label: 'Pago BANAMEX' },
  payment_bancomer: { landmarkId: 'wtb', severity: 'inflight', label: 'Pago BBVA' },
  payment_banjercito: { landmarkId: 'wtb', severity: 'inflight', label: 'Pago BANJERCITO' },
  payment_banorte: { landmarkId: 'wtb', severity: 'inflight', label: 'Pago BANORTE' },
  payment_bbva: { landmarkId: 'wtb', severity: 'inflight', label: 'Pago BBVA' },
  payment_citibank: { landmarkId: 'wtb', severity: 'inflight', label: 'Pago Citibank' },
  payment_hsbc: { landmarkId: 'wtb', severity: 'inflight', label: 'Pago HSBC' },
  payment_inverlat: { landmarkId: 'wtb', severity: 'inflight', label: 'Pago Inverlat' },
  payment_promex: { landmarkId: 'wtb', severity: 'inflight', label: 'Pago Promex' },
  payment_santander_serfin: { landmarkId: 'wtb', severity: 'inflight', label: 'Pago Santander' },
  payment_all_banks: { landmarkId: 'wtb', severity: 'inflight', label: 'Pago registrado' },

  // ── Inspection — semáforo at bridge ──
  semaforo_first_green: { landmarkId: 'wtb', severity: 'cleared', label: 'Semáforo verde' },
  semaforo_first_red: { landmarkId: 'wtb', severity: 'blocked', label: 'Semáforo rojo' },
  semaforo_second_green: { landmarkId: 'wtb', severity: 'cleared', label: 'Semáforo 2° verde' },
  semaforo_second_red: { landmarkId: 'wtb', severity: 'blocked', label: 'Semáforo 2° rojo' },
  recognition_first_without_incidents: { landmarkId: 'wtb', severity: 'cleared', label: 'Sin incidencias' },
  recognition_first_with_incidents: { landmarkId: 'wtb', severity: 'blocked', label: 'Con incidencias' },
  recognition_second_without_incidents: { landmarkId: 'wtb', severity: 'cleared', label: 'Sin incidencias 2°' },
  recognition_second_with_incidents: { landmarkId: 'wtb', severity: 'blocked', label: 'Con incidencias 2°' },

  // ── Clearance ──
  customs_clearance_notice_issued: { landmarkId: 'wtb', severity: 'inflight', label: 'Aviso de despacho' },
  merchandise_customs_cleared: { landmarkId: 'mx_transfer_yard', severity: 'cleared', label: 'Despachado' },
  digital_file_generated: { landmarkId: 'mx_transfer_yard', severity: 'cleared', label: 'Expediente digital' },

  // ── Exceptions ──
  embargo_initiated: { landmarkId: 'wtb', severity: 'blocked', label: 'Embargo iniciado' },
  rectification_filed: { landmarkId: 'rz_office', severity: 'awaiting', label: 'Rectificación' },
  investigation_opened: { landmarkId: 'wtb', severity: 'blocked', label: 'Investigación abierta' },
  investigation_closed: { landmarkId: 'wtb', severity: 'cleared', label: 'Investigación cerrada' },

  // ── Export ──
  aes_itn_received: { landmarkId: 'rz_office', severity: 'inflight', label: 'ITN AES' },
  aes_direct_filed: { landmarkId: 'rz_office', severity: 'inflight', label: 'AES Direct' },

  // ── VUCEM ──
  cove_requested: { landmarkId: 'rz_office', severity: 'inflight', label: 'COVE solicitado' },
  cove_received: { landmarkId: 'rz_office', severity: 'inflight', label: 'COVE recibido' },
  cove_u4_validated: { landmarkId: 'rz_office', severity: 'cleared', label: 'COVE validado' },
  vucem_file_generated: { landmarkId: 'rz_office', severity: 'inflight', label: 'VUCEM generado' },
  vucem_acknowledgment_received: { landmarkId: 'rz_office', severity: 'cleared', label: 'Acuse VUCEM' },

  // ── Communication ──
  documents_sent_to_client: { landmarkId: 'rz_office', severity: 'cleared', label: 'Enviado al cliente' },

  // ── Manual / operator actions ──
  operator_note_added: { landmarkId: 'rz_office', severity: 'at_rest', label: 'Nota agregada' },
  operator_assigned: { landmarkId: 'rz_office', severity: 'at_rest', label: 'Operador asignado' },
  operator_handoff: { landmarkId: 'rz_office', severity: 'at_rest', label: 'Handoff' },
  operator_escalation: { landmarkId: 'rz_office', severity: 'blocked', label: 'Escalación' },
}

// Fallback coordinates if landmarks map is missing rz_office (should never happen).
const RZ_OFFICE_FALLBACK_COORDS = { lat: 27.5078, lng: -99.5083 }

export function getCorridorPosition(
  event: WorkflowEventSlim | null,
  landmarks: Map<string, Landmark>
): CorridorPosition {
  const office = landmarks.get('rz_office')
  const fallbackLat = office?.lat ?? RZ_OFFICE_FALLBACK_COORDS.lat
  const fallbackLng = office?.lng ?? RZ_OFFICE_FALLBACK_COORDS.lng

  if (!event) {
    return {
      landmark_id: 'rz_office',
      lat: fallbackLat,
      lng: fallbackLng,
      state: 'sin_eventos',
      severity: 'at_rest',
      label: 'Sin eventos',
    }
  }

  const mapping = EVENT_TO_LANDMARK[event.event_type]
  if (!mapping) {
    return {
      landmark_id: 'rz_office',
      lat: fallbackLat,
      lng: fallbackLng,
      state: event.event_type,
      severity: 'at_rest',
      label: event.event_type,
    }
  }

  const landmark = landmarks.get(mapping.landmarkId)
  const lat = landmark?.lat ?? fallbackLat
  const lng = landmark?.lng ?? fallbackLng
  return {
    landmark_id: mapping.landmarkId,
    lat,
    lng,
    state: event.event_type,
    severity: mapping.severity,
    label: mapping.label,
  }
}
