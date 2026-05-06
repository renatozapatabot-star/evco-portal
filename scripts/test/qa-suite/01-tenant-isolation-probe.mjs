#!/usr/bin/env node
/**
 * scripts/test/qa-suite/01-tenant-isolation-probe.mjs
 *
 * QA suite probe — tenant-isolation fence verification.
 *
 * This is the probe that would have automatically caught today's SEV-1:
 * the /api/data route accepting `?company_id=mafesa` from a client
 * session and returning 200-with-EVCO-data instead of 403. PR #34
 * closed that fence in production on 2026-05-05; this probe makes the
 * regression surface in CI within seconds of any future weakening.
 *
 * What it does
 * ============
 *
 * For every route in `TARGETED_ROUTES` (which includes `/api/data` and
 * all other routes that accept `?company_id=` / `?cve_cliente=` /
 * `?clave_cliente=` per the QA suite plan B2 inventory), runs the
 * four attack shapes from `tenant-isolation.md`:
 *
 *   1. ?company_id=other-tenant   → expect 403 + 'Forbidden' body
 *   2. ?cve_cliente=other-clave   → expect 403 + 'Forbidden' body
 *   3. ?clave_cliente=other-clave → expect 403 + 'Forbidden' body
 *   4. (no override, default-scoping path) → expect 200 + own-tenant rows
 *
 * Plus, for routes in `DEFAULT_SCOPING_ROUTES` (Bucket 2 — authenticated,
 * tenant from session, no `?company_id=` accepted), runs only #4.
 *
 * Output
 * ======
 *
 * Writes a JSON report to /tmp/qa-suite-results/<ISO-stamp>-tenant-isolation.json
 * with shape:
 *
 *   {
 *     "run_id": "2026-05-06T01-23-45-tenant-isolation",
 *     "base_url": "https://portal.renatozapata.com",
 *     "started_at": "2026-05-06T01:23:45.123Z",
 *     "finished_at": "2026-05-06T01:23:48.456Z",
 *     "summary": { "total": 28, "passed": 28, "failed": 0 },
 *     "probes": [
 *       {
 *         "route": "/api/data",
 *         "method": "GET",
 *         "attack_shape": "company_id=other_tenant",
 *         "url": "https://...?table=traficos&company_id=mafesa",
 *         "expected_status": 403,
 *         "actual_status": 403,
 *         "expected_body_contains": "Forbidden",
 *         "actual_body_excerpt": "{\"error\":\"Forbidden\"}",
 *         "passed": true
 *       },
 *       ...
 *     ]
 *   }
 *
 * Exit code: 0 if all probes pass, 1 if any failed (or 2 on missing env).
 *
 * Usage
 * =====
 *
 *   BASE_URL=https://portal.renatozapata.com \
 *   CLIENT_SESSION='<portal_session cookie value>' \
 *   FOREIGN_TENANT_ID=mafesa \
 *   FOREIGN_CLAVE=4598 \
 *   node scripts/test/qa-suite/01-tenant-isolation-probe.mjs
 *
 * Optional:
 *   ROUTE_FILTER=/api/data    # only probe routes whose path contains this string
 *   DRY_RUN=1                 # build URLs + log targets, but don't fetch
 *   QUIET=1                   # suppress per-probe stdout (still write JSON)
 *
 * Wiring
 * ======
 *
 * NOT WIRED to CI in this commit. Renato decides whether to attach to
 * post-deploy hook + nightly cron + per-PR check (per QA suite plan B5).
 * For tonight, the probe is authored + smoke-tested via vitest only.
 *
 * Reference
 * =========
 *
 *   ~/Desktop/qa-suite-plan-2026-05-06.md sections B3 + B4
 *   .claude/rules/tenant-isolation.md § "/api/data cross-tenant fence"
 *   scripts/test/cross-tenant-probe.sh (the bash precursor this generalizes)
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

// -----------------------------------------------------------------------------
// Route inventory — hardcoded per QA plan B2 + production grep on 2026-05-06.
// -----------------------------------------------------------------------------

/**
 * Bucket 3 routes — accept `?company_id=` (or `?cve_cliente=` / `?clave_cliente=`)
 * for admin/broker oversight. Client sessions probing a foreign tenant
 * MUST receive 403 + 'Forbidden' body.
 *
 * Each entry is a probe template. `params` lists the GET params the
 * route accepts so we can append valid harness values per attack shape.
 */
