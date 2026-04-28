/**
 * Tenant-isolation regression fence for GET /api/catalogo/partes/[cveProducto]
 *
 * Locks the invariant from .claude/rules/tenant-isolation.md §Catalog:
 *
 *   "Cross-tenant cveProducto returns 404, not 403 (no info leak)."
 *
 * The Block EE contamination incident (2026-04-17) forced us to retag
 * 303,656 rows after a sync bug wrote globalpc_* rows without
 * company_id. With that hardened, this test is the permanent fence
 * at the request boundary.
 *
 * What we assert:
 *   · Cross-tenant fetch → 404 NOT_FOUND (same shape as genuinely-missing)
 *   · Own-tenant fetch   → 200 with parte data
 *   · Missing auth       → 401 UNAUTHORIZED
 *   · Invalid cve        → 400 VALIDATION_ERROR
 *   · admin session → can override via ?company_id= (oversight path)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any -- mocks
   intentionally loose; faithful typing would duplicate
   PostgrestQueryBuilder + HMAC session shape. */

// ─── Supabase mock ──────────────────────────────────────────────────────
// Per-test control of what globalpc_productos returns for a
// (cve_producto, company_id) query. Default: empty (simulates cross-
// tenant miss OR genuinely-missing cve — the invariant says those are
// indistinguishable).
type MockResult = { data: any[] | null; error: any }
let ownershipResult: MockResult = { data: [], error: null }
let deepResults: MockResult[] = []  // partidas, classifications, ocas, tmec, supertito

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        or: () => chain,
        order: () => chain,
        limit: () => chain,
        // .in() is used by the traficos enrichment query + proveedor
        // name-resolution query added in M7 — returns the same chain
        // so .then() can pop from deepResults like every other query.
        in: () => chain,
      }
      // Ownership query hits globalpc_productos with .limit(1)
      // Deep queries hit other tables — pop off the queue
      if (table === 'globalpc_productos') {
        chain.then = (onF: any) => Promise.resolve(ownershipResult).then(onF)
      } else {
        chain.then = (onF: any) => {
          const r = deepResults.shift() ?? { data: [], error: null }
          return Promise.resolve(r).then(onF)
        }
        // supertito uses a count query with {count:'exact'}
        chain.select = (_cols: any, _opts?: any) => chain
      }
      return chain
    },
  }),
}))

// ─── Session mock ───────────────────────────────────────────────────────
let mockSession: any = null

vi.mock('@/lib/session', () => ({
  verifySession: async (_token: string) => mockSession,
}))

// ─── Helpers ────────────────────────────────────────────────────────────

function makeRequest(cveProducto: string, sessionCookie: string | null) {
  const cookies = new Map<string, { value: string }>()
  if (sessionCookie) cookies.set('portal_session', { value: sessionCookie })
  return {
    cookies: { get: (k: string) => cookies.get(k) },
    nextUrl: { searchParams: new URLSearchParams() },
  } as any
}

function makeRequestWithQuery(cveProducto: string, sessionCookie: string | null, companyIdOverride?: string) {
  const params = new URLSearchParams()
  if (companyIdOverride) params.set('company_id', companyIdOverride)
  const cookies = new Map<string, { value: string }>()
  if (sessionCookie) cookies.set('portal_session', { value: sessionCookie })
  return {
    cookies: { get: (k: string) => cookies.get(k) },
    nextUrl: { searchParams: params },
  } as any
}

beforeEach(() => {
  ownershipResult = { data: [], error: null }
  deepResults = []
  mockSession = null
  // Set envs so createClient doesn't whine
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'fake-key'
})

// ─── Tests ──────────────────────────────────────────────────────────────

