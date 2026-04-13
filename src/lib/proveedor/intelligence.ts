/**
 * AGUILA · Proveedor Intelligence — signal detection.
 *
 * Pure aggregation over recent embarques. Fast (one cap-200 query + in-memory
 * grouping). Surfaces four categories of alerts:
 *
 *   NEW             — first appearance in the lookback window
 *   VALUE_SPIKE     — latest value >50% over that supplier's rolling average
 *   DORMANT_RETURN  — gap >180 days then reappears
 *   COUNTRY_CHANGE  — supplier ships from a country we haven't seen before
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export type AlertKind = 'NEW' | 'VALUE_SPIKE' | 'DORMANT_RETURN' | 'COUNTRY_CHANGE'

export interface SupplierAlert {
  kind: AlertKind
  supplier: string
  company_id: string | null
  latest_date: string
  latest_value_usd: number | null
  pedimento: string | null
  trafico: string | null
  country: string | null
  detail: string
}

export interface SupplierSummary {
  supplier: string
  operations: number
  total_value_usd: number
  avg_value_usd: number
  countries: string[]
  last_seen: string
}

export interface ProveedorIntelligence {
  lookbackDays: number
  alerts: SupplierAlert[]
  topSuppliers: SupplierSummary[]
  totalTraficos: number
  distinctSuppliers: number
}

interface TraficoRow {
  trafico: string | null
  pedimento: string | null
  proveedores: string | null
  pais_procedencia: string | null
  importe_total: number | null
  fecha_llegada: string | null
  company_id: string | null
}

function normSupplier(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.toUpperCase().startsWith('PRV_')) return trimmed || null
  return trimmed
}

export async function loadProveedorIntelligence(
  sb: SupabaseClient,
  opts: { companyId?: string | null; lookbackDays?: number } = {},
): Promise<ProveedorIntelligence> {
  const lookbackDays = opts.lookbackDays ?? 90
  const cutoff = new Date(Date.now() - lookbackDays * 86_400_000)
  const baselineCutoff = new Date(Date.now() - 365 * 86_400_000)

  let q = sb
    .from('traficos')
    .select('trafico, pedimento, proveedores, pais_procedencia, importe_total, fecha_llegada, company_id')
    .gte('fecha_llegada', baselineCutoff.toISOString().slice(0, 10))
    .order('fecha_llegada', { ascending: false })
    .limit(2000)

  if (opts.companyId) {
    q = q.eq('company_id', opts.companyId)
  }

  const { data } = await q
  const rows = (data ?? []) as TraficoRow[]

  const alerts: SupplierAlert[] = []
  const byName = new Map<string, TraficoRow[]>()

  for (const row of rows) {
    const supplier = normSupplier(row.proveedores)
    if (!supplier) continue
    if (!byName.has(supplier)) byName.set(supplier, [])
    byName.get(supplier)!.push(row)
  }

  let recentCount = 0
  const topSuppliers: SupplierSummary[] = []

  for (const [supplier, list] of byName) {
    list.sort((a, b) => (b.fecha_llegada ?? '').localeCompare(a.fecha_llegada ?? ''))
    const latest = list[0]
    const dates = list.map(r => r.fecha_llegada).filter((d): d is string => Boolean(d))
    if (!latest?.fecha_llegada) continue
    const latestDate = new Date(latest.fecha_llegada)
    const isRecent = latestDate >= cutoff
    if (isRecent) recentCount += list.filter(r => r.fecha_llegada && new Date(r.fecha_llegada) >= cutoff).length

    const values = list.map(r => Number(r.importe_total) || 0).filter(v => v > 0)
    const total = values.reduce((s, v) => s + v, 0)
    const avg = values.length ? total / values.length : 0

    const countries = Array.from(new Set(list.map(r => (r.pais_procedencia ?? '').trim()).filter(Boolean)))

    topSuppliers.push({
      supplier,
      operations: list.length,
      total_value_usd: Math.round(total * 100) / 100,
      avg_value_usd: Math.round(avg * 100) / 100,
      countries,
      last_seen: latest.fecha_llegada,
    })

    if (!isRecent) continue

    // NEW supplier: first seen in lookback window (no earlier appearances).
    const earliestDate = dates[dates.length - 1]
    if (earliestDate && new Date(earliestDate) >= cutoff) {
      alerts.push({
        kind: 'NEW',
        supplier,
        company_id: latest.company_id,
        latest_date: latest.fecha_llegada,
        latest_value_usd: Number(latest.importe_total) || null,
        pedimento: latest.pedimento,
        trafico: latest.trafico,
        country: latest.pais_procedencia,
        detail: 'Primera aparición en los últimos ' + lookbackDays + ' días — verificar y aprobar',
      })
      continue
    }

    // DORMANT_RETURN: previous gap ≥180d then reappears now.
    if (list.length >= 2) {
      const priorDate = new Date(list[1]!.fecha_llegada ?? '')
      const gapDays = (latestDate.getTime() - priorDate.getTime()) / 86_400_000
      if (gapDays >= 180) {
        alerts.push({
          kind: 'DORMANT_RETURN',
          supplier,
          company_id: latest.company_id,
          latest_date: latest.fecha_llegada,
          latest_value_usd: Number(latest.importe_total) || null,
          pedimento: latest.pedimento,
          trafico: latest.trafico,
          country: latest.pais_procedencia,
          detail: `Sin actividad por ${Math.round(gapDays)} días antes de reaparecer`,
        })
      }
    }

    // VALUE_SPIKE: latest >150% of prior-period average (excluding latest).
    if (values.length >= 4) {
      const latestValue = Number(latest.importe_total) || 0
      const prior = values.slice(1)
      const priorAvg = prior.reduce((s, v) => s + v, 0) / prior.length
      if (priorAvg > 0 && latestValue > priorAvg * 1.5) {
        const multiplier = latestValue / priorAvg
        alerts.push({
          kind: 'VALUE_SPIKE',
          supplier,
          company_id: latest.company_id,
          latest_date: latest.fecha_llegada,
          latest_value_usd: latestValue,
          pedimento: latest.pedimento,
          trafico: latest.trafico,
          country: latest.pais_procedencia,
          detail: `${multiplier.toFixed(1)}× sobre promedio histórico · $${priorAvg.toLocaleString('en-US', { maximumFractionDigits: 0 })} USD`,
        })
      }
    }

    // COUNTRY_CHANGE: latest country not seen in prior 12 months for this supplier.
    const latestCountry = (latest.pais_procedencia ?? '').trim()
    if (latestCountry) {
      const priorCountries = new Set(list.slice(1).map(r => (r.pais_procedencia ?? '').trim()).filter(Boolean))
      if (priorCountries.size > 0 && !priorCountries.has(latestCountry)) {
        alerts.push({
          kind: 'COUNTRY_CHANGE',
          supplier,
          company_id: latest.company_id,
          latest_date: latest.fecha_llegada,
          latest_value_usd: Number(latest.importe_total) || null,
          pedimento: latest.pedimento,
          trafico: latest.trafico,
          country: latestCountry,
          detail: `Cambio de origen · histórico ${[...priorCountries].slice(0, 3).join(', ')}`,
        })
      }
    }
  }

  topSuppliers.sort((a, b) => b.total_value_usd - a.total_value_usd)
  alerts.sort((a, b) => b.latest_date.localeCompare(a.latest_date))

  return {
    lookbackDays,
    alerts,
    topSuppliers: topSuppliers.slice(0, 20),
    totalTraficos: recentCount,
    distinctSuppliers: byName.size,
  }
}
