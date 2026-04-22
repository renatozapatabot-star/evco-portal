/**
 * DB-facing wrappers around the pure `predictVerdeProbability`
 * predictor — take an identifier (cve_producto or a trafico slug),
 * resolve the required signals against Supabase, return a full
 * `VerdePrediction`.
 *
 * Design:
 *   - Thin coordinators. All intelligence logic stays in the pure
 *     functions; this module just handles the fetch + compose.
 *   - Tenant-scoped at every hop (see handbook §28.3 and §34.6).
 *   - Returns null on missing inputs instead of throwing — callers
 *     (API route handlers, CRUZ AI tools) expect graceful degrade.
 *   - Never calls `computeVolumeSummary` or other aggregates that
 *     the predictor itself doesn't need. Minimal fetch set.
 *
 * Usage:
 *   const pred = await getVerdeProbabilityForSku(supabase, 'evco', '6600-1108')
 *   // pred.probability, pred.band, pred.factors populated when pred != null.
 *
 *   const traf = await getVerdeProbabilityForTrafico(supabase, 'evco', '9254-X3435')
 *   // Looks up the trafico's partidas, picks the most-frequent SKU,
 *   // returns a prediction for that SKU. Useful for "predict this
 *   // shipment's likely outcome" UX.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  computePartStreaks,
  computeProveedorHealth,
  computeFraccionHealth,
  predictVerdeProbability,
  type VerdePrediction,
  type SemaforoValue,
  type PartStreak,
  type ProveedorHealth,
  type FraccionHealth,
} from './crossing-insights'
import { resolvePartidaLinks } from '@/lib/queries/partidas-trafico-link'

const DEFAULT_WINDOW_DAYS = 90
const MAX_PARTIDAS = 5000

export interface PredictByIdOptions {
  /** Lookback window (days). Default 90. Range 7..365. */
  windowDays?: number
  /** Override the current-time anchor (for tests). */
  now?: number
}

/**
 * Intermediate signals produced while computing a SKU's prediction.
 * Exposed so Phase 2 composers (`buildFullCrossingInsight`) can feed
 * downstream rule layers (recommender, explainer) without re-fetching.
 */
export interface SkuSignals {
  prediction: VerdePrediction
  streak: PartStreak
  /** The SKU's dominant proveedor in the window, when one exists. */
  proveedor: ProveedorHealth | null
  /** Chapter-level health for the SKU's fracción, when known. */
  fraccionHealth: FraccionHealth | null
  /** Tenant-wide baseline verde % used as the predictor floor. */
  baselinePct: number
  /** The fracción arancelaria string (with dots). Null if unknown. */
  fraccion: string | null
}

interface PartidaRaw {
  cve_producto: string | null
  cve_proveedor: string | null
  folio: number | null
}

/**
 * Compute all intermediate signals for an SKU prediction. Returns null
 * when there's nothing to base a prediction on (tenant empty, SKU not
 * seen in window, no filed crossings). Used directly by the full-insight
 * composer; wrapped by `getVerdeProbabilityForSku` for the prediction-only
 * API.
 */
