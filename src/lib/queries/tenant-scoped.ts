/**
 * Tenant-scoped query builder — the "I always forget .eq('company_id', …)"
 * helper.
 *
 * Problem this solves:
 *   Every tenant-scoped read in this codebase has to include an explicit
 *   `.eq('company_id', companyId)` filter. RLS is the hard wall; the
 *   app-layer filter is defense-in-depth (core-invariants §14). Forgetting
 *   the filter silently leaks cross-tenant data at service-role privilege.
 *
 *   Historical incidents:
 *     - Block EE contamination (2026-04-17): 303,656 rows had to be
 *       retagged because multiple sync scripts wrote without company_id.
 *     - /catalogo cross-tenant leak (2026-04-18): service-role query
 *       without tenant filter showed Tornillo parts on EVCO's catalog.
 *     - execQueryCatalogo leak (2026-04-19): AI tool's productos query
 *       missed the allowlist filter on client role.
 *
 * This helper returns a pre-filtered query builder that enforces the
 * tenant scope at construction time. Calling `.select(...)` on the
 * returned builder gives you a `company_id`-scoped query by default.
 *
 * Design goals:
 *   - Make the right thing easy. `.from('traficos')` → unscoped;
 *     `getTenantScopedQuery(sb, 'traficos', 'evco')` → already filtered.
 *   - Compile-time table check via schema-contracts tuples.
 *   - Support admin bypass explicitly (internal roles pass null companyId).
 *   - Chainable — returns a real PostgrestFilterBuilder, not a wrapper.
 *
 * NOT a complete replacement for manual `.eq('company_id', …)`. Use it
 * for single-table reads. Multi-hop joins (partidas → facturas → traficos)
 * should still apply `.eq` at every hop (see partidas-by-trafico.ts for
 * the canonical 3-hop pattern).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { SchemaTable } from '@/lib/schema-contracts'

/** Internal roles that can read across tenants (admin + broker). Client
 *  + operator roles always scope to their own tenant. */
export type TenantScopeMode = 'tenant' | 'all-tenants'

export interface TenantScopeOptions {
  /** Pass `'all-tenants'` to bypass the company_id filter. This is the
   *  ONLY legitimate bypass path — used by admin/broker oversight
   *  queries. Client-role callers must never pass this. */
  mode?: TenantScopeMode
}

/**
 * Return a pre-filtered supabase query builder for a tenant-scoped
 * table. Usage:
 *
 *   const { data } = await getTenantScopedQuery(supabase, 'traficos', 'evco')
 *     .select('trafico, pedimento, fecha_cruce')
 *     .order('fecha_cruce', { ascending: false })
 *     .limit(10)
 *
 * Admin bypass (oversight):
 *
 *   const { data } = await getTenantScopedQuery(
 *     supabase, 'traficos', null, { mode: 'all-tenants' }
 *   ).select('trafico, company_id').limit(100)
 *
 * @param supabase   Supabase client (service role — bypasses RLS; this
 *                   helper is the app-layer defense).
 * @param table      Tenant-scoped table name. Typed against
 *                   SchemaTable to catch typos at compile time.
 * @param companyId  The tenant slug (e.g. "evco"). Pass null with
 *                   mode='all-tenants' for admin bypass.
 * @param opts       Optional scope override. Default 'tenant'.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getTenantScopedQuery<T = any>(
  supabase: SupabaseClient,
  table: SchemaTable,
  companyId: string | null,
  opts: TenantScopeOptions = {},
) {
  const mode = opts.mode ?? 'tenant'

  if (mode === 'all-tenants') {
    // Admin/broker oversight — explicit bypass. Log-worthy at call site
    // but this helper trusts the caller's intent.
    return supabase.from(table) as unknown as ReturnType<
      SupabaseClient['from']
    > & { __T?: T }
  }

  if (!companyId) {
    throw new Error(
      `getTenantScopedQuery('${table}'): companyId is required when mode='tenant'. ` +
        `If you need admin bypass, pass { mode: 'all-tenants' } explicitly.`,
    )
  }

  return supabase.from(table).select() === undefined
    ? supabase.from(table) // unreachable, satisfies TS
    : // The returned builder has .select(), .order(), etc. pre-scoped.
      supabase.from(table).select('*').eq('company_id', companyId)
}

/**
 * Variant returning a plain `.from(table)` builder with company_id
 * pre-applied via an implicit `.eq`. Use when you need `.select()` with
 * an explicit column list (the typical case):
 *
 *   const q = getScopedFrom(supabase, 'traficos', 'evco')
 *   const { data } = await q
 *     .select('trafico, pedimento')
 *     .order('fecha_cruce', { ascending: false })
 *     .limit(10)
 *
 * This is the preferred form — more flexible than getTenantScopedQuery
 * because you keep full control over the column list.
 */
export function getScopedFrom(
  supabase: SupabaseClient,
  table: SchemaTable,
  companyId: string | null,
  opts: TenantScopeOptions = {},
) {
  const mode = opts.mode ?? 'tenant'
  if (mode === 'all-tenants') return supabase.from(table)
  if (!companyId) {
    throw new Error(
      `getScopedFrom('${table}'): companyId required unless mode='all-tenants'.`,
    )
  }
  return supabase.from(table).select('*').eq('company_id', companyId)
}

/**
 * Assert a scope mode is valid for a session role. Use at API route
 * entry when deciding whether to allow `?company_id=` override.
 *
 *   const mode = assertScopeMode(session.role, requestedMode)
 *   const rows = await getScopedFrom(sb, 'traficos', companyId, { mode })
 */
export function assertScopeMode(
  role: string,
  requestedMode: TenantScopeMode = 'tenant',
): TenantScopeMode {
  if (requestedMode === 'all-tenants') {
    if (role !== 'admin' && role !== 'broker') {
      throw new Error(
        `scope mode 'all-tenants' requires admin or broker role, got '${role}'`,
      )
    }
  }
  return requestedMode
}
