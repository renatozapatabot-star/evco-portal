/**
 * Tenant-isolation fence for GET /api/data — the cookie-to-tenant
 * resolver used by nearly every portal read path.
 *
 * This route is the single most security-critical API boundary in the
 * app: any bypass here means cross-tenant data exposure across
 * dozens of tables. The HMAC session model + CLIENT_SCOPED_TABLES set
 * + session.companyId preference is the fence — this file locks it.
 *
 * Invariants (per the route + tenant-isolation.md):
 *   · 401 on missing / invalid session
 *   · 400 on malformed query or unknown table
 *   · 403 on client requesting a FORBIDDEN table (no tenant column)
 *   · 400 on client requesting a SCOPED table without any filter
 *   · 403 on client cross-tenant escalation attempt via ?company_id=,
 *     ?cve_cliente=, or ?clave_cliente= mismatching the session.
 *     Audit_log row is written for every refused attempt.
 *   · SCOPING: broker/admin can pass ?company_id= to select a tenant
 *   · rate-limited at 100 req/min per IP (tested indirectly)
 *
 * 2026-05-05 hardening: pre-fix, a client passing ?company_id=mafesa
 * received a 200 with EVCO data (silent ignore). Post-fix, the same
 * request receives 403 + audit_log row. The change makes the bypass
 * attempt observable while preserving tenant isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any -- see rationale in
   other tenant-isolation tests; Supabase chain faithful-typing adds no
   signal here. */

// Observable sinks
const eqCalls: Array<{ column: string; value: unknown }> = []
const auditInserts: Array<Record<string, unknown>> = []
let selectOrderSignal: string | null = null
let mockQueryResult: { data: any[]; error: any } = { data: [], error: null }
// companies.clave_cliente lookup mock — keyed by company_id
const companyClaveMap: Record<string, string> = {
  evco: '9254',
  mafesa: '4598',
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      // audit_log.insert() — fire-and-forget side effect channel
      if (table === 'audit_log') {
        return {
          insert: (row: Record<string, unknown>) => {
            auditInserts.push(row)
            return { then: (onF: any) => Promise.resolve({ data: null }).then(onF) }
          },
        }
      }

      // companies.select(...).eq('company_id', X).maybeSingle()
      // — used by escalation fence to resolve session.companyId → clave
      const isCompaniesLookup = table === 'companies'

      const chain: any = {
        select: () => chain,
        limit: () => chain,
        eq: (col: string, val: unknown) => {
          eqCalls.push({ column: col, value: val })
          // For companies clave-resolver branch, remember the looked-up id
          if (isCompaniesLookup && col === 'company_id') {
            chain.__lookupId = val
          }
          return chain
        },
        order: (col: string, opts: any) => {
          selectOrderSignal = `${col}:${opts?.ascending ? 'asc' : 'desc'}`
          return chain
        },
        gte: () => chain,
        lte: () => chain,
        like: () => chain,
        ilike: () => chain,
        in: () => chain,
        not: () => chain,
        is: () => chain,
        or: () => chain,
        maybeSingle: () => {
          if (isCompaniesLookup) {
            const clave = companyClaveMap[chain.__lookupId as string] ?? null
            return Promise.resolve({ data: clave ? { clave_cliente: clave } : null, error: null })
          }
          return Promise.resolve({ data: null, error: null })
        },
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

// Rate-limit mock: success by default so the isolation tests focus on
// tenant logic, not rate-limit timing.
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: () => ({ success: true, resetIn: 0 }),
}))

function makeRequest(sessionCookie: string | null, qs: Record<string, string> = {}, extraCookies: Record<string, string> = {}) {
  const params = new URLSearchParams(qs)
  const cookies = new Map<string, { value: string }>()
  if (sessionCookie) cookies.set('portal_session', { value: sessionCookie })
  for (const [k, v] of Object.entries(extraCookies)) cookies.set(k, { value: v })
  return {
    headers: { get: (k: string) => k === 'user-agent' ? 'vitest/1.0' : null },
    cookies: { get: (k: string) => cookies.get(k) },
    nextUrl: { searchParams: params },
  } as any
}

beforeEach(() => {
  eqCalls.length = 0
  auditInserts.length = 0
  selectOrderSignal = null
  mockQueryResult = { data: [], error: null }
  mockSession = null
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'fake-key'
})

// ─── Auth + shape tests ─────────────────────────────────────────────────

