/**
 * Expediente status helpers — semantic labeling for the /expedientes
 * list. The list previously showed only a "0 / 6" numeric ratio, which
 * required mental decoding ("which of the six is missing?"). This
 * helper produces a single user-readable status that names the most
 * important missing piece.
 *
 * Used by /expedientes/page.tsx. Exported as its own module so the
 * mapping is unit-testable + can drift from rendering concerns.
 */

export type ExpedienteStatusTone = 'green' | 'amber' | 'silver'

export interface ExpedienteStatus {
  label: string
  tone: ExpedienteStatusTone
}

/**
 * Map the first-missing required doc to a semantic, client-facing
 * status label.
 *
 * Ordering matches the broker's prep cadence: pedimento existence
 * gates everything else, then factura, then CFDI evidence (cove
 * acknowledgment), then physical evidence (packing/doda). Returns
 * "Completo" only when nothing is missing AND a pedimento is present.
 */
export function expedienteStatusLabel(
  missing: readonly string[],
  hasPedimento: boolean,
): ExpedienteStatus {
  if (!hasPedimento) return { label: 'Sin pedimento', tone: 'silver' }
  if (missing.includes('factura_comercial')) return { label: 'Falta factura', tone: 'amber' }
  if (missing.includes('cove') || missing.includes('acuse_cove')) {
    return { label: 'Falta CFDI', tone: 'amber' }
  }
  if (missing.includes('packing_list') || missing.includes('doda') ||
      missing.includes('pedimento_detallado')) {
    return { label: 'Falta evidencia', tone: 'amber' }
  }
  return { label: 'Completo', tone: 'green' }
}
