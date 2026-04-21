import type { SupabaseClient } from '@supabase/supabase-js'
import { formatFraccion } from '@/lib/format/fraccion'

type AnyClient = SupabaseClient<any, any, any> // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Anexo 24 canonical reference helpers.
 *
 * Single-source-of-truth resolver for merchandise name, part number,
 * and tariff fraction. Every render site in CRUZ that shows any of
 * those three values should eventually route through the resolvers
 * below. Phase 3 of the Anexo 24 plan.
 *
 * Behavior is gated by the USE_ANEXO24_CANONICAL environment flag.
 * When the flag is false (default until Phase 3 ingest is live), the
 * resolvers return the `fallback` values their callers already hold
 * (globalpc_productos.descripcion, globalpc_partidas.fraccion, etc).
 * When true, resolvers consult anexo24_parts first and fall back
 * only when no canonical row exists.
 *
 * The helper is intentionally shape-stable — callers pass whatever
 * object they already have; the helper reads the canonical-preferred
 * fields if present and falls back to the legacy fields. Migrating a
 * read site is a one-line change.
 *
 * Read invariant: resolvers never throw. On any Supabase error or
 * missing row, they return the fallback unchanged. A missing canonical
 * row must never degrade the user experience — Ursula sees the legacy
 * value, same as before the flag flipped.
 */

export function isAnexo24CanonicalEnabled(): boolean {
  return process.env.USE_ANEXO24_CANONICAL === 'true'
}

/** Single part view — caller provides whatever fields it has. Fields
 *  prefixed `anexo24_*` come from a join/prefetch against anexo24_parts;
 *  legacy fields come from globalpc_productos / globalpc_partidas. */
export interface ReferencePart {
  cve_producto?: string | null
  /** Canonical (anexo24_parts.merchandise_name_official). */
  anexo24_merchandise_name?: string | null
  /** Legacy (globalpc_productos.descripcion or partida descripcion). */
  descripcion?: string | null

  /** Canonical (anexo24_parts.fraccion_official, already dotted). */
  anexo24_fraccion?: string | null
  /** Legacy. */
  fraccion?: string | null
  fraccion_arancelaria?: string | null
}

/**
 * Resolve the merchandise name to display. Prefers the Anexo 24
 * canonical name when the flag is on and a value is present; falls
 * back to the caller-supplied descripcion. Always returns a non-empty
 * string when any source has content — never returns empty unless
 * the part has no data at all.
 */
export function resolveMerchName(part: ReferencePart): string {
  if (isAnexo24CanonicalEnabled()) {
    const canonical = part.anexo24_merchandise_name?.trim()
    if (canonical) return canonical
  }
  const legacy = (part.descripcion ?? '').trim()
  if (legacy) return legacy
  return part.cve_producto?.trim() || 'Sin descripción'
}

/**
 * Resolve the tariff fraction. Returns the SAT-formatted value
 * (XXXX.XX.XX) or null if nothing is available. Formats on the way
 * out so every surface renders identically — no matter which source
 * held the raw value.
 */
export function resolveFraction(part: ReferencePart): string | null {
  const candidates = isAnexo24CanonicalEnabled()
    ? [part.anexo24_fraccion, part.fraccion, part.fraccion_arancelaria]
    : [part.fraccion, part.fraccion_arancelaria]
  for (const candidate of candidates) {
    const trimmed = candidate?.toString().trim()
    if (trimmed) return formatFraccion(trimmed) ?? trimmed
  }
  return null
}

/**
 * Resolve the part number. Canonical cve_producto is the same in
 * anexo24_parts and globalpc_productos, so this mostly just ensures
 * the value is trimmed + non-empty. Kept as a helper so future schema
 * changes (e.g. Formato 53 introducing a separate "official part
 * number" column) have a single migration point.
 */
export function resolvePartNumber(part: ReferencePart): string | null {
  const raw = part.cve_producto?.trim()
  return raw && raw.length > 0 ? raw : null
}

/**
 * Batch-lookup: given a list of cve_productos, fetch the current
 * anexo24_parts rows for the tenant. Used by read sites that already
 * hydrate lists of products — they can join into this map once
 * instead of N-querying per row.
 *
 * When the flag is off, returns an empty map. Callers treat the
 * empty map as "no canonical overlay" and fall back to legacy data.
 */
