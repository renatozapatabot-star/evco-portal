/**
 * CRUZ T-MEC Savings Calculator
 *
 * For each embarque with preferential regime (ITE/ITR/IMD),
 * calculates what IGI would have been at the general rate
 * vs what was actually paid (zero or reduced).
 *
 * This is the single most powerful retention tool.
 * "$127,000 saved this year" = never switch brokers.
 */

interface TraficoForSavings {
  trafico: string
  importe_total?: number | null
  regimen?: string | null
  proveedores?: string | null
  descripcion_mercancia?: string | null
  fecha_llegada?: string | null
  pais_procedencia?: string | null
  [k: string]: unknown
}

export interface SavingsResult {
  totalSavings: number
  tmecOperations: number
  totalOperations: number
  utilizationRate: number
  byMonth: { month: string; savings: number; ops: number }[]
  bySupplier: { name: string; savings: number; ops: number }[]
  byProduct: { desc: string; savings: number; ops: number }[]
  missedOpportunities: { trafico: string; potentialSavings: number; desc: string }[]
}

const DEFAULT_IGI_RATE = 0.05 // 5% — conservative estimate for general IGI rate
const TMEC_REGIMES = new Set(['ITE', 'ITR', 'IMD'])
const TMEC_COUNTRIES = new Set(['US', 'USA', 'CA', 'CAN', 'ESTADOS UNIDOS', 'CANADA'])

export function calculateTmecSavings(traficos: TraficoForSavings[], igiRate = DEFAULT_IGI_RATE): SavingsResult {
  let totalSavings = 0
  let tmecOps = 0
  const monthMap = new Map<string, { savings: number; ops: number }>()
  const supplierMap = new Map<string, { savings: number; ops: number }>()
  const productMap = new Map<string, { savings: number; ops: number }>()
  const missed: SavingsResult['missedOpportunities'] = []

  for (const t of traficos) {
    const regimen = (t.regimen || '').toUpperCase()
    const value = Number(t.importe_total) || 0
    if (value <= 0) continue

    const isTmec = TMEC_REGIMES.has(regimen)
    const month = (t.fecha_llegada || '').substring(0, 7)
    const supplier = (t.proveedores || '').split(',')[0]?.trim() || 'Desconocido'
    const product = (t.descripcion_mercancia || '').substring(0, 40) || 'Sin descripción'
    const country = (t.pais_procedencia || '').toUpperCase()

    if (isTmec) {
      // T-MEC applied: savings = what IGI would have been
      const savings = Math.round(value * igiRate * 100) / 100
      totalSavings += savings
      tmecOps++

      // By month
      const m = monthMap.get(month) || { savings: 0, ops: 0 }
      m.savings += savings; m.ops++
      monthMap.set(month, m)

      // By supplier
      const s = supplierMap.get(supplier) || { savings: 0, ops: 0 }
      s.savings += savings; s.ops++
      supplierMap.set(supplier, s)

      // By product
      const p = productMap.get(product) || { savings: 0, ops: 0 }
      p.savings += savings; p.ops++
      productMap.set(product, p)
    } else if (TMEC_COUNTRIES.has(country)) {
      // From US/CA but NOT using T-MEC — missed opportunity
      missed.push({
        trafico: t.trafico,
        potentialSavings: Math.round(value * igiRate * 100) / 100,
        desc: product,
      })
    }
  }

  return {
    totalSavings: Math.round(totalSavings),
    tmecOperations: tmecOps,
    totalOperations: traficos.filter(t => (Number(t.importe_total) || 0) > 0).length,
    utilizationRate: traficos.length > 0 ? Math.round((tmecOps / traficos.length) * 100) : 0,
    byMonth: [...monthMap.entries()]
      .map(([month, d]) => ({ month, savings: Math.round(d.savings), ops: d.ops }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    bySupplier: [...supplierMap.entries()]
      .map(([name, d]) => ({ name, savings: Math.round(d.savings), ops: d.ops }))
      .sort((a, b) => b.savings - a.savings)
      .slice(0, 10),
    byProduct: [...productMap.entries()]
      .map(([desc, d]) => ({ desc, savings: Math.round(d.savings), ops: d.ops }))
      .sort((a, b) => b.savings - a.savings)
      .slice(0, 10),
    missedOpportunities: missed
      .sort((a, b) => b.potentialSavings - a.potentialSavings)
      .slice(0, 10),
  }
}
