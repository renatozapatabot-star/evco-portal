/**
 * Tenant-isolation regression fence for GET /api/catalogo/partes
 * (the list endpoint — companion to the /[cveProducto] detail test).
 *
 * Scope: the SCOPING INVARIANTS only. This endpoint runs 5+ downstream
 * queries (partidas aggregate, OCA count, T-MEC list, active-parts
 * allowlist, productos filter) — testing the full pipeline would mean
 * replicating PostgrestQueryBuilder across all of them. Instead, we
 * stub getActiveCveProductos to return empty, which triggers the
 * "fresh tenant" calm-empty short-circuit at the route's line 169-176.
 * That's the path where the companyId-resolution decision is observable
 * without needing the full downstream pipeline.
 *
 * Invariants locked:
 *   · 401 on no session
 *   · 400 on bad query params (Zod schema)
 *   · client session → companyId = session.companyId (the ?company_id=
 *     param is IGNORED)
 *   · admin/broker session → companyId = param when provided
 *   · admin session without param → empty response (not cross-tenant)
 *   · cross-tenant list attempt → 200 with empty data (no leak)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any -- mocks intentionally
   loose; faithful typing would duplicate PostgrestQueryBuilder. */

// ─── Mocks ──────────────────────────────────────────────────────────────

// Record every companyId passed into getActiveCveProductos — that's the
// observable signal for which tenant the handler resolved.
const companyIdsObserved: string[] = []

vi.mock('@/lib/anexo24/active-parts', () => ({
  // Return empty set → triggers the fresh-tenant short-circuit so the
  // downstream pipeline (partidas, OCA, etc.) is never reached.
  getActiveCveProductos: async (_supabase: any, companyId: string) => {
    companyIdsObserved.push(companyId)
    return new Set<string>()  // empty → handler returns {partes: [], total: 0}
  },
  activeCvesArray: (set: Set<string>) => Array.from(set),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const chain: any = {
        select: () => chain,
        eq: () => chain,
        or: () => chain,
        order: () => chain,
        limit: () => chain,
        gte: () => chain,
        ilike: () => chain,
        in: () => chain,
        not: () => chain,
        is: () => chain,
        then: (onF: any) => Promise.resolve({ data: [], error: null }).then(onF),
      }
      return chain
    },
  }),
}))

let mockSession: any = null

vi.mock('@/lib/session', () => ({
  verifySession: async (_token: string) => mockSession,
}))

function makeRequest(sessionCookie: string | null, qs: Record<string, string> = {}) {
  const params = new URLSearchParams(qs)
  const cookies = new Map<string, { value: string }>()
  if (sessionCookie) cookies.set('portal_session', { value: sessionCookie })
  return {
    cookies: { get: (k: string) => cookies.get(k) },
    nextUrl: { searchParams: params },
  } as any
}

beforeEach(() => {
  companyIdsObserved.length = 0
  mockSession = null
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'fake-key'
})

// ─── Tests ──────────────────────────────────────────────────────────────

describe('GET /api/catalogo/partes · tenant isolation (list endpoint)', () => {
  it('returns 401 when no session cookie', async () => {
    const { GET } = await import('../route')
    mockSession = null
    const req = makeRequest(null)
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })

  it('returns 400 when limit exceeds max (Zod schema)', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('token', { limit: '1000' })
    const res = await GET(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 when sort is not an allowed enum value', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('token', { sort: 'by_popularity' })
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('INVARIANT: client session resolves companyId from SESSION, ignoring ?company_id= param', async () => {
    // A client trying to escalate by passing ?company_id=other-tenant
    // must NOT reach other-tenant's data. The handler's line 85 logic
    // `isInternal && paramCompany ? paramCompany : session.companyId`
    // is the fence — we observe which companyId hits getActiveCveProductos.
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('token', { company_id: 'mafesa' })
    const res = await GET(req)
    expect(res.status).toBe(200) // empty-response path (active-list empty)
    // The observable: downstream used 'evco', not 'mafesa'
    expect(companyIdsObserved).toEqual(['evco'])
    expect(companyIdsObserved).not.toContain('mafesa')
  })

  it('client session with NO param → companyId = session.companyId', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('token')
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(companyIdsObserved).toEqual(['evco'])
  })

  it('admin session WITH ?company_id=mafesa → companyId = mafesa (oversight path)', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'admin', companyId: 'admin' }
    const req = makeRequest('token', { company_id: 'mafesa' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(companyIdsObserved).toEqual(['mafesa'])
  })

  it('admin session WITHOUT param → returns empty (never resolves to "admin" slug)', async () => {
    // Guard: a bare admin session without ?company_id would otherwise
    // resolve companyId='admin' (from session.companyId). The route
    // short-circuits at line 89-94 to return empty rather than seq-scan
    // every tenant's productos looking for company_id='admin'. No leak
    // because no real row has company_id='admin'.
    const { GET } = await import('../route')
    mockSession = { role: 'admin', companyId: 'admin' }
    const req = makeRequest('token')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.partes).toEqual([])
    expect(body.data.total).toBe(0)
    // getActiveCveProductos was NOT called — short-circuit before it
    expect(companyIdsObserved).toEqual([])
  })

  it('broker session WITHOUT param → same short-circuit as admin', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'broker', companyId: 'internal' }
    const req = makeRequest('token')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.partes).toEqual([])
    expect(companyIdsObserved).toEqual([])
  })

  it('INVARIANT: fresh tenant (zero active parts) → empty list, not a full productos scan', async () => {
    // Block EE contract: legacy sync left ~148K noise rows tagged
    // company_id='evco' that were never actually imported. Without
    // the active-parts allowlist, every catalog render would surface
    // 148K junk SKUs. Empty active-set → empty response, no scan.
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('token')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.partes).toEqual([])
    expect(body.data.total).toBe(0)
  })
})
