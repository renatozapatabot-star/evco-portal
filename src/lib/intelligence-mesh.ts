/**
 * ADUANA Intelligence Mesh — Multi-Source Risk Correlator
 *
 * Combines 7 data dimensions into a single risk assessment.
 * "What's the risk for this shipment?" answered in 2 seconds
 * by correlating bridge times, supplier history, currency,
 * documents, compliance, historical patterns, and timing.
 *
 * No new external APIs — aggregates what's already collected.
 * The correlation between sources is more valuable than any single source.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ──

export interface MeshAssessment {
  riskScore: number
  riskLevel: 'minimal' | 'low' | 'moderate' | 'elevated' | 'critical'
  dimensions: MeshDimension[]
  recommendation: string
  correlations: string[]
}

export interface MeshDimension {
  source: string
  score: number    // 0-100 (0=safe, 100=risky)
  signal: string
  data: Record<string, unknown>
}

interface TraficoInput {
  trafico?: string
  company_id?: string | null
  proveedores?: string | null
  descripcion_mercancia?: string | null
  importe_total?: number | null
  pedimento?: string | null
  regimen?: string | null
  transportista_mexicano?: string | null
  score_reasons?: string | null
  fecha_llegada?: string | null
  [k: string]: unknown
}

interface HypotheticalInput {
  value_usd?: number
  product?: string
  supplier?: string
  crossing_day?: string
}

// ── Dimension scorers ──

async function scoreBridge(supabase: SupabaseClient): Promise<MeshDimension> {
  const { data } = await supabase
    .from('bridge_intelligence')
    .select('bridge_name, commercial_wait_minutes, status')
    .order('fetched_at', { ascending: false })
    .limit(4)

  const bridges = data || []
  const best = bridges.reduce((min, b) => {
    const wait = b.commercial_wait_minutes ?? 999
    return wait < (min.commercial_wait_minutes ?? 999) ? b : min
  }, bridges[0] || { bridge_name: 'World Trade', commercial_wait_minutes: null, status: 'unknown' })

  const wait = best?.commercial_wait_minutes ?? 60
  const score = wait > 120 ? 80 : wait > 60 ? 50 : wait > 30 ? 20 : 5

  return {
    source: 'bridge',
    score,
    signal: best ? `${best.bridge_name}: ${wait} min (${best.status || 'unknown'})` : 'Sin datos de puentes',
    data: { bridges: bridges.map(b => ({ name: b.bridge_name, wait: b.commercial_wait_minutes, status: b.status })) },
  }
}

async function scoreSupplier(supplier: string, companyId: string, supabase: SupabaseClient): Promise<MeshDimension> {
  if (!supplier) return { source: 'supplier', score: 50, signal: 'Proveedor desconocido', data: {} }

  const { data, count } = await supabase
    .from('traficos')
    .select('trafico, estatus, pedimento', { count: 'exact' })
    .eq('company_id', companyId)
    .ilike('proveedores', `%${supplier.substring(0, 20)}%`)
    .gte('fecha_llegada', '2024-01-01')
    .limit(100)

  const total = count || 0
  if (total < 3) return { source: 'supplier', score: 60, signal: `${supplier}: proveedor nuevo (${total} operaciones)`, data: { total } }

  const withPedimento = (data || []).filter(t => !!t.pedimento).length
  const compliance = total > 0 ? Math.round((withPedimento / total) * 100) : 0
  const score = compliance >= 95 ? 5 : compliance >= 80 ? 20 : compliance >= 60 ? 40 : 70

  return {
    source: 'supplier',
    score,
    signal: `${supplier}: ${compliance}% cumplimiento (${total} operaciones)`,
    data: { total, compliance },
  }
}

async function scoreCurrency(supabase: SupabaseClient): Promise<MeshDimension> {
  const { data } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'banxico_exchange_rate')
    .single()

  const rate = data?.value?.rate || data?.value?.tc || 17.5
  // Stable if between 16-19, volatile outside
  const score = rate > 20 ? 60 : rate > 19 ? 40 : rate < 15 ? 40 : 5

  return {
    source: 'currency',
    score,
    signal: `MXN/USD: ${Number(rate).toFixed(2)} (${score <= 10 ? 'estable' : 'volátil'})`,
    data: { rate },
  }
}

async function scoreDocuments(traficoId: string, supabase: SupabaseClient): Promise<MeshDimension> {
  if (!traficoId) return { source: 'documents', score: 50, signal: 'Sin embarque para verificar', data: {} }

  const { data } = await supabase
    .from('expediente_documentos')
    .select('doc_type')
    .eq('pedimento_id', traficoId)
    .limit(20)

  const required = ['FACTURA', 'COVE', 'PEDIMENTO']
  const existing = new Set((data || []).map(d => (d.doc_type || '').toUpperCase()))
  const ready = required.filter(d => existing.has(d)).length
  const missing = required.filter(d => !existing.has(d))
  const score = missing.length === 0 ? 0 : missing.length === 1 ? 30 : 60

  return {
    source: 'documents',
    score,
    signal: missing.length === 0
      ? `${ready}/${required.length} documentos completos`
      : `Falta: ${missing.join(', ')} (${ready}/${required.length})`,
    data: { ready, total: required.length, missing },
  }
}

function scoreCompliance(scoreReasons: string | null): MeshDimension {
  if (!scoreReasons) return { source: 'compliance', score: 10, signal: 'Sin señales de riesgo', data: {} }

  const hasCritical = scoreReasons.includes('"level":"critical"')
  const hasElevated = scoreReasons.includes('"level":"elevated"')
  const score = hasCritical ? 80 : hasElevated ? 50 : 10

  return {
    source: 'compliance',
    score,
    signal: hasCritical ? 'Anomalías críticas detectadas' : hasElevated ? 'Señales de atención' : 'Sin anomalías',
    data: { hasCritical, hasElevated },
  }
}

async function scoreHistorical(desc: string, companyId: string, supabase: SupabaseClient): Promise<MeshDimension> {
  if (!desc) return { source: 'historical', score: 30, signal: 'Sin datos históricos comparables', data: {} }

  const keyword = desc.split(/[\s,]/)[0]?.substring(0, 15) || ''
  const { data, count } = await supabase
    .from('traficos')
    .select('estatus, fecha_cruce', { count: 'exact' })
    .eq('company_id', companyId)
    .ilike('descripcion_mercancia', `%${keyword}%`)
    .not('fecha_cruce', 'is', null)
    .gte('fecha_llegada', '2024-01-01')
    .limit(100)

  const total = count || 0
  if (total < 5) return { source: 'historical', score: 40, signal: `${total} operaciones similares (insuficiente)`, data: { total } }

  const crossed = (data || []).filter(t => (t.estatus || '').toLowerCase().includes('cruz')).length
  const successRate = Math.round((crossed / total) * 100)
  const score = successRate >= 95 ? 5 : successRate >= 80 ? 20 : 50

  return {
    source: 'historical',
    score,
    signal: `${total} similares: ${successRate}% despachados`,
    data: { total, successRate },
  }
}

function scoreTemporal(): MeshDimension {
  const now = new Date()
  const hour = now.getHours()
  const dow = now.getDay() // 0=Sun

  // Optimal: weekday 6-8 AM. Risky: Friday afternoon, weekend
  let score = 10
  let signal = 'Ventana de cruce normal'

  if (dow === 0) { score = 50; signal = 'Domingo — operaciones limitadas' }
  else if (dow === 6) { score = 30; signal = 'Sábado — volumen reducido' }
  else if (dow === 5 && hour >= 14) { score = 40; signal = 'Viernes tarde — congestión típica' }
  else if (hour >= 6 && hour <= 8) { score = 5; signal = 'Ventana óptima (6-8 AM)' }
  else if (hour >= 14 && hour <= 18) { score = 25; signal = 'Tarde — espera moderada' }

  // Month-end
  const dayOfMonth = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  if (dayOfMonth >= daysInMonth - 2) {
    score = Math.max(score, 35)
    signal += ' · Cierre de mes (mayor volumen)'
  }

  return { source: 'temporal', score, signal, data: { hour, dow, dayOfMonth } }
}

// ── Cross-dimensional correlations ──

function findCorrelations(dimensions: MeshDimension[], trafico: TraficoInput): string[] {
  const correlations: string[] = []
  const currencyScore = dimensions.find(d => d.source === 'currency')?.score ?? 0
  const supplierScore = dimensions.find(d => d.source === 'supplier')?.score ?? 0
  const temporalScore = dimensions.find(d => d.source === 'temporal')?.score ?? 0
  const value = Number(trafico.importe_total) || 0

  // Currency weak + month-end + high value → elevated scrutiny
  if (currencyScore > 30 && temporalScore > 30 && value > 100000) {
    correlations.push('Moneda volátil + cierre de mes + alto valor → mayor probabilidad de revisión')
  }

  // New supplier + high value + no T-MEC
  const regimen = (trafico.regimen || '').toUpperCase()
  const isTmec = regimen === 'ITE' || regimen === 'ITR' || regimen === 'IMD'
  if (supplierScore > 40 && value > 50000 && !isTmec) {
    correlations.push('Proveedor nuevo/riesgoso + alto valor + sin T-MEC → atención SAT probable')
  }

  // All clear
  if (dimensions.every(d => d.score < 20)) {
    correlations.push('Todas las dimensiones en verde — operación de bajo riesgo')
  }

  return correlations
}

// ── Main assessment function ──

export async function assessRisk(
  trafico: TraficoInput,
  supabase: SupabaseClient,
  hypothetical?: HypotheticalInput,
): Promise<MeshAssessment> {
  const supplier = hypothetical?.supplier || (trafico.proveedores || '').split(',')[0]?.trim() || ''
  const companyId = trafico.company_id || ''
  const desc = hypothetical?.product || trafico.descripcion_mercancia || ''
  const traficoId = trafico.trafico || ''

  // Score all 7 dimensions in parallel
  const [bridge, supplierDim, currency, docs, historical] = await Promise.all([
    scoreBridge(supabase),
    scoreSupplier(supplier, companyId, supabase),
    scoreCurrency(supabase),
    scoreDocuments(traficoId, supabase),
    scoreHistorical(desc, companyId, supabase),
  ])

  const compliance = scoreCompliance(trafico.score_reasons || null)
  const temporal = scoreTemporal()

  const dimensions = [bridge, supplierDim, currency, docs, compliance, historical, temporal]

  // Weighted average: compliance and docs weigh more
  const weights = { bridge: 1, supplier: 1.5, currency: 0.5, documents: 2, compliance: 2, historical: 1, temporal: 0.5 }
  let weightedSum = 0
  let totalWeight = 0
  for (const d of dimensions) {
    const w = weights[d.source as keyof typeof weights] || 1
    weightedSum += d.score * w
    totalWeight += w
  }
  const riskScore = Math.round(weightedSum / totalWeight)

  const riskLevel: MeshAssessment['riskLevel'] =
    riskScore >= 70 ? 'critical' :
    riskScore >= 50 ? 'elevated' :
    riskScore >= 30 ? 'moderate' :
    riskScore >= 15 ? 'low' : 'minimal'

  const correlations = findCorrelations(dimensions, trafico)

  // Recommendation
  let recommendation: string
  if (riskScore < 15) recommendation = 'Proceder con procesamiento estándar. Operación de bajo riesgo.'
  else if (riskScore < 30) recommendation = 'Proceder con monitoreo. Verificar documentos antes del cruce.'
  else if (riskScore < 50) recommendation = 'Revisar factores de riesgo antes de proceder. Considerar ajustar ventana de cruce.'
  else if (riskScore < 70) recommendation = 'Atención requerida. Resolver bloqueadores antes del cruce. Considerar revisión manual.'
  else recommendation = 'Alto riesgo. Escalamiento recomendado. No proceder sin revisión de Tito.'

  return { riskScore, riskLevel, dimensions, recommendation, correlations }
}
