/**
 * Cookie-forgery fence for GET + POST /api/launchpad
 *
 * Locks the fix from ac85a26. Pre-fix, both methods preferred
 * cookies.company_id over session.companyId when selecting tenant
 * scope. Post-fix, client role uses session only; internal roles
 * may override via ?company_id=.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any */

const capturedCompanyIds: string[] = []
let mockSession: any = null

// scoreLaunchpadActions + getCruzAutoActions accept (supabase, companyId)
// — observe the companyId arg.
vi.mock('@/lib/launchpad-actions', () => ({
  scoreLaunchpadActions: async (_supabase: any, companyId: string) => {
    capturedCompanyIds.push(companyId)
    return { actions: [], completed_count: 0 }
  },
  getCruzAutoActions: async (_supabase: any, companyId: string) => {
    capturedCompanyIds.push(companyId)
    return { auto_actions: [], total_time_saved: 0 }
  },
}))

vi.mock('@/lib/session', () => ({
  verifySession: async (_token: string) => mockSession,
}))

const upsertCalls: Array<Record<string, unknown>> = []

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      upsert: (row: Record<string, unknown>) => {
        upsertCalls.push(row)
        return Promise.resolve({ error: null })
      },
    }),
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
  capturedCompanyIds.length = 0
  upsertCalls.length = 0
  mockSession = null
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'fake-key'
})

describe('GET /api/launchpad · scope resolution', () => {
  it('401 on no session', async () => {
    const { GET } = await import('../route')
    mockSession = null
    const res = await GET(makeRequest('GET', null))
    expect(res.status).toBe(401)
  })

  it('INVARIANT: client + forged company_id cookie → session scope', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const res = await GET(makeRequest('GET', 'token', {}, undefined, { company_id: 'mafesa' }))
    expect(res.status).toBe(200)
    expect(capturedCompanyIds.every(id => id === 'evco')).toBe(true)
  })

  it('client + ?company_id=mafesa → session scope (client cannot escalate)', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const res = await GET(makeRequest('GET', 'token', { company_id: 'mafesa' }))
    expect(res.status).toBe(200)
    expect(capturedCompanyIds.every(id => id === 'evco')).toBe(true)
  })

  it('admin + ?company_id=mafesa → oversight path', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'admin', companyId: 'admin' }
    const res = await GET(makeRequest('GET', 'token', { company_id: 'mafesa' }))
    expect(res.status).toBe(200)
    expect(capturedCompanyIds.every(id => id === 'mafesa')).toBe(true)
  })
})

describe('POST /api/launchpad · scope resolution on completion writes', () => {
  it('401 on no session', async () => {
    const { POST } = await import('../route')
    mockSession = null
    const res = await POST(makeRequest('POST', null, {}, { source_table: 'agent_decisions', source_id: 'X', action: 'complete' }))
    expect(res.status).toBe(401)
  })

  it('400 on missing required fields', async () => {
    const { POST } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const res = await POST(makeRequest('POST', 'token', {}, { source_table: 'agent_decisions' }))
    expect(res.status).toBe(400)
  })

  it('INVARIANT: client + forged company_id cookie → upsert uses session scope', async () => {
    const { POST } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const res = await POST(makeRequest(
      'POST', 'token', {},
      { source_table: 'agent_decisions', source_id: 'X1', action: 'complete' },
      { company_id: 'mafesa' },
    ))
    expect(res.status).toBe(200)
    expect(upsertCalls.length).toBe(1)
    expect(upsertCalls[0].company_id).toBe('evco')
  })

  it('admin + ?company_id=mafesa → oversight write to mafesa', async () => {
    const { POST } = await import('../route')
    mockSession = { role: 'admin', companyId: 'admin' }
    const res = await POST(makeRequest(
      'POST', 'token',
      { company_id: 'mafesa' },
      { source_table: 'agent_decisions', source_id: 'X1', action: 'postpone' },
    ))
    expect(res.status).toBe(200)
    expect(upsertCalls[0].company_id).toBe('mafesa')
  })
})
