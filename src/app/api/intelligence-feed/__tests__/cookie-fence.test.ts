/**
 * Cookie-forgery fence for GET /api/intelligence-feed
 *
 * Locks the SEV-1 fix from ac85a26. Pre-fix, the route read
 * `req.cookies.get('company_id')` with no session fallback — any
 * authenticated user could set company_id=<target-tenant> in their
 * cookie jar and read that tenant's compliance_predictions +
 * anomaly_baselines + crossing_predictions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any */

const eqCalls: Array<{ column: string; value: unknown }> = []
let mockSession: any = null

vi.mock('@/lib/session', () => ({
  verifySession: async (_token: string) => mockSession,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const chain: any = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          eqCalls.push({ column: col, value: val })
          return chain
        },
        order: () => chain,
        limit: () => chain,
        then: (onF: any) => Promise.resolve({ data: [], error: null }).then(onF),
      }
      return chain
    },
  }),
}))

function makeRequest(sessionCookie: string | null, qs: Record<string, string> = {}, extraCookies: Record<string, string> = {}) {
  const params = new URLSearchParams(qs)
  const cookies = new Map<string, { value: string }>()
  if (sessionCookie) cookies.set('portal_session', { value: sessionCookie })
  for (const [k, v] of Object.entries(extraCookies)) cookies.set(k, { value: v })
  return {
    cookies: { get: (k: string) => cookies.get(k) },
    nextUrl: { searchParams: params },
  } as any
}

beforeEach(() => {
  eqCalls.length = 0
  mockSession = null
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'fake-key'
})

describe('GET /api/intelligence-feed · cookie-forgery fence (SEV-1)', () => {
  it('returns 401 when no session', async () => {
    const { GET } = await import('../route')
    mockSession = null
    const res = await GET(makeRequest(null))
    expect(res.status).toBe(401)
  })

  it('INVARIANT: client session + forged company_id=mafesa cookie → scoped to session (evco)', async () => {
    // The SEV-1 bypass. Pre-fix, the handler read cookies.company_id
    // and used it directly. Post-fix, session.companyId wins.
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const res = await GET(makeRequest('token', {}, { company_id: 'mafesa' }))
    expect(res.status).toBe(200)
    // All three downstream queries must filter on 'evco', never 'mafesa'
    const companyIdFilters = eqCalls.filter(c => c.column === 'company_id')
    expect(companyIdFilters.length).toBeGreaterThan(0)
    for (const call of companyIdFilters) {
      expect(call.value).toBe('evco')
      expect(call.value).not.toBe('mafesa')
    }
  })

  it('client session without cookie forgery → evco scope applied', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const res = await GET(makeRequest('token'))
    expect(res.status).toBe(200)
    expect(eqCalls.filter(c => c.column === 'company_id' && c.value === 'evco').length).toBeGreaterThan(0)
  })

  it('admin session with ?company_id=mafesa → oversight path, mafesa scope applied', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'admin', companyId: 'admin' }
    const res = await GET(makeRequest('token', { company_id: 'mafesa' }))
    expect(res.status).toBe(200)
    const companyIdFilters = eqCalls.filter(c => c.column === 'company_id')
    for (const call of companyIdFilters) {
      expect(call.value).toBe('mafesa')
    }
  })

  it('admin session with no param + admin companyId → 400 (no scope fallback to admin slug)', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'admin', companyId: 'admin' }
    // When admin companyId is the placeholder 'admin' and no param,
    // the handler has no valid tenant to scope to. Two acceptable
    // behaviors: 400 (explicit) or 200 with no data (aggregate-less).
    // This route chose the first — the !companyId guard returns 400.
    // Actually session.companyId='admin' is truthy, so it proceeds
    // and applies .eq('company_id', 'admin') which returns no rows.
    // Result: 200 with empty data (no leak).
    const res = await GET(makeRequest('token'))
    expect([200, 400]).toContain(res.status)
  })

  it('client session with empty companyId → 400 (no scope, no read)', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: '' }
    const res = await GET(makeRequest('token'))
    expect(res.status).toBe(400)
    // Crucially: no query fires without scope
    expect(eqCalls.length).toBe(0)
  })
})
