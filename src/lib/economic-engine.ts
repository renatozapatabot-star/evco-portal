/**
 * CRUZ Economic Engine
 *
 * Understands the money in every operation.
 * Landed cost, T-MEC savings, value created — all from
 * real data in aduanet_facturas + traficos.
 *
 * Client-facing: "Total landed: $50,690 — sin T-MEC habría sido $54,230"
 * Internal: per-client profitability + aggregate economics
 */

import { fmtUSDCompact } from '@/lib/format-utils'

// ── Types ──

export interface LandedCost {
  merchandise_usd: number
  dta_mxn: number
  igi_mxn: number
  iva_mxn: number
  ieps_mxn: number
  total_duties_mxn: number
  total_duties_usd: number
  total_landed_usd: number
  effective_tax_rate: number  // %
  per_kg_usd: number | null
}

export interface ValueCreated {
  tmec_savings_usd: number
  speed_premium_usd: number
  compliance_value_usd: number
  total_value_usd: number
}

export interface TraficoEconomics {
  trafico: string
  landed: LandedCost
  value: ValueCreated
  summary: string
}

export interface ClientEconomics {
  totalImported: number
  totalDuties: number
  totalTmecSavings: number
  effectiveTaxRate: number
  avgLandedCostPerShipment: number
  valueCreatedTotal: number
  shipmentCount: number
  summary: string
}

interface FacturaInput {
  valor_usd?: number | null
  dta?: number | null
  igi?: number | null
  iva?: number | null
  ieps?: number | null
  tipo_cambio?: number | null
  [k: string]: unknown
}

interface TraficoInput {
  trafico?: string
  peso_bruto?: number | null
  regimen?: string | null
  pedimento?: string | null
  score_reasons?: string | null
  fecha_llegada?: string | null
  fecha_cruce?: string | null
  importe_total?: number | null
  [k: string]: unknown
}

// ── Constants ──

const DEFAULT_TC = 17.5
const DEFAULT_IGI_RATE = 0.05        // 5% general rate
const HOLDING_COST_PER_DAY = 200     // USD estimated daily cost of goods in transit
const MVE_PENALTY_AVOIDANCE = 500    // USD estimated value of compliance

// ── Landed Cost ──

export function calculateLandedCost(factura: FacturaInput, trafico: TraficoInput): LandedCost {
  const merchandiseUsd = Number(factura.valor_usd) || Number(trafico.importe_total) || 0
  const tc = Number(factura.tipo_cambio) || DEFAULT_TC
  const dtaMxn = Number(factura.dta) || 0
  const igiMxn = Number(factura.igi) || 0
  const ivaMxn = Number(factura.iva) || 0
  const iepsMxn = Number(factura.ieps) || 0

  const totalDutiesMxn = dtaMxn + igiMxn + ivaMxn + iepsMxn
  const totalDutiesUsd = tc > 0 ? Math.round(totalDutiesMxn / tc * 100) / 100 : 0
  const totalLandedUsd = merchandiseUsd + totalDutiesUsd

  const effectiveTaxRate = merchandiseUsd > 0
    ? Math.round(totalDutiesUsd / merchandiseUsd * 1000) / 10
    : 0

  const peso = Number(trafico.peso_bruto) || 0
  const perKgUsd = peso > 0 ? Math.round(totalLandedUsd / peso * 100) / 100 : null

  return {
    merchandise_usd: merchandiseUsd,
    dta_mxn: dtaMxn,
    igi_mxn: igiMxn,
    iva_mxn: ivaMxn,
    ieps_mxn: iepsMxn,
    total_duties_mxn: totalDutiesMxn,
    total_duties_usd: totalDutiesUsd,
    total_landed_usd: totalLandedUsd,
    effective_tax_rate: effectiveTaxRate,
    per_kg_usd: perKgUsd,
  }
}

// ── Value Created ──

