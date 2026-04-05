/**
 * CRUZ 15-Event Shipment Timeline
 * More granular than Nuvo's 7 events. Every step tracked.
 */

export const SHIPMENT_EVENTS = [
  { step: 1,  key: 'orden_recibida',       label: 'Orden recibida',        icon: '📦', color: 'var(--info)' },
  { step: 2,  key: 'docs_solicitados',     label: 'Documentos solicitados', icon: '📄', color: 'var(--gold)' },
  { step: 3,  key: 'docs_recibidos',       label: 'Documentos recibidos',   icon: '📄', color: 'var(--success)' },
  { step: 4,  key: 'recoleccion',          label: 'Recolección programada', icon: '🏭', color: 'var(--info)' },
  { step: 5,  key: 'en_transito_us',       label: 'En tránsito (US)',       icon: '🚚', color: 'var(--info)' },
  { step: 6,  key: 'pedimento_transmitido',label: 'Pedimento transmitido',  icon: '📋', color: 'var(--gold)' },
  { step: 7,  key: 'pedimento_pagado',     label: 'Pedimento pagado',       icon: '💰', color: 'var(--success)' },
  { step: 8,  key: 'llegada_frontera',     label: 'Llegada a frontera',     icon: '🏢', color: 'var(--info)' },
  { step: 9,  key: 'reconocimiento',       label: 'Reconocimiento',         icon: '🔍', color: 'var(--warning-500)' },
  { step: 10, key: 'cruzando_puente',      label: 'Cruzando puente',        icon: '🌉', color: 'var(--gold)' },
  { step: 11, key: 'liberado_aduana',      label: 'Liberado en aduana MX',  icon: '✅', color: 'var(--success)' },
  { step: 12, key: 'en_transito_mx',       label: 'En tránsito (MX)',       icon: '🚚', color: 'var(--info)' },
  { step: 13, key: 'entregado',            label: 'Entregado',              icon: '📍', color: 'var(--success)' },
  { step: 14, key: 'factura_generada',     label: 'Factura generada',       icon: '🧾', color: 'var(--gold)' },
  { step: 15, key: 'pago_recibido',        label: 'Pago recibido',          icon: '💵', color: 'var(--success)' },
] as const

export type ShipmentEventKey = typeof SHIPMENT_EVENTS[number]['key']

/**
 * Derive which events are complete based on trafico data.
 * Returns step numbers that are confirmed complete.
 */
export function deriveCompletedSteps(trafico: {
  estatus?: string | null
  pedimento?: string | null
  fecha_llegada?: string | null
  fecha_cruce?: string | null
  fecha_pago?: string | null
}): number[] {
  const completed: number[] = []
  const status = (trafico.estatus || '').toLowerCase()

  // Step 1: always true if trafico exists
  completed.push(1)

  // Step 3: docs received if trafico has description (implies docs processed)
  if (trafico.fecha_llegada) completed.push(2, 3)

  // Step 6-7: pedimento
  if (trafico.pedimento) { completed.push(4, 5, 6); }
  if (trafico.fecha_pago || status.includes('pagado')) { completed.push(7) }

  // Step 8: llegada
  if (trafico.fecha_llegada) completed.push(8)

  // Step 10-11: crossing
  if (trafico.fecha_cruce || status.includes('cruz')) {
    completed.push(9, 10, 11)
  }

  // Step 13: delivered
  if (status.includes('entreg')) { completed.push(12, 13) }

  return [...new Set(completed)].sort((a, b) => a - b)
}

/**
 * Get the current step (first incomplete step).
 */
export function getCurrentStep(trafico: Parameters<typeof deriveCompletedSteps>[0]): number {
  const completed = deriveCompletedSteps(trafico)
  for (let i = 1; i <= 15; i++) {
    if (!completed.includes(i)) return i
  }
  return 15
}
