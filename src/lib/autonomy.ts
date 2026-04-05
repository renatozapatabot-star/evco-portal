/**
 * CRUZ Graduated Autonomy Engine
 *
 * Each action type has its own autonomy level that promotes/demotes
 * based on accuracy over time. CRUZ proposes. Humans authorize.
 * This boundary moves — but never disappears.
 */

export enum AutonomyLevel {
  MANUAL = 0,       // CRUZ does nothing without Tito
  SUGGEST = 1,      // CRUZ suggests, Tito approves
  ACT_NOTIFY = 2,   // CRUZ acts, notifies Tito after
  AUTONOMOUS = 3,   // CRUZ acts silently, daily report only
}

export const AUTONOMY_LABELS: Record<AutonomyLevel, string> = {
  [AutonomyLevel.MANUAL]: 'Manual — requiere aprobación',
  [AutonomyLevel.SUGGEST]: 'Sugerencia — propone, Tito aprueba',
  [AutonomyLevel.ACT_NOTIFY]: 'Actúa y notifica — Tito revisa después',
  [AutonomyLevel.AUTONOMOUS]: 'Autónomo — reporte diario solamente',
}

export const ACTION_TYPES = [
  'document_solicitation',
  'classification',
  'status_update',
  'email_response',
  'pedimento_filing',
] as const

export type ActionType = typeof ACTION_TYPES[number]

/** Default starting levels */
export const DEFAULT_LEVELS: Record<ActionType, AutonomyLevel> = {
  document_solicitation: AutonomyLevel.SUGGEST,
  classification: AutonomyLevel.MANUAL,
  status_update: AutonomyLevel.MANUAL,
  email_response: AutonomyLevel.MANUAL,
  pedimento_filing: AutonomyLevel.MANUAL, // ALWAYS MANUAL — no GlobalPC write API
}

/** Promotion thresholds */
export const PROMOTION_RULES = {
  MANUAL_TO_SUGGEST: { minPrecedents: 50 },
  SUGGEST_TO_ACT_NOTIFY: { minAccuracy: 0.95, consecutiveDays: 30 },
  ACT_NOTIFY_TO_AUTONOMOUS: { minAccuracy: 0.99, consecutiveDays: 60 },
}

/** Demotion: 2 errors in 7 days → drop one level */
export const DEMOTION_RULE = { maxErrors: 2, windowDays: 7 }

/** Actions that NEVER go above MANUAL regardless of accuracy */
export const ALWAYS_MANUAL_CONDITIONS = [
  'value_2x_average',        // Tráfico value > 2x historical average
  'new_supplier',            // Supplier with < 5 shipments
  'high_compliance_risk',    // Compliance risk > 50%
  'recent_regulatory_change', // Regulatory change in last 7 days
] as const

/**
 * Check if a specific tráfico should be forced to MANUAL
 * regardless of the action type's autonomy level.
 */
export function shouldForceManual(trafico: Record<string, unknown>, avgValue: number): {
  forced: boolean
  reasons: string[]
} {
  const reasons: string[] = []

  // Value outlier
  const value = Number(trafico.importe_total) || 0
  if (avgValue > 0 && value > avgValue * 2) {
    reasons.push(`Valor ${Math.round(value / avgValue)}x sobre promedio`)
  }

  // New supplier
  const proveedores = String(trafico.proveedores || '')
  if (proveedores.includes('PRV_') || !proveedores.trim()) {
    reasons.push('Proveedor sin historial')
  }

  // Compliance risk
  const scoreReasons = trafico.score_reasons ? JSON.parse(String(trafico.score_reasons)) : null
  if (scoreReasons?.score > 50) {
    reasons.push(`Riesgo compliance ${scoreReasons.score}/100`)
  }

  return { forced: reasons.length > 0, reasons }
}

/**
 * Determine effective autonomy level for an action on a specific tráfico
 */
export function getEffectiveLevel(
  actionType: ActionType,
  configuredLevel: AutonomyLevel,
  trafico: Record<string, unknown> | null,
  avgValue: number
): { level: AutonomyLevel; overridden: boolean; reasons: string[] } {
  // pedimento_filing is ALWAYS manual
  if (actionType === 'pedimento_filing') {
    return { level: AutonomyLevel.MANUAL, overridden: configuredLevel > 0, reasons: ['Sin API de escritura GlobalPC'] }
  }

  // Check force-manual conditions
  if (trafico) {
    const { forced, reasons } = shouldForceManual(trafico, avgValue)
    if (forced && configuredLevel > AutonomyLevel.MANUAL) {
      return { level: AutonomyLevel.MANUAL, overridden: true, reasons }
    }
  }

  return { level: configuredLevel, overridden: false, reasons: [] }
}
