/**
 * Role-fence regression test for GET /api/broker/data
 *
 * Locks the fix from commit ac85a26. Pre-fix, this route read role
 * from the raw `user_role` cookie — trivially forgeable. A client
 * session could set user_role=admin in their cookie jar and access
 * cross-client operational data (heartbeat, email intelligence,
 * activity aggregates).
 *
 * What this test locks:
 *   · client role → 403 (cookie user_role=admin does NOT escalate)
 *   · admin role from session → 200
 *   · broker role from session → 200
 *   · unauthenticated → 401
 *   · other roles (operator, contabilidad, etc.) → 403
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any -- same pattern
   as neighboring tenant-isolation tests. */

let mockSession: any = null

vi.mock('@/lib/session', () => ({
  verifySession: async (_token: string) => mockSession,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const chain: any = {
        select: () => chain,
        order: () => chain,
        limit: () => chain,
        single: async () => ({ data: null, error: null }),
        gte: () => chain,
        eq: () => chain,
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
  mockSession = null
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'fake-key'
})

describe('GET /api/broker/data · role fence (SEV-1 regression test)', () => {
  it('returns 401 when no session', async () => {
    const { GET } = await import('../route')
    mockSession = null
    const req = makeRequest(null)
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('INVARIANT: client session with forged user_role=admin cookie → 403', async () => {
    // Pre-fix this was the SEV-1 bypass: the handler read the
    // user_role cookie for auth and ignored the signed session.role.
    // Any authenticated client could forge user_role=admin and access
    // broker data. Post-fix: session.role is checked.
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('token', {}, { user_role: 'admin' }) // forgery attempt
    const res = await GET(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('Forbidden')
  })

  it('client session with NO cookie forgery → 403', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('token')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('admin session → 200 (allowed)', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'admin', companyId: 'admin' }
    const req = makeRequest('token', { section: 'heartbeat' })
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it('broker session → 200 (allowed)', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'broker', companyId: 'internal' }
    const req = makeRequest('token', { section: 'heartbeat' })
    const res = await GET(req)
    expect(res.status).toBe(200)
  })

  it.each(['operator', 'contabilidad', 'trafico', 'warehouse'])(
    '%s session → 403 (not in allow-list)',
    async (role) => {
      const { GET } = await import('../route')
      mockSession = { role, companyId: 'evco' }
      const req = makeRequest('token')
      const res = await GET(req)
      expect(res.status).toBe(403)
    },
  )

  it('malformed role → 403 (fail-closed)', async () => {
    const { GET } = await import('../route')
    mockSession = { role: '', companyId: 'evco' }
    const req = makeRequest('token')
    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('malformed role with admin-cookie forgery → still 403 (defense-in-depth)', async () => {
    // Double-check: even if someone passed empty role + admin cookie,
    // the handler stays closed. The cookie is never consulted.
    const { GET } = await import('../route')
    mockSession = { role: '', companyId: 'evco' }
    const req = makeRequest('token', {}, { user_role: 'admin' })
    const res = await GET(req)
    expect(res.status).toBe(403)
  })
})
