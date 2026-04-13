/**
 * Positive Notification Builders — CRUZ Good News System
 *
 * Pure functions that map detected positive events to notification payloads.
 * Used by: good-news-detector.js (cron), telegram-webhook (approval), UI components.
 *
 * Every notification starts with 🦀 — the CRUZ celebration mark.
 */

export type PositiveEventType =
  | 'expediente_complete'
  | 'crossing_clean'
  | 'doc_received_early'
  | 'approval_complete'
  | 'pattern_insight'
  | 'milestone_reached'

export type NotificationChannel = 'portal' | 'push' | 'telegram'

export interface PositiveNotification {
  type: PositiveEventType
  severity: 'celebration'
  title: string
  description: string
  channels: NotificationChannel[]
  action_url: string | null
  company_id: string
  meta: Record<string, unknown>
}

/** Expediente reached 100% document completeness */
export function buildExpedienteComplete(
  trafico: string,
  supplier: string,
  companyId: string
): PositiveNotification {
  return {
    type: 'expediente_complete',
    severity: 'celebration',
    title: `🦀 Expediente 100% completo`,
    description: `${supplier} subió todos los documentos para ${trafico}. Listo para despacho.`,
    channels: ['portal', 'telegram'],
    action_url: `/embarques`,
    company_id: companyId,
    meta: { trafico, supplier },
  }
}

/** Embarque crossed without reconocimiento (clean crossing) */
export function buildCrossingClean(
  trafico: string,
  timeSavedMinutes: number,
  companyId: string
): PositiveNotification {
  const hours = Math.round(timeSavedMinutes / 60 * 10) / 10
  const timeSaved = timeSavedMinutes >= 60
    ? `~${hours} hr${hours !== 1 ? 's' : ''}`
    : `~${timeSavedMinutes} min`

  return {
    type: 'crossing_clean',
    severity: 'celebration',
    title: `🦀 Cruce limpio`,
    description: `Tu embarque ${trafico} pasó sin reconocimiento. Ahorraste ${timeSaved} vs el promedio.`,
    channels: ['portal', 'push'],
    action_url: `/embarques`,
    company_id: companyId,
    meta: { trafico, timeSavedMinutes },
  }
}

/** Document received before the 48h escalation deadline */
export function buildDocReceivedEarly(
  trafico: string,
  docType: string,
  supplier: string,
  companyId: string
): PositiveNotification {
  return {
    type: 'doc_received_early',
    severity: 'celebration',
    title: `🦀 Documento recibido a tiempo`,
    description: `${supplier} envió ${docType} para ${trafico} antes del plazo.`,
    channels: ['portal'],
    action_url: `/documentos`,
    company_id: companyId,
    meta: { trafico, docType, supplier },
  }
}

/** Draft approved by Tito via Telegram */
export function buildApprovalComplete(
  trafico: string,
  supplier: string,
  companyId: string
): PositiveNotification {
  return {
    type: 'approval_complete',
    severity: 'celebration',
    title: `🦀 Borrador aprobado`,
    description: `Patente 3596 honrada. ${supplier} — ${trafico}.`,
    channels: ['portal'],
    action_url: `/drafts`,
    company_id: companyId,
    meta: { trafico, supplier },
  }
}

/** CRUZ detected a supplier or operational pattern */
export function buildPatternInsight(
  patternDescription: string,
  companyId: string
): PositiveNotification {
  return {
    type: 'pattern_insight',
    severity: 'celebration',
    title: `🦀 Patrón detectado`,
    description: patternDescription,
    channels: ['portal', 'telegram'],
    action_url: null,
    company_id: companyId,
    meta: { pattern: patternDescription },
  }
}

/** Monthly milestone: N embarques completed */
export function buildMilestoneReached(
  count: number,
  period: string,
  companyId: string
): PositiveNotification {
  return {
    type: 'milestone_reached',
    severity: 'celebration',
    title: `🦀 Hito alcanzado`,
    description: `${count} embarques completados en ${period}. ¡Bien hecho!`,
    channels: ['portal', 'push'],
    action_url: `/reportes`,
    company_id: companyId,
    meta: { count, period },
  }
}