export async function computeSkuSignals(
  supabase: SupabaseClient,
  companyId: string,
  cveProducto: string,
  opts: PredictByIdOptions = {},
): Promise<SkuSignals | null> {
  if (!companyId || !cveProducto) return null

  const windowDays = clampWindow(opts.windowDays)
  const now = opts.now ?? Date.now()
  const cutoffIso = new Date(now - windowDays * 86_400_000).toISOString()

  // 1. Pull all partidas for the tenant in the window. The predictor
  //    needs tenant-wide signals (proveedor health, fracción health,
  //    baseline), so we fetch the same stream `getCrossingInsights`
  //    would and reuse it.
  const { data: partidaRows, error: partErr } = await supabase
    .from('globalpc_partidas')
    .select('cve_producto, cve_proveedor, folio')
    .eq('company_id', companyId)
    .gte('created_at', cutoffIso)
    .limit(MAX_PARTIDAS)
  if (partErr || !partidaRows || partidaRows.length === 0) return null
  const partidas = partidaRows as PartidaRaw[]

  // 2. Does this SKU appear in the window? Early-exit if not.
  const skuPartidas = partidas.filter((p) => p.cve_producto === cveProducto)
  if (skuPartidas.length === 0) return null

  // 3. Resolve the 2-hop via the canonical helper.
  const links = await resolvePartidaLinks(
    supabase,
    companyId,
    partidas.map((p) => ({
      folio: p.folio,
      cve_producto: p.cve_producto,
      cve_proveedor: p.cve_proveedor,
    })),
  )
  if (links.byFolio.size === 0) return null

  // 4. Build the enriched crossing stream.
  const enriched = partidas
    .map((p) => {
      const link = p.folio != null ? links.byFolio.get(p.folio) : null
      if (!link || !link.fecha_cruce) return null
      return {
        cve_producto: p.cve_producto,
        cve_proveedor: p.cve_proveedor,
        fecha_cruce: link.fecha_cruce,
        semaforo:
          link.semaforo === 0 || link.semaforo === 1 || link.semaforo === 2
            ? (link.semaforo as SemaforoValue)
            : null,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (enriched.length === 0) return null

  // 5. Baseline verde pct (tenant-wide).
  const totalWithSem = enriched.filter(
    (c) => c.semaforo === 0 || c.semaforo === 1 || c.semaforo === 2,
  ).length
  const verdeCount = enriched.filter((c) => c.semaforo === 0).length
  const baselinePct = totalWithSem > 0 ? Math.round((verdeCount / totalWithSem) * 100) : 85

  // 6. SKU-specific streak.
  const streaks = computePartStreaks(
    enriched
      .filter((c): c is typeof c & { cve_producto: string } => !!c.cve_producto)
      .map((c) => ({
        cve_producto: c.cve_producto,
        fecha_cruce: c.fecha_cruce,
        semaforo: c.semaforo,
      })),
  )
  const streak = streaks.find((s) => s.cve_producto === cveProducto)
  if (!streak) return null

  // 7. Proveedor health — pick this SKU's dominant proveedor.
  const provCounts = new Map<string, number>()
  for (const c of enriched) {
    if (c.cve_producto !== cveProducto || !c.cve_proveedor) continue
    provCounts.set(c.cve_proveedor, (provCounts.get(c.cve_proveedor) ?? 0) + 1)
  }
  const topProv = pickTopProveedor(provCounts)

  const proveedorHealths = computeProveedorHealth(
    enriched
      .filter((c): c is typeof c & { cve_proveedor: string } => !!c.cve_proveedor)
      .map((c) => ({
        cve_proveedor: c.cve_proveedor,
        fecha_cruce: c.fecha_cruce,
        semaforo: c.semaforo,
      })),
  )
  const proveedor = topProv
    ? proveedorHealths.find((p) => p.cve_proveedor === topProv) ?? null
    : null

  // 8. Fracción chapter health — need to look up the SKU's fracción.
  const { data: prodRow } = await supabase
    .from('globalpc_productos')
    .select('fraccion')
    .eq('company_id', companyId)
    .eq('cve_producto', cveProducto)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const fraccion = (prodRow as { fraccion: string | null } | null)?.fraccion ?? null

  // Build fraccion health from the same enriched stream — we need the
  // chapter match. Enrich the stream with per-SKU fracción.
  let fraccionHealth = null
  if (fraccion) {
    const chapter = fraccion.replace(/\D/g, '').slice(0, 2)
    // Pull fracciones for all cve_productos touched in the stream.
    // (Optimization: only fetch productos we need — one query, chunked.)
    const distinctCves = Array.from(
      new Set(enriched.map((c) => c.cve_producto).filter((c): c is string => !!c)),
    )
    const fraccionByCve = new Map<string, string | null>()
    if (distinctCves.length > 0) {
      for (let i = 0; i < distinctCves.length; i += 500) {
        const slice = distinctCves.slice(i, i + 500)
        const { data: prods } = await supabase
          .from('globalpc_productos')
          .select('cve_producto, fraccion')
          .eq('company_id', companyId)
          .in('cve_producto', slice)
        for (const row of (prods ?? []) as Array<{
          cve_producto: string | null
          fraccion: string | null
        }>) {
          if (row.cve_producto) fraccionByCve.set(row.cve_producto, row.fraccion)
        }
      }
    }
    const healths = computeFraccionHealth(
      enriched.map((c) => ({
        fraccion: c.cve_producto ? fraccionByCve.get(c.cve_producto) ?? null : null,
        fecha_cruce: c.fecha_cruce,
        semaforo: c.semaforo,
      })),
    )
    fraccionHealth = healths.find((h) => h.chapter === chapter) ?? null
  }

  const prediction = predictVerdeProbability({
    streak,
    proveedor,
    fraccionHealth,
    baselinePct,
  })

  return {
    prediction,
    streak,
    proveedor,
    fraccionHealth,
    baselinePct,
    fraccion,
  }
}

/**
 * Predict the verde probability for a specific SKU on a tenant.
 * Returns null if the SKU has no crossings in the window (nothing to
 * base a prediction on).
 *
 * Thin wrapper around `computeSkuSignals` — the intermediate signals
 * (streak, proveedor, fraccionHealth) are exposed via that helper for
 * Phase 2 composers.
 */
export async function getVerdeProbabilityForSku(
  supabase: SupabaseClient,
  companyId: string,
  cveProducto: string,
  opts: PredictByIdOptions = {},
): Promise<VerdePrediction | null> {
  const sig = await computeSkuSignals(supabase, companyId, cveProducto, opts)
  return sig?.prediction ?? null
}

/**
 * Predict verde probability for a full trafico (shipment). Strategy:
 *   1. Resolve the trafico's partidas.
 *   2. Pick the SKU with the most partidas in the trafico.
 *   3. Delegate to `getVerdeProbabilityForSku`.
 *
 * Rationale: a trafico typically carries many related SKUs under the
 * same fracción + proveedor; the "dominant" SKU represents the
 * trafico's risk profile well enough for a calm UX signal.
 */
export async function getVerdeProbabilityForTrafico(
  supabase: SupabaseClient,
  companyId: string,
  traficoId: string,
  opts: PredictByIdOptions = {},
): Promise<VerdePrediction | null> {
  if (!companyId || !traficoId) return null

  // Get folios for this trafico.
  const { data: facturas } = await supabase
    .from('globalpc_facturas')
    .select('folio')
    .eq('company_id', companyId)
    .eq('cve_trafico', traficoId)
  const folios = (facturas ?? [])
    .map((f: { folio: number | null }) => f.folio)
    .filter((x): x is number => x != null)
  if (folios.length === 0) return null

  // Find dominant cve_producto in those partidas.
  const { data: partidas } = await supabase
    .from('globalpc_partidas')
    .select('cve_producto')
    .eq('company_id', companyId)
    .in('folio', folios)
    .limit(1000)
  const counts = new Map<string, number>()
  for (const p of (partidas ?? []) as Array<{ cve_producto: string | null }>) {
    if (!p.cve_producto) continue
    counts.set(p.cve_producto, (counts.get(p.cve_producto) ?? 0) + 1)
  }
  const topSku = pickTopProveedor(counts) // same pick-mode logic
  if (!topSku) return null

  return getVerdeProbabilityForSku(supabase, companyId, topSku, opts)
}

// ── Helpers ────────────────────────────────────────────────

function clampWindow(w: number | undefined): number {
  const v = w ?? DEFAULT_WINDOW_DAYS
  if (!Number.isFinite(v)) return DEFAULT_WINDOW_DAYS
  return Math.max(7, Math.min(365, Math.floor(v)))
}

function pickTopProveedor(counts: Map<string, number>): string | null {
  let top: string | null = null
  let topN = 0
  for (const [key, n] of counts) {
    if (n > topN) {
      topN = n
      top = key
    }
  }
  return top
}

export type { VerdePrediction, PartStreak }
