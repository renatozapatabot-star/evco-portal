/**
 * Cookie-forgery fence for GET + POST /api/supplier-comms
 *
 * Locks the fix from ac85a26. Pre-fix the handler read company_id
 * AND user_role from raw cookies — a forged cookie let anyone
 * read/write communication_events for any tenant.
 *
 * Post-fix: session-derived scope with INTERNAL_ROLES allowlist
 * for ?company_id= override. Applies to GET and POST symmetrically.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any */

const eqCalls: Array<{ column: string; value: unknown }> = []
const insertCalls: Array<Record<string, unknown>> = []
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
        insert: (row: Record<string, unknown>) => {
          insertCalls.push(row)
          return Promise.resolve({ error: null })
        },
        then: (onF: any) => Promise.resolve({ data: [], error: null }).then(onF),
      }
      return chain
    },
  }),
}))

function makeRequest(method: 'GET' | 'POST', sessionCookie: string | null, qs: Record<string, string> = {}, body: any = undefined, extraCookies: Record<string, string> = {}) {
  const params = new URLSearchParams(qs)
  const cookies = new Map<string, { value: string }>()
  if (sessionCookie) cookies.set('portal_session', { value: sessionCookie })
  for (const [k, v] of Object.entries(extraCookies)) cookies.set(k, { value: v })
  return {
    cookies: { get: (k: string) => cookies.get(k) },
    nextUrl: { searchParams: params },
    json: async () => body ?? {},
    method,
  } as any
}

beforeEach(() => {
  eqCalls.length = 0
  insertCalls.length = 0
  mockSession = null
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'fake-key'
})

describe('/api/supplier-comms · GET cookie-forgery fence', () => {
  it('returns 401 when no session', async () => {
    const { GET } = await import('../route')
    mockSession = null
    const res = await GET(makeRequest('GET', null))
    expect(res.status).toBe(401)
  })

  it('INVARIANT: client + forged company_id + user_role cookies → session scope only', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const res = await GET(makeRequest('GET', 'token', {}, undefined, { company_id: 'mafesa', user_role: 'admin' }))
    expect(res.status).toBe(200)
    const companyIdFilters = eqCalls.filter(c => c.column === 'company_id')
    expect(companyIdFilters.length).toBeGreaterThan(0)
    for (const call of companyIdFilters) {
      expect(call.value).toBe('evco')
    }
  })

  it('client cannot escalate via ?company_id= query param', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const res = await GET(makeRequest('GET', 'token', { company_id: 'mafesa' }))
    expect(res.status).toBe(200)
    for (const call of eqCalls.filter(c => c.column === 'company_id')) {
      expect(call.value).toBe('evco')
    }
  })

  it('admin + ?company_id=mafesa → oversight path', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'admin', companyId: 'admin' }
    const res = await GET(makeRequest('GET', 'token', { company_id: 'mafesa' }))
    expect(res.status).toBe(200)
    for (const call of eqCalls.filter(c => c.column === 'company_id')) {
      expect(call.value).toBe('mafesa')
    }
  })

  it('client with empty companyId → 400', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: '' }
    const res = await GET(makeRequest('GET', 'token'))
    expect(res.status).toBe(400)
  })
})

describe('/api/supplier-comms · POST cookie-forgery fence', () => {
  it('returns 401 when no session', async () => {
    const { POST } = await import('../route')
    mockSession = null
    const res = await POST(makeRequest('POST', null, {}, { supplier: 'X' }))
    expect(res.status).toBe(401)
  })

  it('INVARIANT: client + forged company_id cookie → insert uses session scope', async () => {
    const { POST } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const res = await POST(makeRequest(
      'POST', 'token', {},
      { supplier: 'Milacron', trafico: '9254-X1', message_type: 'usmca_request' },
      { company_id: 'mafesa' },
    ))
    expect(res.status).toBe(200)
    // The inserted row must carry session.companyId, not the cookie
    expect(insertCalls.length).toBe(1)
    expect(insertCalls[0].company_id).toBe('evco')
  })

  it('client without supplier field → 400', async () => {
    const { POST } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const res = await POST(makeRequest('POST', 'token', {}, {}))
    expect(res.status).toBe(400)
  })

  it('admin + ?company_id=mafesa → oversight write scoped to mafesa', async () => {
    const { POST } = await import('../route')
    mockSession = { role: 'admin', companyId: 'admin' }
    const res = await POST(makeRequest(
      'POST', 'token',
      { company_id: 'mafesa' },
      { supplier: 'Duratech', trafico: 'M1' },
    ))
    expect(res.status).toBe(200)
    expect(insertCalls[0].company_id).toBe('mafesa')
  })
})
