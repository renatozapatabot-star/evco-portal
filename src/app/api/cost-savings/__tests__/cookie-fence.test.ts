/**
 * Cookie-forgery fence for GET /api/cost-savings
 *
 * Locks the fix from ac85a26. Pre-fix the handler did:
 *   companyId = searchParams.company_id || cookies.company_id || ''
 * The cookie fallback is forgeable. Post-fix: client ignores param,
 * uses session.companyId; internal roles may pass ?company_id=.
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
        gte: () => chain,
        lte: () => chain,
        not: () => chain,
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

describe('GET /api/cost-savings · cookie-forgery fence', () => {
  it('returns 401 when no session', async () => {
    const { GET } = await import('../route')
    mockSession = null
    const res = await GET(makeRequest(null))
    expect(res.status).toBe(401)
  })

  it('INVARIANT: client + forged company_id cookie → session.companyId used, not cookie', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const res = await GET(makeRequest('token', {}, { company_id: 'mafesa' }))
    // 200 with empty data (stub returns []); but the FILTER shows the
    // right scope
    expect([200, 400]).toContain(res.status)
    const companyIdFilters = eqCalls.filter(c => c.column === 'company_id')
    for (const call of companyIdFilters) {
      expect(call.value).toBe('evco')
      expect(call.value).not.toBe('mafesa')
    }
  })

  it('INVARIANT: client cannot escalate via ?company_id=mafesa query param', async () => {
    // Pre-fix, the param WAS honored for clients (line 19 had the
    // searchParams as first precedence). Post-fix, client role
    // ignores the param (isInternal gate).
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const res = await GET(makeRequest('token', { company_id: 'mafesa' }))
    expect([200, 400]).toContain(res.status)
    const companyIdFilters = eqCalls.filter(c => c.column === 'company_id')
    for (const call of companyIdFilters) {
      expect(call.value).toBe('evco')
    }
  })

  it('admin + ?company_id=mafesa → oversight path', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'admin', companyId: 'admin' }
    const res = await GET(makeRequest('token', { company_id: 'mafesa' }))
    expect(res.status).toBe(200)
    const companyIdFilters = eqCalls.filter(c => c.column === 'company_id')
    for (const call of companyIdFilters) {
      expect(call.value).toBe('mafesa')
    }
  })

  it('client with empty session.companyId → 400', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: '' }
    const res = await GET(makeRequest('token'))
    expect(res.status).toBe(400)
    expect(eqCalls.length).toBe(0)
  })
})
