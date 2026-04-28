/**
 * IDOR fence for /api/v1/intelligence/* parameterized routes — P0-A3.
 *
 * Closes audit finding V4 from
 * ~/Desktop/audit-tenant-isolation-2026-04-28.md.
 *
 * Pre-fix attack: partner with a valid API key for tenant A could
 * read tenant B's crossing predictions / risk scores / supplier
 * network rows by passing B's trafico_id (or a B-tenant supplier
 * name) in the URL. The route only checked the API key existed,
 * never that the resource belonged to that key's tenant.
 *
 * Post-fix contract:
 *   1. Authenticated request for a resource that exists but belongs
 *      to another tenant → 404 (not 403, to avoid existence leak).
 *   2. Authenticated request for own-tenant resource → 200.
 *   3. Each route applies `.eq('company_id', auth.company_id)`
 *      before / alongside the resource filter.
 *
 * Strategy: static regression guard. The behavioral path requires
 * mocking authenticateApiKey + Supabase chain, both of which we
 * cover in cookie-fence-sweep's pattern. Here we lock the diff so
 * a future refactor can't drop the tenant filter.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = process.cwd()

const ROUTES = [
  {
    path: 'src/app/api/v1/intelligence/risk-score/[trafico]/route.ts',
    table: 'pedimento_risk_scores',
  },
  {
    path: 'src/app/api/v1/intelligence/crossing-prediction/[trafico]/route.ts',
    table: 'crossing_predictions',
  },
  {
    path: 'src/app/api/v1/intelligence/supplier/[name]/route.ts',
    table: 'supplier_network',
  },
] as const

describe('v1/intelligence · IDOR fence (P0-A3)', () => {
  for (const { path, table } of ROUTES) {
    it(`${path} applies .eq('company_id', auth.company_id)`, () => {
      const src = readFileSync(join(REPO_ROOT, path), 'utf8')

      // Confirm the route still queries the expected table
      expect(src.includes(`.from('${table}')`)).toBe(true)

      // Confirm tenant filter is applied. Match the canonical pattern:
      // .eq('company_id', auth.company_id) — accepting double-quote variants.
      const hasTenantFence = /\.eq\(\s*['"]company_id['"]\s*,\s*auth\.company_id\s*\)/.test(src)
      expect(
        hasTenantFence,
        `${path} must apply .eq('company_id', auth.company_id) on the ${table} query — IDOR otherwise`,
      ).toBe(true)
    })
  }

  it('all three routes still call authenticateApiKey first (no anonymous access)', () => {
    for (const { path } of ROUTES) {
      const src = readFileSync(join(REPO_ROOT, path), 'utf8')
      expect(src.includes('authenticateApiKey(request)')).toBe(true)
      expect(src.includes('if (!auth) return unauthorized()')).toBe(true)
    }
  })
})