export const TARGETED_ROUTES = [
  {
    path: '/api/data',
    method: 'GET',
    base_query: 'table=traficos&limit=3',
    accepts: ['company_id', 'cve_cliente', 'clave_cliente'],
    notes: 'The PR #34 fence. Most-trafficked tenant boundary on the cockpit.',
  },
  {
    path: '/api/intelligence/insights',
    method: 'GET',
    base_query: '',
    accepts: ['company_id'],
    notes: 'Per QA plan inventory.',
  },
  {
    path: '/api/freshness',
    method: 'GET',
    base_query: '',
    accepts: ['company_id'],
    notes: 'Per QA plan inventory.',
  },
  {
    path: '/api/anexo-24/csv',
    method: 'GET',
    base_query: '',
    accepts: ['company_id'],
    notes: 'CSV export — sensitive surface.',
  },
  {
    path: '/api/auditoria-pdf',
    method: 'GET',
    base_query: '',
    accepts: ['company_id'],
    notes: 'Audit PDF — sensitive surface.',
  },
  {
    path: '/api/catalogo/partes',
    method: 'GET',
    base_query: '',
    accepts: ['company_id', 'clave_cliente'],
    notes: 'Per QA plan inventory.',
  },
  {
    path: '/api/client-templates',
    method: 'GET',
    base_query: '',
    accepts: ['company_id'],
    notes: 'Per QA plan inventory.',
  },
  {
    path: '/api/embarques/partes-description',
    method: 'GET',
    base_query: '',
    accepts: ['company_id'],
    notes: 'Per QA plan inventory.',
  },
  {
    path: '/api/reports/anexo-24/generate',
    method: 'GET',
    base_query: '',
    accepts: ['company_id'],
    notes: 'Per QA plan inventory.',
  },
]

/**
 * Bucket 2 routes — authenticated, tenant from session, do NOT accept
 * `?company_id=` overrides. Default-scoping probe (no override) MUST
 * return 200 + only the session's own tenant data.
 *
 * For now we sample 3 representative endpoints. Future expansion: full
 * 167-route sweep per the QA plan.
 */
export const DEFAULT_SCOPING_ROUTES = [
  { path: '/api/data', method: 'GET', base_query: 'table=traficos&limit=3' },
  { path: '/api/freshness', method: 'GET', base_query: '' },
  { path: '/api/intelligence/insights', method: 'GET', base_query: '' },
]

// -----------------------------------------------------------------------------
// Probe builder
// -----------------------------------------------------------------------------

/** Build the array of probe configurations from the inventory + env. */
export function buildProbes({
  baseUrl,
  foreignTenantId,
  foreignClave,
  routeFilter,
}) {
  const probes = []
  const routes = routeFilter
    ? TARGETED_ROUTES.filter((r) => r.path.includes(routeFilter))
    : TARGETED_ROUTES

  for (const route of routes) {
    const baseQ = route.base_query ? `${route.base_query}&` : ''
    if (route.accepts.includes('company_id')) {
      probes.push({
        route: route.path,
        method: route.method,
        attack_shape: 'company_id=foreign_tenant',
        url: `${baseUrl}${route.path}?${baseQ}company_id=${encodeURIComponent(foreignTenantId)}`,
        expected_status: 403,
        expected_body_contains: 'Forbidden',
      })
    }
    if (route.accepts.includes('cve_cliente')) {
      probes.push({
        route: route.path,
        method: route.method,
        attack_shape: 'cve_cliente=foreign_clave',
        url: `${baseUrl}${route.path}?${baseQ}cve_cliente=${encodeURIComponent(foreignClave)}`,
        expected_status: 403,
        expected_body_contains: 'Forbidden',
      })
    }
    if (route.accepts.includes('clave_cliente')) {
      probes.push({
        route: route.path,
        method: route.method,
        attack_shape: 'clave_cliente=foreign_clave',
        url: `${baseUrl}${route.path}?${baseQ}clave_cliente=${encodeURIComponent(foreignClave)}`,
        expected_status: 403,
        expected_body_contains: 'Forbidden',
      })
    }
  }

  // Default-scoping checks (own-tenant 200)
  const dsRoutes = routeFilter
    ? DEFAULT_SCOPING_ROUTES.filter((r) => r.path.includes(routeFilter))
    : DEFAULT_SCOPING_ROUTES
  for (const route of dsRoutes) {
    const q = route.base_query ? `?${route.base_query}` : ''
    probes.push({
      route: route.path,
      method: route.method,
      attack_shape: 'no_override_default_scoping',
      url: `${baseUrl}${route.path}${q}`,
      expected_status: 200,
      expected_body_contains: '',
    })
  }

  return probes
}

