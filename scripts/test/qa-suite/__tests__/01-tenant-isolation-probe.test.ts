import { describe, it, expect } from 'vitest'
// Probe is a JS module without typedefs; the import resolves at runtime
// for the smoke test. The probe's contract is enforced by the assertions
// below — type drift surfaces as test failures rather than tsc errors.
import {
  buildProbes,
  TARGETED_ROUTES,
  DEFAULT_SCOPING_ROUTES,
} from '../01-tenant-isolation-probe.mjs'

/**
 * Smoke test for the tenant-isolation probe module.
 *
 * This test does NOT run the probe against any real environment — it
 * verifies the builder produces the expected shape so the probe can
 * be invoked safely from CI / hooks once Renato wires it.
 *
 * Real production verification happens via:
 *   BASE_URL=... CLIENT_SESSION=... node 01-tenant-isolation-probe.mjs
 * which is gated behind Renato's first-run approval (see README + the
 * QA plan B5 wiring decision).
 */

describe('TARGETED_ROUTES inventory', () => {
  it('contains at least the 9 routes called out in the QA suite plan B2', () => {
    expect(TARGETED_ROUTES.length).toBeGreaterThanOrEqual(9)
  })

  it('every route declares method, base_query, accepts list', () => {
    for (const route of TARGETED_ROUTES) {
      expect(route.path).toMatch(/^\/api\//)
      expect(route.method).toBe('GET')
      expect(typeof route.base_query).toBe('string')
      expect(Array.isArray(route.accepts)).toBe(true)
      expect(route.accepts.length).toBeGreaterThan(0)
    }
  })

  it('every accepts entry is one of the three known attack vectors', () => {
    const valid = new Set(['company_id', 'cve_cliente', 'clave_cliente'])
    for (const route of TARGETED_ROUTES) {
      for (const v of route.accepts) {
        expect(valid.has(v)).toBe(true)
      }
    }
  })

  it('includes /api/data — the SEV-1 surface that triggered this work', () => {
    const apiData = TARGETED_ROUTES.find((r: { path: string }) => r.path === '/api/data')
    expect(apiData).toBeDefined()
    expect(apiData!.accepts).toContain('company_id')
    expect(apiData!.accepts).toContain('cve_cliente')
    expect(apiData!.accepts).toContain('clave_cliente')
  })
})

describe('DEFAULT_SCOPING_ROUTES inventory', () => {
  it('contains at least one default-scoping check', () => {
    expect(DEFAULT_SCOPING_ROUTES.length).toBeGreaterThanOrEqual(1)
  })

  it('every entry has path + method + base_query', () => {
    for (const route of DEFAULT_SCOPING_ROUTES) {
      expect(route.path).toMatch(/^\/api\//)
      expect(route.method).toBe('GET')
      expect(typeof route.base_query).toBe('string')
    }
  })
})

describe('buildProbes', () => {
  const baseConfig = {
    baseUrl: 'https://portal.renatozapata.com',
    foreignTenantId: 'mafesa',
    foreignClave: '4598',
    routeFilter: '',
  }

  it('returns one probe per (route, attack_shape) pair plus default-scoping', () => {
    const probes = buildProbes(baseConfig)
    // Should produce more probes than routes (multiple attack shapes per route)
    expect(probes.length).toBeGreaterThan(TARGETED_ROUTES.length)
    // Plus N default-scoping probes
    const dsProbes = probes.filter((p: { attack_shape: string }) => p.attack_shape === 'no_override_default_scoping')
    expect(dsProbes.length).toBe(DEFAULT_SCOPING_ROUTES.length)
  })

  it('builds correct URL shape for company_id attack on /api/data', () => {
    const probes = buildProbes(baseConfig)
    const apiDataCompanyId = probes.find(
      (p: { route: string; attack_shape: string }) =>
        p.route === '/api/data' && p.attack_shape === 'company_id=foreign_tenant',
    )
    expect(apiDataCompanyId).toBeDefined()
    expect(apiDataCompanyId!.url).toContain('https://portal.renatozapata.com/api/data')
    expect(apiDataCompanyId!.url).toContain('company_id=mafesa')
    expect(apiDataCompanyId!.url).toContain('table=traficos')
    expect(apiDataCompanyId!.expected_status).toBe(403)
    expect(apiDataCompanyId!.expected_body_contains).toBe('Forbidden')
  })

  it('builds cve_cliente attack with the foreignClave value', () => {
    const probes = buildProbes(baseConfig)
    const apiDataCve = probes.find(
      (p: { route: string; attack_shape: string }) =>
        p.route === '/api/data' && p.attack_shape === 'cve_cliente=foreign_clave',
    )
    expect(apiDataCve).toBeDefined()
    expect(apiDataCve!.url).toContain('cve_cliente=4598')
    expect(apiDataCve!.expected_status).toBe(403)
  })

  it('builds clave_cliente attack with the foreignClave value', () => {
    const probes = buildProbes(baseConfig)
    const apiDataClave = probes.find(
      (p: { route: string; attack_shape: string }) =>
        p.route === '/api/data' && p.attack_shape === 'clave_cliente=foreign_clave',
    )
    expect(apiDataClave).toBeDefined()
    expect(apiDataClave!.url).toContain('clave_cliente=4598')
    expect(apiDataClave!.expected_status).toBe(403)
  })

  it('default-scoping probes expect 200, not 403', () => {
    const probes = buildProbes(baseConfig)
    const dsProbes = probes.filter((p: { attack_shape: string }) => p.attack_shape === 'no_override_default_scoping')
    for (const p of dsProbes) {
      expect(p.expected_status).toBe(200)
      expect(p.url).not.toContain('company_id=')
      expect(p.url).not.toContain('cve_cliente=')
      expect(p.url).not.toContain('clave_cliente=')
    }
  })

  it('routeFilter narrows the set to matching paths only', () => {
    const probes = buildProbes({ ...baseConfig, routeFilter: '/api/data' })
    for (const p of probes) {
      expect(p.route).toContain('/api/data')
    }
  })

  it('encodes foreign values in URLs (defense vs malformed inputs)', () => {
    const probes = buildProbes({
      ...baseConfig,
      foreignTenantId: 'tenant with spaces',
      foreignClave: 'clave&injection',
    })
    const withSpaces = probes.find((p: { url: string }) => p.url.includes('tenant'))
    expect(withSpaces).toBeDefined()
    expect(withSpaces!.url).toContain('tenant%20with%20spaces')
    const withAmp = probes.find((p: { url: string }) => p.url.includes('clave'))
    expect(withAmp).toBeDefined()
    expect(withAmp!.url).toContain('clave%26injection')
  })

  it('regression: every TARGETED_ROUTES entry produces ≥ 1 probe', () => {
    const probes = buildProbes(baseConfig)
    const probedPaths = new Set(probes.map((p: { route: string }) => p.route))
    for (const route of TARGETED_ROUTES) {
      expect(probedPaths.has(route.path)).toBe(true)
    }
  })
})
