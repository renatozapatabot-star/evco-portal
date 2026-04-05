import type { Trafico } from '@/types/database'

// Cruz Score: proprietary 0-100 health metric per tráfico.
// Weights: docs 40% + time 25% + payment 20% + pedimento 10% + compliance 5% = 100%

interface ScoreInput {
  daysInProcess?: number
  hasPedimento?: boolean
  hasImporte?: boolean
  isCruzado?: boolean
  hasFechaPago?: boolean
  docCount?: number
}

export interface ScoreBreakdownItem {
  score: number  // 0-100 within this category
  weight: number // 0-1
  weighted: number // score * weight
  label: string
}

export interface ScoreResult {
  score: number
  reasons: string[]
  breakdown: {
    docs: ScoreBreakdownItem
    time: ScoreBreakdownItem
    payment: ScoreBreakdownItem
    pedimento: ScoreBreakdownItem
    compliance: ScoreBreakdownItem
  }
}

const W = { docs: 0.40, time: 0.25, payment: 0.20, pedimento: 0.10, compliance: 0.05 }

export function calculateCruzScore(input: ScoreInput): number {
  return calculateCruzScoreDetailed(input).score
}

export function calculateCruzScoreDetailed(input: ScoreInput): ScoreResult {
  const reasons: string[] = []

  // DOCUMENTS (40%)
  const docCount = input.docCount ?? (input.hasPedimento ? 6 : 0)
  const docPct = Math.min(docCount / 10, 1)
  const docScore = Math.round(docPct * 100)
  if (docScore < 100) reasons.push(`${docCount}/10 docs`)

  // TIMELINE (25%)
  let timeScore = 100
  if (input.isCruzado) {
    timeScore = 100
  } else if (input.daysInProcess != null) {
    if (input.daysInProcess > 90) { timeScore = 0; reasons.push(`${input.daysInProcess}d en proceso`) }
    else if (input.daysInProcess > 30) { timeScore = 15; reasons.push(`${input.daysInProcess}d en proceso`) }
    else if (input.daysInProcess > 14) { timeScore = 30; reasons.push(`${input.daysInProcess}d en proceso`) }
    else if (input.daysInProcess > 7) { timeScore = 55; reasons.push(`${input.daysInProcess}d en proceso`) }
    else if (input.daysInProcess > 3) { timeScore = 75 }
  }

  // PAYMENT (20%)
  let payScore = 100
  if (!input.hasFechaPago && input.hasPedimento) { payScore = 30; reasons.push('Sin pago') }
  else if (!input.hasFechaPago && !input.hasPedimento) { payScore = 50 }

  // PEDIMENTO (10%)
  let pedScore = input.hasPedimento ? 100 : 0
  if (!input.hasPedimento) reasons.push('Sin pedimento')

  // COMPLIANCE (5%)
  let compScore = 100
  if (!input.isCruzado && !input.hasPedimento && input.daysInProcess && input.daysInProcess > 5) {
    compScore = 20
  }

  const breakdown = {
    docs: { score: docScore, weight: W.docs, weighted: Math.round(docScore * W.docs), label: 'Documentos' },
    time: { score: timeScore, weight: W.time, weighted: Math.round(timeScore * W.time), label: 'Tiempo' },
    payment: { score: payScore, weight: W.payment, weighted: Math.round(payScore * W.payment), label: 'Pago' },
    pedimento: { score: pedScore, weight: W.pedimento, weighted: Math.round(pedScore * W.pedimento), label: 'Pedimento' },
    compliance: { score: compScore, weight: W.compliance, weighted: Math.round(compScore * W.compliance), label: 'Cumplimiento' },
  }

  const total = breakdown.docs.weighted + breakdown.time.weighted + breakdown.payment.weighted + breakdown.pedimento.weighted + breakdown.compliance.weighted

  return { score: Math.max(0, Math.min(100, total)), reasons, breakdown }
}

export function scoreColor(score: number): string {
  if (score >= 80) return 'var(--success)'
  if (score >= 50) return 'var(--warning)'
  return 'var(--danger)'
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Excelente'
  if (score >= 50) return 'Revisar'
  return 'Urgente'
}

export function scoreReason(t: Trafico & { score_reasons?: string; _docCount?: number }): string {
  if (t.score_reasons) return t.score_reasons
  const input = extractScoreInput(t)
  const { reasons } = calculateCruzScoreDetailed(input)
  return reasons.join(' · ') || ''
}

export function extractScoreInput(trafico: Trafico & { fecha_pago?: string | null; _docCount?: number }): ScoreInput {
  const now = Date.now()
  const llegada = trafico.fecha_llegada ? new Date(trafico.fecha_llegada).getTime() : now
  const daysInProcess = Math.max(0, Math.floor((now - llegada) / 86400000))
  const isCruzado = (trafico.estatus || '').toLowerCase().includes('cruz')

  return {
    daysInProcess,
    hasPedimento: !!trafico.pedimento,
    hasImporte: trafico.importe_total != null && Number(trafico.importe_total) > 0,
    isCruzado,
    hasFechaPago: !!trafico.fecha_pago,
    docCount: trafico._docCount,
  }
}

export function statusWithDuration(estatus: string, fecha: string | null): string {
  if (!fecha || (estatus || '').toLowerCase().includes('cruz')) return estatus || 'En Proceso'
  const days = Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000)
  if (days <= 1) return estatus || 'En Proceso'
  return `${estatus || 'En Proceso'} · ${days}d`
}

export function statusDays(fecha: string | null): number {
  if (!fecha) return 0
  return Math.max(0, Math.floor((Date.now() - new Date(fecha).getTime()) / 86400000))
}

// T-MEC tariff rate by fracción prefix
export function getTariffRate(fraccion: string): number {
  if (!fraccion) return 0.05
  const p = fraccion.substring(0, 2)
  if (p === '39') return 0.05 // Plastics
  if (p === '84') return 0.03 // Machinery
  if (p === '40') return 0.07 // Rubber
  if (p === '85') return 0.04 // Electrical
  if (p === '73') return 0.05 // Steel articles
  if (p === '90') return 0.03 // Instruments
  return 0.05
}
