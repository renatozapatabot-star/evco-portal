/**
 * ZAPATA AI · Anomaly Detector — in-memory checks over recent facturas.
 *
 * Three detectors mirror the skill definition (anomaly-detector.md):
 *
 *   VALUE_OUTLIER  — factura value > 2σ from that proveedor's historical mean
 *   TMEC_MISS      — IGI paid on a supplier historically T-MEC-eligible (IGI=0)
 *   IVA_CASCADE    — iva deviates >5% from expected (valor_aduana + dta + igi)×rate
 *
 * Severity Alta / Media / Baja follows the skill rubric. One query + in-memory
 * grouping; no joins, no pre-aggregation table required.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getIVARate } from '@/lib/rates'

export type AnomalyKind = 'VALUE_OUTLIER' | 'TMEC_MISS' | 'IVA_CASCADE'
export type Severity = 'alta' | 'media' | 'baja'

export interface Anomaly {
  kind: AnomalyKind
  severity: Severity
  referencia: string | null
  pedimento: string | null
  proveedor: string | null
  fecha: string | null
  valor_usd: number | null
  clave_cliente: string | null
  expected: string
  found: string
  deviation_pct: number
  detail: string
}

export interface AnomalyReport {
  lookbackDays: number
  baselineDays: number
  anomalies: Anomaly[]
  totals: {
    alta: number
    media: number
    baja: number
    facturasScanned: number
  }
}

interface FacturaRow {
  referencia: string | null
  pedimento: string | null
  proveedor: string | null
  num_factura: string | null
  valor_total: number | null
  igi: number | null
  iva: number | null
  dta: number | null
  fecha: string | null
  clave_cliente: string | null
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export async function loadAnomalies(
  sb: SupabaseClient,
  opts: { claveCliente?: string | null; lookbackDays?: number; baselineDays?: number } = {},
): Promise<AnomalyReport> {
  const lookbackDays = opts.lookbackDays ?? 30
  const baselineDays = opts.baselineDays ?? 365
  const nowMs = Date.now()
  const recentCutoff = new Date(nowMs - lookbackDays * 86_400_000)
  const baselineCutoff = new Date(nowMs - baselineDays * 86_400_000)

  let q = sb
    .from('aduanet_facturas')
    .select('referencia, pedimento, proveedor, num_factura, valor_total, igi, iva, dta, fecha, clave_cliente')
    .gte('fecha', iso(baselineCutoff))
    .order('fecha', { ascending: false })
    .limit(3000)

  if (opts.claveCliente) q = q.eq('clave_cliente', opts.claveCliente)

  let ivaRate = 0.16
  try {
    ivaRate = await getIVARate()
  } catch {
    // fall back to standard 16% — detector still useful
  }

  const { data } = await q
  const rows = (data ?? []) as FacturaRow[]

  const recentRows = rows.filter(r => r.fecha && new Date(r.fecha) >= recentCutoff)

  // Group baseline by proveedor for statistics + T-MEC history.
  interface ProveedorStats {
    values: number[]
    mean: number
    std: number
    totalOps: number
    tmecOps: number
    igiPaidOps: number
  }
  const byProveedor = new Map<string, ProveedorStats>()

  for (const row of rows) {
    const p = (row.proveedor ?? '').trim()
    if (!p) continue
    if (!byProveedor.has(p)) {
      byProveedor.set(p, { values: [], mean: 0, std: 0, totalOps: 0, tmecOps: 0, igiPaidOps: 0 })
    }
    const bucket = byProveedor.get(p)!
    bucket.totalOps += 1
    const v = Number(row.valor_total) || 0
    if (v > 0) bucket.values.push(v)
    const igi = Number(row.igi) || 0
    if (igi === 0) bucket.tmecOps += 1
    else bucket.igiPaidOps += 1
  }

  for (const stats of byProveedor.values()) {
    if (stats.values.length < 2) continue
    const n = stats.values.length
    const mean = stats.values.reduce((s, v) => s + v, 0) / n
    const variance = stats.values.reduce((s, v) => s + (v - mean) ** 2, 0) / n
    stats.mean = mean
    stats.std = Math.sqrt(variance)
  }

  const anomalies: Anomaly[] = []

  for (const row of recentRows) {
    const p = (row.proveedor ?? '').trim()
    const valor = Number(row.valor_total) || 0
    const igi = Number(row.igi) || 0
    const iva = Number(row.iva) || 0
    const dta = Number(row.dta) || 0
    const stats = p ? byProveedor.get(p) : null

    // 1) VALUE_OUTLIER
    if (stats && stats.std > 0 && stats.values.length >= 5 && valor > 0) {
      const z = Math.abs(valor - stats.mean) / stats.std
      if (z >= 2) {
        const deviation = ((valor - stats.mean) / stats.mean) * 100
        const severity: Severity = z >= 3 ? 'alta' : 'media'
        anomalies.push({
          kind: 'VALUE_OUTLIER',
          severity,
          referencia: row.referencia,
          pedimento: row.pedimento,
          proveedor: p || null,
          fecha: row.fecha,
          valor_usd: valor,
          clave_cliente: row.clave_cliente,
          expected: `$${stats.mean.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD (μ histórico)`,
          found: `$${valor.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD`,
          deviation_pct: Math.round(deviation * 10) / 10,
          detail: `${z.toFixed(1)}σ sobre la media histórica de ${p || 'proveedor'}`,
        })
      }
    }

    // 2) TMEC_MISS — IGI paid on a supplier that historically cruzó sin IGI.
    if (stats && igi > 0 && stats.tmecOps >= 3 && stats.igiPaidOps < stats.tmecOps * 0.25) {
      const ratio = stats.tmecOps / Math.max(stats.totalOps, 1)
      const severity: Severity = ratio >= 0.8 ? 'alta' : 'media'
      anomalies.push({
        kind: 'TMEC_MISS',
        severity,
        referencia: row.referencia,
        pedimento: row.pedimento,
        proveedor: p || null,
        fecha: row.fecha,
        valor_usd: valor,
        clave_cliente: row.clave_cliente,
        expected: `IGI 0 · T-MEC aplicado (${Math.round(ratio * 100)}% del histórico)`,
        found: `IGI $${igi.toLocaleString('en-US', { maximumFractionDigits: 0 })} MXN`,
        deviation_pct: 100,
        detail: `Proveedor ${p || ''} cruza normalmente con certificado USMCA — verificar faltante`,
      })
    }

    // 3) IVA_CASCADE — iva must equal (valor + dta + igi) × ivaRate within ±5%.
    if (iva > 0 && valor > 0) {
      const expectedBase = valor + dta + igi
      const expectedIva = expectedBase * ivaRate
      if (expectedIva > 0) {
        const deviation = ((iva - expectedIva) / expectedIva) * 100
        const absDev = Math.abs(deviation)
        if (absDev >= 5) {
          const severity: Severity = absDev >= 20 ? 'alta' : absDev >= 10 ? 'media' : 'baja'
          anomalies.push({
            kind: 'IVA_CASCADE',
            severity,
            referencia: row.referencia,
            pedimento: row.pedimento,
            proveedor: p || null,
            fecha: row.fecha,
            valor_usd: valor,
            clave_cliente: row.clave_cliente,
            expected: `$${expectedIva.toLocaleString('en-US', { maximumFractionDigits: 0 })} MXN (base × ${(ivaRate * 100).toFixed(0)}%)`,
            found: `$${iva.toLocaleString('en-US', { maximumFractionDigits: 0 })} MXN`,
            deviation_pct: Math.round(deviation * 10) / 10,
            detail: `IVA no coincide con base cascada valor_aduana + DTA + IGI`,
          })
        }
      }
    }
  }

  // Sort: alta first, then by date desc.
  const sevOrder: Record<Severity, number> = { alta: 0, media: 1, baja: 2 }
  anomalies.sort((a, b) => {
    if (sevOrder[a.severity] !== sevOrder[b.severity]) return sevOrder[a.severity] - sevOrder[b.severity]
    return (b.fecha ?? '').localeCompare(a.fecha ?? '')
  })

  return {
    lookbackDays,
    baselineDays,
    anomalies,
    totals: {
      alta: anomalies.filter(a => a.severity === 'alta').length,
      media: anomalies.filter(a => a.severity === 'media').length,
      baja: anomalies.filter(a => a.severity === 'baja').length,
      facturasScanned: recentRows.length,
    },
  }
}
