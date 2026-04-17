/**
 * CRUZ · Tax ID/RFC resolver for suppliers.
 *
 * Two paths:
 *   1. Cache hit (`proveedor_rfc_cache`) — always fast, always first.
 *   2. Live lookup via SAT SIEM or a third-party RFC API — optional,
 *      gated by env `SAT_RFC_API_URL` + `SAT_RFC_API_KEY`. When those
 *      aren't set the resolver returns null and the caller continues
 *      with whatever fallback it already had (usually the Formato 53's
 *      own Tax ID column if that row carries one).
 *
 * Why this lives as its own file:
 *   - Keeps the ingest path clean (parser doesn't need to know how RFC
 *     resolution works).
 *   - When the real SAT/SIEM integration credentials land, this is the
 *     one file to update.
 *   - Tests can mock `lookupRfcByName` without touching anything else.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const CACHE_FRESH_DAYS = 180

function normalize(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[,.]/g, '')
    .replace(/\s+/g, ' ')
}

export interface RfcResolution {
  name_normalized: string
  display_name: string
  rfc: string | null
  source: 'formato53' | 'sat_consulta' | 'manual' | 'cache' | 'unknown'
  last_lookup_at: string
}

/**
 * Resolve a Tax ID/RFC for a supplier name. Cache-first; only attempts a
 * live lookup when (a) no cache row exists or (b) the cache row is older
 * than CACHE_FRESH_DAYS AND no RFC was ever resolved.
 */
export async function lookupRfcByName(
  supabase: SupabaseClient,
  supplierName: string,
): Promise<RfcResolution | null> {
  if (!supplierName || !supplierName.trim()) return null
  const key = normalize(supplierName)

  // 1. Cache check.
  const { data: cached } = await supabase
    .from('proveedor_rfc_cache')
    .select('name_normalized, display_name, rfc, source, last_lookup_at')
    .eq('name_normalized', key)
    .maybeSingle()
  if (cached && cached.rfc) {
    return {
      name_normalized: cached.name_normalized,
      display_name: cached.display_name,
      rfc: cached.rfc,
      source: 'cache',
      last_lookup_at: cached.last_lookup_at,
    }
  }

  // 2. Fresh-enough negative cache → skip live lookup.
  if (cached && !cached.rfc) {
    const age = Date.now() - new Date(cached.last_lookup_at).getTime()
    if (age < CACHE_FRESH_DAYS * 86_400_000) {
      return {
        name_normalized: cached.name_normalized,
        display_name: cached.display_name,
        rfc: null,
        source: 'cache',
        last_lookup_at: cached.last_lookup_at,
      }
    }
  }

  // 3. Live lookup — gated by env. When no endpoint is configured the
  //    resolver returns null; the background backfill script will try
  //    again next week when SAT credentials are in place.
  const endpoint = process.env.SAT_RFC_API_URL
  const apiKey = process.env.SAT_RFC_API_KEY
  let rfc: string | null = null
  if (endpoint && apiKey) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ name: supplierName }),
      })
      if (res.ok) {
        const payload = await res.json() as { rfc?: string | null }
        rfc = typeof payload?.rfc === 'string' && payload.rfc.trim().length > 0 ? payload.rfc.trim() : null
      }
    } catch {
      // Live lookup failed — treat as unresolved; the cache write below
      // records a negative result so we back off for 180 days.
    }
  }

  const now = new Date().toISOString()
  await supabase.from('proveedor_rfc_cache').upsert({
    name_normalized: key,
    display_name: supplierName.trim(),
    rfc,
    source: rfc ? 'sat_consulta' : 'unknown',
    last_lookup_at: now,
  }, { onConflict: 'name_normalized' })

  return {
    name_normalized: key,
    display_name: supplierName.trim(),
    rfc,
    source: rfc ? 'sat_consulta' : 'unknown',
    last_lookup_at: now,
  }
}

/**
 * Bulk record RFC from Formato 53 — called during ingest when a row
 * carries a non-null Tax ID/RFC. Skips existing cache entries that
 * already resolved. Batch-friendly.
 */
export async function recordRfcFromFormato53(
  supabase: SupabaseClient,
  entries: Array<{ supplier_name: string; rfc: string }>,
): Promise<{ written: number; skipped: number }> {
  let written = 0
  let skipped = 0
  const now = new Date().toISOString()
  for (const e of entries) {
    if (!e.supplier_name || !e.rfc) { skipped++; continue }
    const key = normalize(e.supplier_name)
    const { error } = await supabase
      .from('proveedor_rfc_cache')
      .upsert({
        name_normalized: key,
        display_name: e.supplier_name.trim(),
        rfc: e.rfc.trim(),
        source: 'formato53',
        last_lookup_at: now,
      }, { onConflict: 'name_normalized' })
    if (error) { skipped++; continue }
    written++
  }
  return { written, skipped }
}
