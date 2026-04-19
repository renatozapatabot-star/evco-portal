/**
 * CRUZ Supply Chain Orchestration — Portal Types + Display
 *
 * Processing doesn't happen when the shipment arrives.
 * Processing happened before it arrived.
 */

export interface OrchestrationStatus {
  predicted_crossing: string | null
  docs_ready: number
  docs_needed: number
  missing_docs: string[]
  zero_touch_score: number
  optimal_bridge: string | null
  optimal_time: string | null
  estimated_duties_mxn: number
  pre_staged_at: string | null
  actions_taken: string[]
}

export function parseOrchestration(raw: unknown): OrchestrationStatus | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  return {
    predicted_crossing: (o.predicted_crossing as string) || null,
    docs_ready: Number(o.docs_ready) || 0,
    docs_needed: Number(o.docs_needed) || 0,
    missing_docs: Array.isArray(o.missing_docs) ? o.missing_docs as string[] : [],
    zero_touch_score: Number(o.zero_touch_score) || 0,
    optimal_bridge: (o.optimal_bridge as string) || null,
    optimal_time: (o.optimal_time as string) || null,
    estimated_duties_mxn: Number(o.estimated_duties_mxn) || 0,
    pre_staged_at: (o.pre_staged_at as string) || null,
    actions_taken: Array.isArray(o.actions_taken) ? o.actions_taken as string[] : [],
  }
}

export function getOrchestrationLabel(status: OrchestrationStatus): string {
  const { zero_touch_score, missing_docs, optimal_bridge, optimal_time, predicted_crossing, docs_ready, docs_needed } = status

  // Zero-touch ready
  if (zero_touch_score >= 90 && missing_docs.length === 0) {
    const bridge = optimal_bridge ? ` vía ${optimal_bridge}` : ''
    const time = optimal_time ? ` ${optimal_time}` : ''
    const crossing = predicted_crossing
      ? ` — cruce estimado ${new Date(predicted_crossing).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', timeZone: 'America/Chicago' })}`
      : ''
    return `Pre-staged ✅${crossing}${bridge}${time}`
  }

  // Docs incomplete
  if (missing_docs.length > 0) {
    return `Pendiente: falta ${missing_docs.join(', ')} (${docs_ready}/${docs_needed})`
  }

  // Partially staged
  if (status.pre_staged_at) {
    return `Pre-procesado · ${docs_ready}/${docs_needed} docs · Score: ${zero_touch_score}`
  }

  return 'Sin orquestación'
}

export function getOrchestrationColor(status: OrchestrationStatus): string {
  if (status.zero_touch_score >= 90 && status.missing_docs.length === 0) return 'var(--portal-status-green-fg)' // green
  if (status.missing_docs.length > 0) return 'var(--portal-status-amber-fg)' // amber
  if (status.pre_staged_at) return '#0D9488' // teal
  return '#9B9B9B' // gray
}
