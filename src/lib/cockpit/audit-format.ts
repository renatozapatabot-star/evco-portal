import type { TimelineItem } from '@/components/aguila'

export interface AuditRow {
  id: number | string
  table_name: string | null
  action: string | null
  record_id: string | null
  changed_at: string | null
  company_id: string | null
  changed_by?: string | null
}

const TABLE_LABELS: Record<string, string> = {
  traficos: 'Embarque',
  pedimentos: 'Pedimento',
  partidas: 'Partida',
  clientes: 'Cliente',
  invoices: 'Factura',
  drafts: 'Borrador',
  expediente_documentos: 'Documento',
  globalpc_productos: 'Producto',
  entradas: 'Entrada',
  audit_log: 'Evento',
  auth: 'Sesión',
  mve_alerts: 'Alerta MVE',
}

const ACTION_LABELS: Record<string, string> = {
  INSERT: 'creado',
  UPDATE: 'actualizado',
  DELETE: 'eliminado',
  login_success: 'Sesión iniciada',
  login_failed: 'Login fallido',
  password_changed: 'Contraseña cambiada',
  data_exported: 'Datos exportados',
  draft_approved: 'Borrador aprobado',
  draft_rejected: 'Borrador rechazado',
  document_uploaded: 'Documento cargado',
  ocr_classified: 'OCR clasificado',
  ai_asked: 'Consulta AI',
  email_sent: 'Email enviado',
  oca_requested: 'OCA solicitada',
  notification_sent: 'Notificación enviada',
  locale_updated: 'Idioma actualizado',
  telegram_event: 'Telegram',
  voice_call_made: 'Llamada de voz',
  compliance_escalated: 'Compliance escalado',
  mve_critical: 'MVE crítico',
  pedimento_rechazado: 'Pedimento rechazado',
}

function humanTitle(row: AuditRow): string {
  const action = row.action ?? ''
  // Prefer full action label when it's a named event.
  if (ACTION_LABELS[action]) {
    if (['INSERT', 'UPDATE', 'DELETE'].includes(action) && row.table_name) {
      const t = TABLE_LABELS[row.table_name] ?? row.table_name
      return `${t} ${ACTION_LABELS[action]}`
    }
    return ACTION_LABELS[action]
  }
  // Unknown → show raw, readable.
  const t = row.table_name ? (TABLE_LABELS[row.table_name] ?? row.table_name) : 'Evento'
  return `${t} · ${action.replace(/_/g, ' ')}`
}

function hrefFor(row: AuditRow): string | undefined {
  if (!row.record_id) return undefined
  switch (row.table_name) {
    case 'traficos':  return `/embarques/${encodeURIComponent(row.record_id)}`
    case 'pedimentos': return `/pedimentos?q=${encodeURIComponent(row.record_id)}`
    case 'expediente_documentos': return `/expedientes?doc=${encodeURIComponent(row.record_id)}`
    case 'entradas':  return `/entradas?q=${encodeURIComponent(row.record_id)}`
    default: return undefined
  }
}

/**
 * Canonical audit_log → TimelineItem converter. Used by all three cockpit
 * surfaces so every activity row reads the same way.
 */
export function auditRowToTimelineItem(row: AuditRow): TimelineItem {
  return {
    id: String(row.id),
    title: humanTitle(row),
    subtitle: row.record_id ?? undefined,
    timestamp: row.changed_at ?? new Date().toISOString(),
    href: hrefFor(row),
  }
}