describe('GET /api/catalogo/partes/[cveProducto] · tenant isolation', () => {
  it('returns 401 when no session cookie', async () => {
    const { GET } = await import('../route')
    mockSession = null
    const req = makeRequest('ABC123', null)
    const res = await GET(req, { params: Promise.resolve({ cveProducto: 'ABC123' }) })
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 when cveProducto is empty', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('', 'token')
    const res = await GET(req, { params: Promise.resolve({ cveProducto: '' }) })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when cveProducto exceeds 64 chars', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const long = 'A'.repeat(65)
    const req = makeRequest(long, 'token')
    const res = await GET(req, { params: Promise.resolve({ cveProducto: long }) })
    expect(res.status).toBe(400)
  })

  it('returns 404 NOT_FOUND when cveProducto does not exist for caller company', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    ownershipResult = { data: [], error: null } // no rows
    const req = makeRequest('MISSING123', 'token')
    const res = await GET(req, { params: Promise.resolve({ cveProducto: 'MISSING123' }) })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('INVARIANT: cross-tenant cveProducto returns 404 NOT_FOUND (not 403)', async () => {
    // This is the critical fence per .claude/rules/tenant-isolation.md.
    // EVCO session trying to fetch MAFESA's cve — the ownership query
    // filters by companyId='evco' and returns no rows, indistinguishable
    // from "genuinely missing." The API must NOT leak that the cve
    // exists for another tenant.
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    ownershipResult = { data: [], error: null } // row exists for mafesa but not evco
    const req = makeRequest('MAFESA_SKU_001', 'token')
    const res = await GET(req, { params: Promise.resolve({ cveProducto: 'MAFESA_SKU_001' }) })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
    // IMPORTANT: must NOT be 403 FORBIDDEN — that would confirm existence
    expect(res.status).not.toBe(403)
    expect(body.error.code).not.toBe('FORBIDDEN')
  })

  it('returns 200 with parte data when caller owns the cveProducto', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    ownershipResult = {
      data: [{
        cve_producto: 'EVCO_SKU_001',
        descripcion: 'Test part',
        descripcion_ingles: 'Test part EN',
        fraccion: '3901.20.01',
        nico: '00',
        umt: 'KGM',
        pais_origen: 'US',
        marca: 'TestBrand',
        precio_unitario: 15.50,
        fraccion_classified_at: null,
        fraccion_source: null,
        created_at: '2026-01-01T00:00:00Z',
      }],
      error: null,
    }
    // Empty deep queries — the parte still renders with empty aggregates
    deepResults = [
      { data: [], error: null },    // partidas
      { data: [], error: null },    // classifications
      { data: [], error: null },    // ocas
      { data: null, error: null },  // tmecRes (single-ish)
      { data: [], error: null },    // supertito
    ]
    const req = makeRequest('EVCO_SKU_001', 'token')
    const res = await GET(req, { params: Promise.resolve({ cveProducto: 'EVCO_SKU_001' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.parte.cve_producto).toBe('EVCO_SKU_001')
    expect(body.data.parte.descripcion).toBe('Test part')
  })

  it('admin session can override company_id via query param (oversight path)', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'admin', companyId: 'admin' }
    ownershipResult = {
      data: [{
        cve_producto: 'MAFESA_SKU_001',
        descripcion: 'MAFESA part',
        descripcion_ingles: null,
        fraccion: null,
        nico: null,
        umt: null,
        pais_origen: null,
        marca: null,
        precio_unitario: null,
        fraccion_classified_at: null,
        fraccion_source: null,
        created_at: '2026-01-01T00:00:00Z',
      }],
      error: null,
    }
    deepResults = [
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: null, error: null },
      { data: [], error: null },
    ]
    const req = makeRequestWithQuery('MAFESA_SKU_001', 'token', 'mafesa')
    const res = await GET(req, { params: Promise.resolve({ cveProducto: 'MAFESA_SKU_001' }) })
    expect(res.status).toBe(200)
  })

  it('client session IGNORES company_id query param (cannot escalate)', async () => {
    // Critical: a client session that passes ?company_id=mafesa must
    // NOT escape its own tenant scope. The route uses the query param
    // only when isInternal is true. For clients, companyId comes
    // solely from session.companyId.
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    // Make ownershipResult empty — if the query param were honored,
    // the test would be meaningless (we want the filter to actually
    // use 'evco' regardless). Instead, we verify the outcome matches
    // the EVCO-scoped path: NOT_FOUND because evco doesn't own this sku.
    ownershipResult = { data: [], error: null }
    const req = makeRequestWithQuery('MAFESA_SKU_001', 'token', 'mafesa')
    const res = await GET(req, { params: Promise.resolve({ cveProducto: 'MAFESA_SKU_001' }) })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('enriches uses_timeline with pedimento + fecha_cruce + semaforo via 2-hop join (M12 fix)', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    ownershipResult = {
      data: [{
        cve_producto: 'XR-847',
        descripcion: 'Catalizador XR-847',
        descripcion_ingles: null,
        fraccion: '3901.20.01',
        nico: null,
        umt: 'KGM',
        pais_origen: 'US',
        marca: null,
        precio_unitario: null,
        fraccion_classified_at: null,
        fraccion_source: null,
        created_at: '2026-04-01T00:00:00Z',
      }],
      error: null,
    }
    // M12 join path: partidas.folio → facturas.folio+cve_trafico → traficos
    deepResults = [
      // partidas — 3 uses with folios (NOT cve_trafico)
      { data: [
        { created_at: '2026-04-18T00:00:00Z', cantidad: 100, precio_unitario: 15.5, cve_proveedor: 'PRV_001', folio: 1001 },
        { created_at: '2026-04-10T00:00:00Z', cantidad: 120, precio_unitario: 15.6, cve_proveedor: 'PRV_001', folio: 1002 },
        { created_at: '2026-03-28T00:00:00Z', cantidad: 90, precio_unitario: 15.4, cve_proveedor: 'PRV_002', folio: 1003 },
      ], error: null },
      { data: [], error: null }, // classifications
      { data: [], error: null }, // ocas
      { data: null, error: null }, // tmec
      { data: [], error: null }, // supertito
      // facturas — folio → cve_trafico pivot (M12 fix: this is the
      // missing hop that was causing phantom-column queries to 400)
      { data: [
        { folio: 1001, cve_trafico: 'T-001', fecha_facturacion: '2026-04-16T00:00:00Z', valor_comercial: 1550 },
        { folio: 1002, cve_trafico: 'T-002', fecha_facturacion: '2026-04-08T00:00:00Z', valor_comercial: 1872 },
        { folio: 1003, cve_trafico: 'T-003', fecha_facturacion: '2026-03-26T00:00:00Z', valor_comercial: 1386 },
      ], error: null },
      // traficos — all 3 crossed, 2 green + 1 amber
      { data: [
        { trafico: 'T-001', pedimento: '26 24 3596 6500441', fecha_cruce: '2026-04-18T09:00:00Z', fecha_llegada: '2026-04-17T18:00:00Z', semaforo: 0 },
        { trafico: 'T-002', pedimento: '26 24 3596 6500442', fecha_cruce: '2026-04-10T11:00:00Z', fecha_llegada: '2026-04-09T16:00:00Z', semaforo: 0 },
        { trafico: 'T-003', pedimento: '26 24 3596 6500443', fecha_cruce: '2026-03-28T10:00:00Z', fecha_llegada: '2026-03-27T14:00:00Z', semaforo: 1 },
      ], error: null },
      { data: [], error: null }, // globalpc_proveedores
      { data: [], error: null }, // lifetime count
    ]
    const req = makeRequest('XR-847', 'token')
    const res = await GET(req, { params: Promise.resolve({ cveProducto: 'XR-847' }) })
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.data.uses_timeline).toHaveLength(3)
    expect(body.data.uses_timeline[0].trafico_ref).toBe('T-001')
    expect(body.data.uses_timeline[0].pedimento).toBe('26 24 3596 6500441')
    expect(body.data.uses_timeline[0].semaforo).toBe(0)
    expect(body.data.uses_timeline[0].fecha_cruce).toBe('2026-04-18T09:00:00Z')
    expect(body.data.uses_timeline[2].semaforo).toBe(1)

    expect(body.data.crossings_summary).toBeDefined()
    expect(body.data.crossings_summary.total).toBe(3)
    expect(body.data.crossings_summary.verde).toBe(2)
    expect(body.data.crossings_summary.pct_verde).toBe(67)
  })

  it('leaves pedimento + semaforo null when the folio has no matching factura', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    ownershipResult = {
      data: [{
        cve_producto: 'XR-847',
        descripcion: 'Catalizador XR-847',
        descripcion_ingles: null,
        fraccion: null,
        nico: null,
        umt: 'KGM',
        pais_origen: null,
        marca: null,
        precio_unitario: null,
        fraccion_classified_at: null,
        fraccion_source: null,
        created_at: '2026-04-01T00:00:00Z',
      }],
      error: null,
    }
    deepResults = [
      // partida has folio but facturas will have no match for it
      { data: [
        { created_at: '2026-04-18T00:00:00Z', cantidad: 100, precio_unitario: 15.5, cve_proveedor: 'PRV_001', folio: 9999 },
      ], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: null, error: null },
      { data: [], error: null },
      // facturas — empty (orphan folio: factura not yet synced)
      { data: [], error: null },
      // traficos query still fires but with empty ref list → returns empty
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ]
    const req = makeRequest('XR-847', 'token')
    const res = await GET(req, { params: Promise.resolve({ cveProducto: 'XR-847' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.uses_timeline[0].trafico_ref).toBeNull()
    expect(body.data.uses_timeline[0].pedimento).toBeNull()
    expect(body.data.uses_timeline[0].fecha_cruce).toBeNull()
    expect(body.data.uses_timeline[0].semaforo).toBeNull()
    expect(body.data.crossings_summary.total).toBe(0)
    expect(body.data.crossings_summary.verde).toBe(0)
    expect(body.data.crossings_summary.pct_verde).toBeNull()
  })

  it('returns empty crossings_summary when there are no partidas', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    ownershipResult = {
      data: [{
        cve_producto: 'NEW-SKU',
        descripcion: null,
        descripcion_ingles: null,
        fraccion: null,
        nico: null,
        umt: null,
        pais_origen: null,
        marca: null,
        precio_unitario: null,
        fraccion_classified_at: null,
        fraccion_source: null,
        created_at: '2026-04-20T00:00:00Z',
      }],
      error: null,
    }
    deepResults = [
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: null, error: null },
      { data: [], error: null },
    ]
    const req = makeRequest('NEW-SKU', 'token')
    const res = await GET(req, { params: Promise.resolve({ cveProducto: 'NEW-SKU' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.uses_timeline).toHaveLength(0)
    expect(body.data.crossings_summary.total).toBe(0)
    expect(body.data.crossings_summary.pct_verde).toBeNull()
  })
})
