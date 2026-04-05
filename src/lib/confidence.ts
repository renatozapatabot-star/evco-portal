/**
 * CRUZ Shipment Confidence Score
 *
 * Replaces binary status labels ("En Proceso") with a 0-100 certainty
 * score that tells the client how predictable the outcome is.
 *
 * "En Proceso" means nothing. "92% certeza" means sleep well.
 */

export interface ConfidenceBreakdown {
  score: number
  level: 'alta' | 'encamino' | 'atencion' | 'accion'
  label: string
  color: string
  factors: { label: string; points: number; met: boolean }[]
}

export function calculateConfidence(trafico: Record<string, unknown>): ConfidenceBreakdown {
  const factors: { label: string; points: number; met: boolean }[] = []

  // 1. Has pedimento assigned? (+30)
  const hasPedimento = !!trafico.pedimento
  factors.push({ label: 'Pedimento transmitido', points: 30, met: hasPedimento })

  // 2. Documents complete? (+25) — proxy: has pedimento + not flagged
  const estatus = String(trafico.estatus || '').toLowerCase()
  const isComplete = estatus.includes('cruz') || estatus.includes('complet') || estatus.includes('pagado')
  const hasDocProxy = hasPedimento || isComplete
  factors.push({ label: 'Documentos completos', points: 25, met: hasDocProxy })

  // 3. Supplier compliance (+15) — proxy: has proveedores resolved (no PRV_)
  const proveedores = String(trafico.proveedores || '')
  const supplierResolved = !proveedores.includes('PRV_') && proveedores.length > 0
  factors.push({ label: 'Proveedor verificado', points: 15, met: supplierResolved })

  // 4. No anomalies (+10) — proxy: no score_reasons with high risk
  const scoreReasons = trafico.score_reasons ? String(trafico.score_reasons) : ''
  const noAnomalies = !scoreReasons.includes('"level":"critical"') && !scoreReasons.includes('"level":"elevated"')
  factors.push({ label: 'Sin anomalías', points: 10, met: noAnomalies })

  // 5. T-MEC on file (+10)
  const regimen = String(trafico.regimen || '').toUpperCase()
  const hasTmec = regimen === 'ITE' || regimen === 'ITR' || regimen === 'IMD'
  factors.push({ label: 'T-MEC aplicado', points: 10, met: hasTmec })

  // 6. Crossing within range (+10)
  const hasCrossed = estatus.includes('cruz')
  const fechaLlegada = trafico.fecha_llegada as string | null
  const daysActive = fechaLlegada ? Math.max(0, (Date.now() - new Date(fechaLlegada).getTime()) / 86400000) : 0
  const crossingNormal = hasCrossed || daysActive < 14
  factors.push({ label: 'Tiempo de cruce normal', points: 10, met: crossingNormal })

  const score = factors.reduce((s, f) => s + (f.met ? f.points : 0), 0)

  let level: ConfidenceBreakdown['level']
  let label: string
  let color: string

  if (score >= 90) { level = 'alta'; label = 'Alta certeza'; color = '#0D9488' }
  else if (score >= 70) { level = 'encamino'; label = 'En camino'; color = '#475569' }
  else if (score >= 50) { level = 'atencion'; label = 'Atención necesaria'; color = '#D97706' }
  else { level = 'accion'; label = 'Requiere acción'; color = '#DC2626' }

  return { score, level, label, color, factors }
}

/**
 * Calculate average confidence for an array of traficos
 */
export function averageConfidence(traficos: Record<string, unknown>[]): number {
  if (traficos.length === 0) return 0
  const total = traficos.reduce((s, t) => s + calculateConfidence(t).score, 0)
  return Math.round(total / traficos.length)
}