export function calculateValueCreated(
  factura: FacturaInput,
  trafico: TraficoInput,
  avgClearanceDays: number,
): ValueCreated {
  const tc = Number(factura.tipo_cambio) || DEFAULT_TC
  const merchandiseUsd = Number(factura.valor_usd) || Number(trafico.importe_total) || 0
  const regimen = (trafico.regimen || '').toUpperCase()
  const isTmec = regimen === 'ITE' || regimen === 'ITR' || regimen === 'IMD'

  // T-MEC savings: what IGI would have been without the treaty
  let tmecSavingsUsd = 0
  if (isTmec && (Number(factura.igi) || 0) === 0 && merchandiseUsd > 0) {
    tmecSavingsUsd = Math.round(merchandiseUsd * DEFAULT_IGI_RATE * 100) / 100
  }

  // Speed premium: value of faster clearance
  let speedPremiumUsd = 0
  if (trafico.fecha_llegada && trafico.fecha_cruce) {
    const actualDays = (new Date(trafico.fecha_cruce).getTime() - new Date(trafico.fecha_llegada).getTime()) / 86400000
    if (actualDays >= 0 && actualDays < avgClearanceDays) {
      const daysSaved = avgClearanceDays - actualDays
      speedPremiumUsd = Math.round(daysSaved * HOLDING_COST_PER_DAY * 100) / 100
    }
  }

  // Compliance value: penalty avoidance estimate
  let complianceValueUsd = 0
  const hasAnomalies = trafico.score_reasons
    ? String(trafico.score_reasons).includes('"level":"critical"')
    : false
  if (trafico.pedimento && !hasAnomalies) {
    complianceValueUsd = MVE_PENALTY_AVOIDANCE
  }

  return {
    tmec_savings_usd: tmecSavingsUsd,
    speed_premium_usd: speedPremiumUsd,
    compliance_value_usd: complianceValueUsd,
    total_value_usd: tmecSavingsUsd + speedPremiumUsd + complianceValueUsd,
  }
}

// ── Narrative ──

export function buildEconomicSummary(landed: LandedCost, value: ValueCreated): string {
  const parts: string[] = []

  parts.push(`Costo total de importación: ${fmtUSDCompact(landed.total_landed_usd)}`)
  parts.push(`Mercancía: ${fmtUSDCompact(landed.merchandise_usd)}`)
  parts.push(`Aranceles: ${fmtUSDCompact(landed.total_duties_usd)} (${landed.effective_tax_rate}%)`)

  if (value.tmec_savings_usd > 0) {
    const withoutTmec = landed.total_landed_usd + value.tmec_savings_usd
    parts.push(`Sin T-MEC habría sido ${fmtUSDCompact(withoutTmec)} — ahorro: ${fmtUSDCompact(value.tmec_savings_usd)}`)
  }

  if (landed.per_kg_usd !== null) {
    parts.push(`Costo por kg: $${landed.per_kg_usd.toFixed(2)} USD`)
  }

  return parts.join('. ') + '.'
}

// ── Aggregate ──

export function aggregateClientEconomics(
  facturas: FacturaInput[],
  traficos: TraficoInput[],
  avgClearanceDays = 5,
): ClientEconomics {
  let totalImported = 0
  let totalDuties = 0
  let totalTmecSavings = 0
  let totalValue = 0
  let count = 0

  // Match facturas to traficos by pedimento
  const traficoMap = new Map<string, TraficoInput>()
  for (const t of traficos) {
    if (t.pedimento) traficoMap.set(t.pedimento, t)
    if (t.trafico) traficoMap.set(t.trafico, t)
  }

  for (const f of facturas) {
    const trafico = (f.pedimento ? traficoMap.get(String(f.pedimento)) : null) || {}
    const landed = calculateLandedCost(f, trafico)
    const value = calculateValueCreated(f, trafico, avgClearanceDays)

    totalImported += landed.merchandise_usd
    totalDuties += landed.total_duties_usd
    totalTmecSavings += value.tmec_savings_usd
    totalValue += value.total_value_usd
    count++
  }

  const effectiveTaxRate = totalImported > 0
    ? Math.round(totalDuties / totalImported * 1000) / 10
    : 0

  const avgLanded = count > 0 ? Math.round(totalImported / count) : 0

  const summaryParts: string[] = [
    `${fmtUSDCompact(totalImported)} importado en ${count} operaciones`,
    `Aranceles pagados: ${fmtUSDCompact(totalDuties)} (tasa efectiva: ${effectiveTaxRate}%)`,
  ]
  if (totalTmecSavings > 0) {
    summaryParts.push(`Ahorro T-MEC: ${fmtUSDCompact(totalTmecSavings)}`)
  }
  if (totalValue > 0) {
    summaryParts.push(`Valor total generado: ${fmtUSDCompact(totalValue)}`)
  }

  return {
    totalImported,
    totalDuties,
    totalTmecSavings,
    effectiveTaxRate,
    avgLandedCostPerShipment: avgLanded,
    valueCreatedTotal: totalValue,
    shipmentCount: count,
    summary: summaryParts.join('. ') + '.',
  }
}
