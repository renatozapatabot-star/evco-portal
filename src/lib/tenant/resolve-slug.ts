/**
 * resolveCompanyIdSlug — defensive normalizer for tenant identifiers.
 *
 * Why:
 *   The 2026-04-29 data-quality audit found that `notifications`,
 *   `expediente_documentos`, and `operational_decisions` had silently
 *   accumulated rows whose `company_id` column held a 4-digit clave
 *   (e.g. "9254") instead of the slug (e.g. "evco"). Any client query
 *   shaped `.eq('company_id', session.companyId)` then misses ~99% of
 *   the rows because `session.companyId` is always the slug.
 *
 *   Block EE codified the rule
 *   (`.claude/rules/tenant-isolation.md`): the slug is authoritative on
 *   the app surface. Writers that accept a value from any
 *   could-be-polluted source MUST normalize to slug before insert.
 *
 * Usage:
 *   import { buildClaveMap, resolveCompanyIdSlug } from '@/lib/tenant/resolve-slug'
 *   const claveMap = await buildClaveMap(supabase)
 *   const result = resolveCompanyIdSlug(input, claveMap)
 *   if (result.kind === 'unresolved') { skip + log; return }
 *   await supabase.from('notifications').insert({ ..., company_id: result.slug })
 *
 * Behavior:
 *   - Already a slug present in the allowlist → returns it unchanged
 *   - 4-digit clave (matches `^[0-9]{1,4}$`) present in claveMap →
 *     returns the resolved slug
 *   - null / undefined / empty / unresolved → returns 'unresolved'
 *     with the original input echoed back so the caller can log + skip
 *   - Never silently defaults (no 'evco' fallback, no '|| input'
 *     passthrough that would re-write the bad value)
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type ClaveMap = Map<string, string>

export type ResolveResult =
  | { kind: 'resolved'; slug: string; via: 'slug-passthrough' | 'clave-mapped' }
  | { kind: 'unresolved'; input: unknown; reason: 'null' | 'unknown-clave' | 'unknown-slug' }

/**
 * Build the clave_cliente / globalpc_clave → slug map from the active
 * companies allowlist. Inactive duplicates (Block-EE legacy slugs)
 * are ignored — the active sibling wins.
 */
export async function buildClaveMap(supabase: SupabaseClient): Promise<ClaveMap> {
  const { data, error } = await supabase
    .from('companies')
    .select('clave_cliente, globalpc_clave, company_id, active')
    .order('active', { ascending: false })
  if (error) throw new Error(`buildClaveMap: ${error.message}`)
  const map: ClaveMap = new Map()
  // Pass 1: stamp ACTIVE first so the active company wins on conflict
  for (const row of data ?? []) {
    if (!row.company_id || !row.active) continue
    if (row.clave_cliente) map.set(String(row.clave_cliente), row.company_id)
    if (row.globalpc_clave) map.set(String(row.globalpc_clave), row.company_id)
  }
  // Pass 2: fill in inactive only where active didn't claim the clave
  for (const row of data ?? []) {
    if (!row.company_id || row.active) continue
    if (row.clave_cliente && !map.has(String(row.clave_cliente))) map.set(String(row.clave_cliente), row.company_id)
    if (row.globalpc_clave && !map.has(String(row.globalpc_clave))) map.set(String(row.globalpc_clave), row.company_id)
  }
  return map
}

/**
 * Build the active-slug allowlist (for slug passthrough validation).
 */
export async function buildSlugAllowlist(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('companies')
    .select('company_id, active')
  if (error) throw new Error(`buildSlugAllowlist: ${error.message}`)
  const set = new Set<string>()
  for (const row of data ?? []) {
    if (row.company_id && row.active) set.add(row.company_id)
  }
  return set
}

/**
 * Internal-role sentinel slugs that are intentionally not in `companies`.
 * Routes that log broker-internal decisions stamp these (per
 * `.claude/rules/tenant-isolation.md` mixed-scope tables).
 */
export const INTERNAL_SLUGS = new Set(['system', 'internal', 'admin', 'broker'])

/**
 * Normalize an arbitrary input value to a slug. Returns a structured
 * result so the caller can distinguish "resolved" from "skip + log".
 */
export function resolveCompanyIdSlug(
  input: unknown,
  claveMap: ClaveMap,
  slugAllowlist?: Set<string>,
): ResolveResult {
  if (input === null || input === undefined || input === '') {
    return { kind: 'unresolved', input, reason: 'null' }
  }
  const str = String(input).trim()
  if (str === '') return { kind: 'unresolved', input, reason: 'null' }

  // Internal-role sentinels are always allowed
  if (INTERNAL_SLUGS.has(str)) {
    return { kind: 'resolved', slug: str, via: 'slug-passthrough' }
  }

  // Pure 4-digit (or 1–4 digit) → treat as clave, must be in claveMap
  if (/^[0-9]{1,4}$/.test(str)) {
    const slug = claveMap.get(str)
    if (slug) return { kind: 'resolved', slug, via: 'clave-mapped' }
    return { kind: 'unresolved', input, reason: 'unknown-clave' }
  }

  // Otherwise: treat as slug. If allowlist provided, validate.
  if (slugAllowlist && !slugAllowlist.has(str)) {
    // Slug-shape but not in active companies — could be inactive sibling
    // or stale code path. Caller decides whether to accept or skip.
    return { kind: 'unresolved', input, reason: 'unknown-slug' }
  }
  return { kind: 'resolved', slug: str, via: 'slug-passthrough' }
}
