/**
 * Crossing stream builder — the pure composer that turns a partidas
 * fetch + resolved links into the enriched stream every intelligence
 * aggregator expects.
 *
 * Why this exists:
 *   The same 20-line `enriched = partidas.map(...).filter(...)` block
 *   appears in `getCrossingInsights`, `getVerdeProbabilityForSku`, and
 *   `getVerdeProbabilityForTrafico`. Three copies drift over time.
 *   Extracted here so all three call sites share the same semantics:
 *
 *     - Only include crossings with a resolved trafico link
 *     - Only include crossings with a non-null fecha_cruce (filed)
 *     - Coerce semaforo to the canonical SemaforoValue type
 *     - Attach optional fraccion enrichment when available
 *
 * This is pure — no DB access, no side effects. Build the input
 * fixtures and you can unit-test every aggregator downstream.
 *
 * Example:
 *   const partidas = await supabase.from('globalpc_partidas')
 *     .select('cve_producto, cve_proveedor, folio')
 *     .eq('company_id', companyId).limit(5000)
 *   const links = await resolvePartidaLinks(supabase, companyId, partidas)
 *   const fraccionByCve = await fetchFraccionByCve(...)  // optional
 *   const stream = buildCrossingStream({ partidas, links, fraccionByCve })
 *
 *   // Feed the stream into any aggregator:
 *   const streaks = computePartStreaks(stream)
 *   const prov    = computeProveedorHealth(stream)
 *   const frac    = computeFraccionHealth(stream)
 *   const vol     = computeVolumeSummary(stream)
 *   const anoms   = detectAnomalies(stream)
 */

import type { ResolvedLinks } from '@/lib/queries/partidas-trafico-link'
import type { SemaforoValue } from './crossing-insights'

/** Minimum partida shape the composer needs. Matches what every
 *  call site already fetches. */
export interface CrossingStreamPartida {
  cve_producto: string | null
  cve_proveedor: string | null
  folio: number | null
}

export interface CrossingStreamRow {
  cve_producto: string | null
  cve_proveedor: string | null
  fraccion: string | null
  fecha_cruce: string | null
  semaforo: SemaforoValue
}

export interface BuildCrossingStreamInput {
  /** Raw partidas fetched from globalpc_partidas (tenant-scoped). */
  partidas: CrossingStreamPartida[]
  /** Output of `resolvePartidaLinks(supabase, companyId, partidas)`. */
  links: ResolvedLinks
  /** Optional: per-cve_producto → fracción map. When absent, the
   *  stream's `fraccion` field is always null. Fracción-using
   *  aggregators (computeFraccionHealth) degrade gracefully. */
  fraccionByCve?: Map<string, string | null>
  /** When true, include rows with no resolved link (for debug /
   *  extended analytics). Default false — the aggregators expect
   *  filed crossings only. */
  includeUnfiled?: boolean
}

/**
 * Build the enriched crossing stream. Always returns an array;
 * never throws. Empty input → empty output.
 */
export function buildCrossingStream(
  input: BuildCrossingStreamInput,
): CrossingStreamRow[] {
  const { partidas, links, fraccionByCve, includeUnfiled } = input
  const out: CrossingStreamRow[] = []
  for (const p of partidas) {
    const link = p.folio != null ? links.byFolio.get(p.folio) : null
    if (!link) {
      if (includeUnfiled) {
        out.push({
          cve_producto: p.cve_producto,
          cve_proveedor: p.cve_proveedor,
          fraccion: p.cve_producto && fraccionByCve
            ? fraccionByCve.get(p.cve_producto) ?? null
            : null,
          fecha_cruce: null,
          semaforo: null,
        })
      }
      continue
    }
    // Drop rows without a fecha_cruce — the aggregators count
    // filed crossings only. Use includeUnfiled=true to keep them.
    if (!link.fecha_cruce && !includeUnfiled) continue

    const semaforo: SemaforoValue =
      link.semaforo === 0 || link.semaforo === 1 || link.semaforo === 2
        ? (link.semaforo as SemaforoValue)
        : null

    out.push({
      cve_producto: p.cve_producto,
      cve_proveedor: p.cve_proveedor,
      fraccion: p.cve_producto && fraccionByCve
        ? fraccionByCve.get(p.cve_producto) ?? null
        : null,
      fecha_cruce: link.fecha_cruce,
      semaforo,
    })
  }
  return out
}

/**
 * Convenience: project a stream for the aggregator that only wants
 * a subset of fields. Saves a `.map(c => ({ ... }))` at every call.
 */
export function projectForPartStreaks(
  stream: CrossingStreamRow[],
): Array<{ cve_producto: string; fecha_cruce: string | null; semaforo: SemaforoValue }> {
  return stream
    .filter((c): c is CrossingStreamRow & { cve_producto: string } => !!c.cve_producto)
    .map((c) => ({
      cve_producto: c.cve_producto,
      fecha_cruce: c.fecha_cruce,
      semaforo: c.semaforo,
    }))
}

export function projectForProveedorHealth(
  stream: CrossingStreamRow[],
): Array<{ cve_proveedor: string; fecha_cruce: string | null; semaforo: SemaforoValue }> {
  return stream
    .filter((c): c is CrossingStreamRow & { cve_proveedor: string } => !!c.cve_proveedor)
    .map((c) => ({
      cve_proveedor: c.cve_proveedor,
      fecha_cruce: c.fecha_cruce,
      semaforo: c.semaforo,
    }))
}

export function projectForFraccionHealth(
  stream: CrossingStreamRow[],
): Array<{ fraccion: string | null; fecha_cruce: string | null; semaforo: SemaforoValue }> {
  return stream.map((c) => ({
    fraccion: c.fraccion,
    fecha_cruce: c.fecha_cruce,
    semaforo: c.semaforo,
  }))
}

export function projectForVolumeSummary(
  stream: CrossingStreamRow[],
): Array<{ fecha_cruce: string | null; semaforo: SemaforoValue }> {
  return stream.map((c) => ({ fecha_cruce: c.fecha_cruce, semaforo: c.semaforo }))
}