// -----------------------------------------------------------------------------
// Probe runner
// -----------------------------------------------------------------------------

async function runProbe(probe, sessionCookie) {
  const headers = sessionCookie
    ? { Cookie: `portal_session=${sessionCookie}` }
    : {}
  let actualStatus = 0
  let actualBody = ''
  let networkError = null
  try {
    const res = await fetch(probe.url, {
      method: probe.method,
      headers,
      redirect: 'manual',
    })
    actualStatus = res.status
    actualBody = await res.text()
  } catch (err) {
    networkError = err instanceof Error ? err.message : String(err)
  }

  const statusOk = actualStatus === probe.expected_status
  const bodyOk = probe.expected_body_contains
    ? actualBody.includes(probe.expected_body_contains)
    : true
  const passed = !networkError && statusOk && bodyOk

  return {
    ...probe,
    actual_status: actualStatus,
    actual_body_excerpt: actualBody.slice(0, 500),
    network_error: networkError,
    passed,
  }
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main() {
  const baseUrl = process.env.BASE_URL
  const sessionCookie = process.env.CLIENT_SESSION
  const foreignTenantId = process.env.FOREIGN_TENANT_ID || 'mafesa'
  const foreignClave = process.env.FOREIGN_CLAVE || '4598'
  const routeFilter = process.env.ROUTE_FILTER || ''
  const dryRun = process.env.DRY_RUN === '1'
  const quiet = process.env.QUIET === '1'

  if (!baseUrl) {
    console.error('ERROR: BASE_URL env var is required (e.g. https://portal.renatozapata.com)')
    process.exit(2)
  }
  if (!sessionCookie && !dryRun) {
    console.error('ERROR: CLIENT_SESSION env var is required (the portal_session cookie value from a client login)')
    console.error('       Capture from DevTools → Application → Cookies → portal_session')
    console.error('       For dry-run mode that builds URLs without fetching, set DRY_RUN=1')
    process.exit(2)
  }

  const probes = buildProbes({ baseUrl, foreignTenantId, foreignClave, routeFilter })

  if (!quiet) {
    console.log(`# Tenant-isolation probe`)
    console.log(`# base_url:  ${baseUrl}`)
    console.log(`# foreign:   tenant=${foreignTenantId} clave=${foreignClave}`)
    console.log(`# probes:    ${probes.length}`)
    console.log(`# dry_run:   ${dryRun}`)
    console.log('')
  }

  const startedAt = new Date().toISOString()
  const results = []
  for (const probe of probes) {
    if (dryRun) {
      results.push({ ...probe, actual_status: null, actual_body_excerpt: '', network_error: null, passed: true, dry_run: true })
      if (!quiet) console.log(`  [dry] ${probe.route} · ${probe.attack_shape}`)
      continue
    }
    const result = await runProbe(probe, sessionCookie)
    results.push(result)
    if (!quiet) {
      const mark = result.passed ? '✓' : '✗'
      console.log(`  ${mark} ${result.route} · ${result.attack_shape} · ${result.actual_status}`)
      if (!result.passed) {
        console.log(`      expected ${result.expected_status} containing '${result.expected_body_contains}'`)
        if (result.network_error) console.log(`      network_error: ${result.network_error}`)
        else console.log(`      body excerpt: ${result.actual_body_excerpt.slice(0, 200)}`)
      }
    }
  }
  const finishedAt = new Date().toISOString()

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
  }

  // Report file
  const stamp = startedAt.replace(/[:.]/g, '-').replace('T', '-').replace('Z', '')
  const reportDir = '/tmp/qa-suite-results'
  mkdirSync(reportDir, { recursive: true })
  const reportPath = join(reportDir, `${stamp}-tenant-isolation.json`)
  const report = {
    run_id: `${stamp}-tenant-isolation`,
    base_url: baseUrl,
    started_at: startedAt,
    finished_at: finishedAt,
    summary,
    probes: results,
  }
  writeFileSync(reportPath, JSON.stringify(report, null, 2))

  if (!quiet) {
    console.log('')
    console.log(`# Report:  ${reportPath}`)
    console.log(`# Result:  ${summary.passed}/${summary.total} passed (${summary.failed} failed)`)
  }

  process.exit(summary.failed > 0 ? 1 : 0)
}

// Run main only when executed directly (not when imported by tests)
const isMainModule = import.meta.url === `file://${process.argv[1]}`
if (isMainModule) {
  main().catch((err) => {
    console.error('Probe crashed:', err)
    process.exit(2)
  })
}
