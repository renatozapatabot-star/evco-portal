/**
 * CRUZ Institutional Memory
 *
 * 80 years of Zapata family knowledge about Laredo customs,
 * made permanent, searchable, and actionable.
 *
 * Not just data — context. "This supplier always ships late
 * in December." "This fracción was disputed by SAT in 2024."
 * "This client prefers email over WhatsApp."
 *
 * Captures patterns from operational data and makes them
 * available to every ADUANA AI conversation.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

// ── Types ──

export interface MemoryEntry {
  company_id: string
  pattern_type: string
  pattern_key: string
  pattern_value: string
  confidence: number        // 0-1
  observations: number      // how many data points support this
  source: string            // 'operational' | 'correction' | 'manual' | 'karpathy'
  last_seen: string         // ISO timestamp
}

export type PatternType =
  | 'supplier_behavior'     // "Milacron ships late in December"
  | 'product_pattern'       // "Polipropileno always classified as 3901.20"
  | 'crossing_pattern'      // "Electronics flagged at Colombia 2-4 PM"
  | 'client_preference'     // "EVCO prefers email over WhatsApp"
  | 'compliance_precedent'  // "Fracción X disputed in 2024, use OCA-2024-047"
  | 'seasonal_pattern'      // "Volume increases 15% in Q1"
  | 'operational_insight'   // "New inspector at Colombia flags electronics >$10K"

// ── Memory Builder (from operational data) ──

interface TraficoForMemory {
  trafico?: string
  company_id?: string | null
  proveedores?: string | null
  descripcion_mercancia?: string | null
  fecha_llegada?: string | null
  fecha_cruce?: string | null
  regimen?: string | null
  importe_total?: number | null
  [k: string]: unknown
}

export function extractPatterns(
  traficos: TraficoForMemory[],
  companyId: string,
): MemoryEntry[] {
  const patterns: MemoryEntry[] = []
  const now = new Date().toISOString()

  // ── Supplier delivery patterns ──
  const supplierDays = new Map<string, number[]>()
  for (const t of traficos) {
    if (!t.fecha_llegada || !t.fecha_cruce || !t.proveedores) continue
    const days = (new Date(t.fecha_cruce).getTime() - new Date(t.fecha_llegada).getTime()) / 86400000
    if (days < 0 || days > 30) continue
    const supplier = t.proveedores.split(',')[0]?.trim()
    if (!supplier) continue
    const arr = supplierDays.get(supplier) || []
    arr.push(days)
    supplierDays.set(supplier, arr)
  }

  for (const [supplier, days] of supplierDays) {
    if (days.length < 3) continue
    const avg = Math.round(days.reduce((a, b) => a + b, 0) / days.length * 10) / 10
    patterns.push({
      company_id: companyId,
      pattern_type: 'supplier_behavior',
      pattern_key: `delivery_time:${supplier.toLowerCase().replace(/\s+/g, '_')}`,
      pattern_value: `${supplier} entrega en promedio ${avg} días (basado en ${days.length} operaciones)`,
      confidence: Math.min(0.95, 0.5 + days.length * 0.05),
      observations: days.length,
      source: 'operational',
      last_seen: now,
    })
  }

  // ── Seasonal volume patterns ──
  const byMonth = new Map<number, number>()
  for (const t of traficos) {
    if (!t.fecha_llegada) continue
    const month = new Date(t.fecha_llegada).getMonth()
    byMonth.set(month, (byMonth.get(month) || 0) + 1)
  }

  if (byMonth.size >= 6) {
    const avgPerMonth = traficos.length / 12
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

    for (const [month, count] of byMonth) {
      if (count > avgPerMonth * 1.3) {
        patterns.push({
          company_id: companyId,
          pattern_type: 'seasonal_pattern',
          pattern_key: `high_volume_month:${month}`,
          pattern_value: `Volumen alto en ${months[month]}: ${count} operaciones (promedio: ${Math.round(avgPerMonth)})`,
          confidence: 0.8,
          observations: count,
          source: 'operational',
          last_seen: now,
        })
      }
    }
  }

  // ── T-MEC utilization pattern ──
  const tmecOps = traficos.filter(t => {
    const r = (t.regimen || '').toUpperCase()
    return r === 'ITE' || r === 'ITR' || r === 'IMD'
  }).length

  if (traficos.length >= 10) {
    const tmecRate = Math.round(tmecOps / traficos.length * 100)
    patterns.push({
      company_id: companyId,
      pattern_type: 'operational_insight',
      pattern_key: 'tmec_utilization',
      pattern_value: `Tasa de utilización T-MEC: ${tmecRate}% (${tmecOps} de ${traficos.length} operaciones)`,
      confidence: 0.9,
      observations: traficos.length,
      source: 'operational',
      last_seen: now,
    })
  }

  // ── Product classification patterns ──
  const productSupplier = new Map<string, Set<string>>()
  for (const t of traficos) {
    if (!t.descripcion_mercancia || !t.proveedores) continue
    const product = t.descripcion_mercancia.substring(0, 40).toLowerCase().trim()
    const supplier = t.proveedores.split(',')[0]?.trim()
    if (!supplier) continue
    const set = productSupplier.get(product) || new Set()
    set.add(supplier)
    productSupplier.set(product, set)
  }

  for (const [product, suppliers] of productSupplier) {
    if (suppliers.size >= 2) {
      patterns.push({
        company_id: companyId,
        pattern_type: 'product_pattern',
        pattern_key: `product_suppliers:${product.replace(/\s+/g, '_').substring(0, 30)}`,
        pattern_value: `"${product}" importado de ${suppliers.size} proveedores: ${Array.from(suppliers).slice(0, 3).join(', ')}`,
        confidence: 0.85,
        observations: suppliers.size,
        source: 'operational',
        last_seen: now,
      })
    }
  }

  return patterns
}

// ── Memory Writer ──

export async function writeMemories(
  supabase: SupabaseClient,
  patterns: MemoryEntry[],
): Promise<number> {
  if (patterns.length === 0) return 0

  // Upsert by company_id + pattern_key
  let written = 0
  for (const p of patterns) {
    const { error } = await supabase
      .from('cruz_memory')
      .upsert({
        company_id: p.company_id,
        pattern_type: p.pattern_type,
        pattern_key: p.pattern_key,
        pattern_value: p.pattern_value,
        confidence: p.confidence,
        observations: p.observations,
        source: p.source,
        last_seen: p.last_seen,
      }, { onConflict: 'company_id,pattern_key' })

    if (!error) written++
  }

  return written
}

// ── Memory Reader (for ADUANA AI context) ──

export async function getMemoryContext(
  supabase: SupabaseClient,
  companyId: string,
  query?: string,
): Promise<string> {
  let q = supabase
    .from('cruz_memory')
    .select('pattern_type, pattern_key, pattern_value, confidence, observations, last_seen')
    .eq('company_id', companyId)
    .gte('confidence', 0.5)
    .order('confidence', { ascending: false })
    .limit(15)

  if (query) {
    q = q.ilike('pattern_value', `%${query.substring(0, 30)}%`)
  }

  const { data } = await q

  if (!data || data.length === 0) return 'Sin patrones registrados para este cliente.'

  const lines = data.map(m =>
    `[${m.pattern_type}] ${m.pattern_value} (confianza: ${Math.round(m.confidence * 100)}%, ${m.observations} observaciones)`
  )

  return lines.join('\n')
}
