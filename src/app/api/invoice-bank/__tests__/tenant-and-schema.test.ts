/**
 * Regression fence for GET /api/invoice-bank.
 *
 * Two contracts this file locks:
 *
 *   1. Tenant scope — client role is hard-locked to session.companyId.
 *      A client passing ?company_id=mafesa never escapes their own
 *      tenant. Internal roles can ?company_id= for view-as. Mirrors
 *      the canonical pattern from /api/data tenant-isolation tests.
 *
 *   2. Schema-cache miss — when PostgREST returns
 *      "Could not find the table 'public.pedimento_facturas' in the
 *      schema cache" (PGRST205), the route returns 200 with an empty
 *      rows array + `meta.schema_pending: true` instead of leaking
 *      the schema-cache error in a 500. This is the short-term
 *      contract while the CREATE TABLE migration is pending; the UI
 *      renders an empty state instead of a crash banner.
 *
 * Block 8 follow-up (NOT in this PR):
 *   · Author the CREATE TABLE pedimento_facturas migration with RLS.
 *   · Apply via supabase db push.
 *   · Drop the schema-cache-miss branch from this route once the
 *     table exists in production (the test would still pass — empty
 *     bank is a valid default — but the branch becomes dead code).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase chain
   faithful-typing adds no signal here; matches the pattern used by
   src/app/api/data/__tests__/tenant-isolation.test.ts. */

// Observable sinks
const eqCalls: Array<{ column: string; value: unknown }> = []
let mockQueryResult: { data: any[] | null; error: any; count?: number | null } = {
  data: [],
  error: null,
  count: 0,
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (_table: string) => {
      const chain: any = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          eqCalls.push({ column: col, value: val })
          return chain
        },
        order: () => chain,
        range: () => chain,
        gte: () => chain,
        lte: () => chain,
        ilike: () => chain,
        then: (onF: any) => Promise.resolve(mockQueryResult).then(onF),
      }
      return chain
    },
  }),
}))

let mockSession: any = null
vi.mock('@/lib/session', () => ({
  verifySession: async (_token: string) => mockSession,
}))

function makeRequest(
  sessionCookie: string | null,
  qs: Record<string, string> = {},
  extraCookies: Record<string, string> = {},
) {
  const params = new URLSearchParams(qs)
  const cookies = new Map<string, { value: string }>()
  if (sessionCookie) cookies.set('portal_session', { value: sessionCookie })
  for (const [k, v] of Object.entries(extraCookies)) cookies.set(k, { value: v })
  const url = `https://portal.test/api/invoice-bank${params.toString() ? `?${params.toString()}` : ''}`
  const req: any = {
    cookies: { get: (name: string) => cookies.get(name) },
    nextUrl: {
      searchParams: params,
    },
  }
  // The route reads request.nextUrl.searchParams + request.cookies.get(...);
  // url is unused but kept for parity with sibling tests.
  void url
  return req
}

beforeEach(() => {
  eqCalls.length = 0
  mockQueryResult = { data: [], error: null, count: 0 }
  mockSession = null
})

describe('GET /api/invoice-bank — auth gate', () => {
  it('returns 401 when no session', async () => {
    const { GET } = await import('../route')
    const res = await GET(makeRequest(null))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })
})

describe('GET /api/invoice-bank — tenant scope', () => {
  it('client role: filters by session.companyId, ignores ?company_id= override', async () => {
    mockSession = { role: 'client', companyId: 'evco' }
    const { GET } = await import('../route')
    // Client passes ?company_id=mafesa — should be IGNORED.
    const res = await GET(makeRequest('signed-token', { company_id: 'mafesa' }))
    expect(res.status).toBe(200)
    // The .eq('company_id', X) call must use 'evco', not 'mafesa'.
    const companyEq = eqCalls.find(c => c.column === 'company_id')
    expect(companyEq).toBeDefined()
    expect(companyEq!.value).toBe('evco')
  })

  it('client role: ignores company_id cookie override', async () => {
    mockSession = { role: 'client', companyId: 'evco' }
    const { GET } = await import('../route')
    // Client forges company_id cookie — should be IGNORED.
    const res = await GET(makeRequest('signed-token', {}, { company_id: 'mafesa' }))
    expect(res.status).toBe(200)
    const companyEq = eqCalls.find(c => c.column === 'company_id')
    expect(companyEq!.value).toBe('evco')
  })

  it('internal role: honors ?company_id= for view-as', async () => {
    mockSession = { role: 'broker', companyId: 'internal' }
    const { GET } = await import('../route')
    const res = await GET(makeRequest('signed-token', { company_id: 'mafesa' }))
    expect(res.status).toBe(200)
    const companyEq = eqCalls.find(c => c.column === 'company_id')
    expect(companyEq!.value).toBe('mafesa')
  })

  it('internal role: falls back to company_id cookie when no query param', async () => {
    mockSession = { role: 'admin', companyId: 'admin' }
    const { GET } = await import('../route')
    const res = await GET(makeRequest('signed-token', {}, { company_id: 'evco' }))
    expect(res.status).toBe(200)
    const companyEq = eqCalls.find(c => c.column === 'company_id')
    expect(companyEq!.value).toBe('evco')
  })
})

describe('GET /api/invoice-bank — schema-cache miss', () => {
  it('returns 200 with empty rows + schema_pending flag when table missing (PGRST205)', async () => {
    mockSession = { role: 'client', companyId: 'evco' }
    mockQueryResult = {
      data: null,
      error: {
        code: 'PGRST205',
        message: "Could not find the table 'public.pedimento_facturas' in the schema cache",
      },
      count: null,
    }
    const { GET } = await import('../route')
    const res = await GET(makeRequest('signed-token'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.error).toBeNull()
    expect(body.data.rows).toEqual([])
    expect(body.data.meta.schema_pending).toBe(true)
    expect(body.data.meta.total).toBe(0)
  })

  it('matches the schema-cache miss by message when code is missing', async () => {
    mockSession = { role: 'client', companyId: 'evco' }
    mockQueryResult = {
      data: null,
      error: {
        message: "Could not find the table 'public.pedimento_facturas' in the schema cache",
      },
      count: null,
    }
    const { GET } = await import('../route')
    const res = await GET(makeRequest('signed-token'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.meta.schema_pending).toBe(true)
  })

  it('still returns 500 for unrelated query errors (e.g. column type mismatch)', async () => {
    mockSession = { role: 'client', companyId: 'evco' }
    mockQueryResult = {
      data: null,
      error: { code: '42703', message: 'column some_col does not exist' },
      count: null,
    }
    const { GET } = await import('../route')
    const res = await GET(makeRequest('signed-token'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})

describe('GET /api/invoice-bank — input validation', () => {
  it('400 on invalid status', async () => {
    mockSession = { role: 'client', companyId: 'evco' }
    const { GET } = await import('../route')
    const res = await GET(makeRequest('signed-token', { status: 'bogus' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