export async function loadAnexo24Overlay(
  supabase: AnyClient,
  companyId: string,
  cveProductos: Array<string | null | undefined>,
): Promise<Map<string, {
  merchandise_name_official: string
  merchandise_name_ingles: string | null
  fraccion_official: string | null
  umt_official: string | null
  pais_origen_official: string | null
}>> {
  const map = new Map<string, {
    merchandise_name_official: string
    merchandise_name_ingles: string | null
    fraccion_official: string | null
    umt_official: string | null
    pais_origen_official: string | null
  }>()
  if (!isAnexo24CanonicalEnabled()) return map

  const uniqueCves = Array.from(new Set(cveProductos.filter((c): c is string => !!c && c.length > 0)))
  if (uniqueCves.length === 0 || !companyId) return map

  try {
    // Production schema uses `anexo24_partidas` (row-per-pedimento-
    // partida). We compute the part-level snapshot on the fly: group
    // by numero_parte, pick the most-recent partida by fecha_pago.
    //
    // fecha_pago is stored as a DD/MM/YYYY string, not a timestamp, so
    // we sort client-side after parsing. fraccion is stored packed (no
    // dots) so we unpack via formatFraccion to the SAT canonical shape.
    const { data, error } = await supabase
      .from('anexo24_partidas')
      .select('numero_parte, descripcion, fraccion, um_comercial, pais_origen, fecha_pago')
      .eq('company_id', companyId)
      .in('numero_parte', uniqueCves)
      .limit(10000)
    if (error) return map

    // Group by numero_parte → pick max fecha_pago (DD/MM/YYYY → compare on epoch).
    const latestPerCve = new Map<string, { descripcion: string | null; fraccion: string | null; um_comercial: string | null; pais_origen: string | null; ts: number }>()
    for (const row of (data ?? []) as Array<{
      numero_parte: string | null
      descripcion: string | null
      fraccion: string | null
      um_comercial: string | null
      pais_origen: string | null
      fecha_pago: string | null
    }>) {
      const cve = row.numero_parte
      if (!cve) continue
      const ts = parseDDMMYYYY(row.fecha_pago)
      const prev = latestPerCve.get(cve)
      if (!prev || ts > prev.ts) {
        latestPerCve.set(cve, {
          descripcion: row.descripcion,
          fraccion: row.fraccion,
          um_comercial: row.um_comercial,
          pais_origen: row.pais_origen,
          ts,
        })
      }
    }
    for (const [cve, latest] of latestPerCve) {
      map.set(cve, {
        merchandise_name_official: latest.descripcion ?? cve,
        merchandise_name_ingles: null,
        // Unpack packed fracciones (39012001 → 3901.20.01) so every
        // downstream comparison happens in canonical dotted form.
        fraccion_official: latest.fraccion ? (formatFraccion(latest.fraccion) ?? latest.fraccion) : null,
        umt_official: latest.um_comercial,
        pais_origen_official: latest.pais_origen,
      })
    }
  } catch {
    // Network/table error — fall back silently. Never break the page.
  }
  return map
}

/** DD/MM/YYYY → unix-ms. Returns 0 on parse failure so rows without a
 *  date sort to the bottom but still surface as the overlay source. */
function parseDDMMYYYY(s: string | null | undefined): number {
  if (!s) return 0
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim())
  if (!m) return 0
  const iso = `${m[3]}-${m[2]}-${m[1]}T00:00:00Z`
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : 0
}

/**
 * Diagnostic helper — returns the divergence between a legacy
 * globalpc_productos descripcion and the canonical Formato 53 name
 * for a given (company_id, cve_producto). Used by the drift alert
 * job (Phase 3.5) to identify parts where Renato needs to either
 * correct GlobalPC.net upstream or accept the canonical truth into
 * globalpc_productos.
 */
export function computeDrift(
  legacyDescripcion: string | null | undefined,
  canonicalName: string | null | undefined,
): { is_drift: boolean; severity: 'none' | 'minor' | 'major' } {
  const a = (legacyDescripcion ?? '').trim().toUpperCase()
  const b = (canonicalName ?? '').trim().toUpperCase()
  if (!a || !b) return { is_drift: false, severity: 'none' }
  if (a === b) return { is_drift: false, severity: 'none' }
  // Minor drift = whitespace/punctuation/case noise that a fuzzy match
  // would normalize. Major = genuinely different strings.
  const normA = a.replace(/[^A-Z0-9]/g, '')
  const normB = b.replace(/[^A-Z0-9]/g, '')
  if (normA === normB) return { is_drift: true, severity: 'minor' }
  return { is_drift: true, severity: 'major' }
}