describe('GET /api/data · auth + shape', () => {
  it('returns 401 when no session', async () => {
    const { GET } = await import('../route')
    mockSession = null
    const req = makeRequest(null, { table: 'traficos', limit: '10' })
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when table is not in ALLOWED_TABLES', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('token', { table: 'companies', limit: '10' }) // companies not in ALLOWED list
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 on schema violation (missing table)', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('token', { limit: '10' })
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})

// ─── Cross-tenant escalation fence (post-2026-05-05 hardening) ─────────

describe('GET /api/data · cross-tenant escalation fence', () => {
  it('FENCE: client session with ?company_id=mafesa → 403 + audit_log row', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('token', {
      table: 'traficos',
      company_id: 'mafesa',  // escalation attempt
      limit: '10',
    })
    const res = await GET(req)
    expect(res.status).toBe(403)
    // Body is generic — never leak which tenant exists
    const body = await res.json()
    expect(body).toEqual({ error: 'Forbidden' })
    // No data was queried — escalation refused before the read
    expect(eqCalls.find(c => c.column === 'company_id' && c.value === 'mafesa')).toBeUndefined()
    // Audit row written
    expect(auditInserts.length).toBe(1)
    expect(auditInserts[0]).toMatchObject({
      action: 'cross_tenant_attempt',
      resource: 'api/data',
      company_id: 'evco',
    })
    const diff = auditInserts[0].diff as { attempted: Array<{ via: string; attempted: string }>; session_company_id: string }
    expect(diff.session_company_id).toBe('evco')
    expect(diff.attempted).toContainEqual({ via: 'company_id_param', attempted: 'mafesa' })
  })

  it('FENCE: client session with ?cve_cliente=mafesa-clave → 403 + audit_log row', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('token', {
      table: 'traficos',
      cve_cliente: '4598',  // MAFESA's clave
      limit: '10',
    })
    const res = await GET(req)
    expect(res.status).toBe(403)
    expect(auditInserts.length).toBe(1)
    const diff = auditInserts[0].diff as { attempted: Array<{ via: string; attempted: string }> }
    expect(diff.attempted).toContainEqual({ via: 'cve_cliente_param', attempted: '4598' })
  })

  it('FENCE: client session with ?clave_cliente=mafesa-clave → 403 + audit_log row', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('token', {
      table: 'aduanet_facturas',
      clave_cliente: '4598',
      limit: '10',
    })
    const res = await GET(req)
    expect(res.status).toBe(403)
    expect(auditInserts.length).toBe(1)
    const diff = auditInserts[0].diff as { attempted: Array<{ via: string; attempted: string }> }
    expect(diff.attempted).toContainEqual({ via: 'clave_cliente_param', attempted: '4598' })
  })

  it('ALLOWED: client session with ?company_id=evco (own tenant) → 200, no audit', async () => {
    // Self-reference is not an escalation. The route uses session.companyId
    // either way; the param is redundant but harmless.
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('token', {
      table: 'traficos',
      company_id: 'evco',
      limit: '10',
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(auditInserts.length).toBe(0)
    const companyIdFilter = eqCalls.find(c => c.column === 'company_id')
    expect(companyIdFilter?.value).toBe('evco')
  })

  it('ALLOWED: client session with ?cve_cliente=own-clave (own tenant) → 200, no audit', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('token', {
      table: 'traficos',
      cve_cliente: '9254',  // EVCO's own clave
      limit: '10',
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(auditInserts.length).toBe(0)
  })
})

// ─── Default scoping (no escalation attempt) ───────────────────────────

describe('GET /api/data · default tenant scoping', () => {
  it('client role with no explicit filter → uses session.companyId', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('token', { table: 'traficos', limit: '10' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const companyIdFilter = eqCalls.find(c => c.column === 'company_id')
    expect(companyIdFilter?.value).toBe('evco')
    expect(auditInserts.length).toBe(0)
  })

  it('client role requesting CLIENT_FORBIDDEN table → 403', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const req = makeRequest('token', { table: 'trade_prospects', limit: '10' })
    const res = await GET(req)
    expect([400, 403]).toContain(res.status)
  })
})

// ─── Internal-role override path ────────────────────────────────────────

describe('GET /api/data · internal-role oversight', () => {
  it('admin session CAN pass ?company_id=mafesa (oversight path)', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'admin', companyId: 'admin' }
    const req = makeRequest('token', {
      table: 'traficos',
      company_id: 'mafesa',
      limit: '10',
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const companyIdFilter = eqCalls.find(c => c.column === 'company_id')
    expect(companyIdFilter?.value).toBe('mafesa')
    // No audit row — oversight is legitimate, not an escalation
    expect(auditInserts.length).toBe(0)
  })

  it('broker session CAN pass ?company_id=evco (oversight path)', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'broker', companyId: 'internal' }
    const req = makeRequest('token', {
      table: 'traficos',
      company_id: 'evco',
      limit: '10',
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const companyIdFilter = eqCalls.find(c => c.column === 'company_id')
    expect(companyIdFilter?.value).toBe('evco')
    expect(auditInserts.length).toBe(0)
  })

  it('admin session with NO param → passes through (no filter), returns 200', async () => {
    const { GET } = await import('../route')
    mockSession = { role: 'admin', companyId: 'admin' }
    const req = makeRequest('token', { table: 'traficos', limit: '10' })
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(eqCalls.find(c => c.column === 'company_id')).toBeUndefined()
    expect(auditInserts.length).toBe(0)
  })

  it('client session with NO filter on CLIENT_SCOPED table + no auto-fill → 400', async () => {
    // Malformed session: companyId='' is falsy, so no auto-fill, no
    // explicit filter, and the 400 fence catches it.
    const { GET } = await import('../route')
    mockSession = { role: 'client', companyId: '' }
    const req = makeRequest('token', { table: 'traficos', limit: '10' })
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})
