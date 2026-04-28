/**
 * Cookie-fence sweep — P0-A2 regression guard for 10 routes flagged in
 * ~/Desktop/audit-tenant-isolation-2026-04-28.md as reading
 * `request.cookies.get('company_id')` directly instead of going through
 * the HMAC-verified `session.companyId` (or the canonical
 * `resolveTenantScope` helper).
 *
 * Threat model: client-role attacker logs in as their own tenant, then
 * sets `document.cookie = 'company_id=mafesa; path=/'` in dev tools.
 * Pre-fix, the next call to any of the 10 routes returned the OTHER
 * tenant's data, plotted as if it were theirs.
 *
 * Strategy: two layers.
 *
 *   Layer 1 (static · always runs) — assert each affected route file
 *     no longer reads `request.cookies.get('company_id')` AND
 *     imports / calls `resolveTenantScope`. This catches regressions
 *     even when behavioral mocks would be brittle (PDF rendering,
 *     LLM calls, multi-table joins).
 *
 *   Layer 2 (behavioral · 4 critical routes) — exercise each route
 *     with a forged `company_id` cookie + valid client session and
 *     assert the Supabase `.eq('company_id', X)` filter is applied
 *     with X = session.companyId, NOT cookie.value. Heavy mocks
 *     used; we only re-assert the scope-resolution contract.
 *
 * If Layer 1 fails for a future-added route: convert the cookie read
 * to `resolveTenantScope(session, request)`. Reference fix:
 * `src/app/api/risk-scores/route.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO_ROOT = process.cwd()
const COOKIE_FENCED_ROUTES = [
  'src/app/api/risk-scores/route.ts',
  'src/app/api/chat/route.ts',
  'src/app/api/cockpit-insight/route.ts',
  'src/app/api/oca/route.ts',
  'src/app/api/oca/[id]/pdf/route.ts',
  'src/app/api/pedimento-pdf/route.ts',
  'src/app/api/reportes-pdf/route.ts',
  'src/app/api/status-summary/route.ts',
  'src/app/api/status-sentence/route.ts',
  'src/app/api/carriers/route.ts',
] as const

// ─────────────────────────────────────────────────────────────────────
// Layer 1 — static regression guard (no mocks, always runs)
// ─────────────────────────────────────────────────────────────────────

describe('cookie-fence-sweep · static regression guard', () => {
  for (const relPath of COOKIE_FENCED_ROUTES) {
    it(`${relPath} does not read raw company_id cookie`, () => {
      const src = readFileSync(join(REPO_ROOT, relPath), 'utf8')

      // Match every variant the audit found:
      //   request.cookies.get('company_id')
      //   req.cookies.get('company_id')
      //   cookies().get('company_id')
      const rawCookieRead =
        /(?:request|req)\.cookies\.get\(['"]company_id['"]\)|cookies\(\)\.get\(['"]company_id['"]\)/.test(
          src,
        )
      expect(
        rawCookieRead,
        `${relPath} still reads company_id from raw cookie. Replace with resolveTenantScope(session, request).`,
      ).toBe(false)
    })

    it(`${relPath} imports + calls resolveTenantScope`, () => {
      const src = readFileSync(join(REPO_ROOT, relPath), 'utf8')
      expect(
        src.includes("from '@/lib/api/tenant-scope'") || src.includes('from "@/lib/api/tenant-scope"'),
        `${relPath} should import resolveTenantScope from @/lib/api/tenant-scope`,
      ).toBe(true)
      expect(
        src.includes('resolveTenantScope('),
        `${relPath} should call resolveTenantScope(session, request)`,
      ).toBe(true)
    })

    it(`${relPath} also does not read company_clave / company_name from raw cookies`, () => {
      // Per-audit V3: chat, reportes-pdf, pedimento-pdf, status-sentence
      // also pulled clave/name from forgeable cookies. The fix rebuilds
      // them from `companies` using the verified companyId.
      const src = readFileSync(join(REPO_ROOT, relPath), 'utf8')
      const claveCookie =
        /(?:request|req)\.cookies\.get\(['"]company_clave['"]\)|cookies\(\)\.get\(['"]company_clave['"]\)/.test(
          src,
        )
      const nameCookie =
        /(?:request|req)\.cookies\.get\(['"]company_name['"]\)|cookies\(\)\.get\(['"]company_name['"]\)/.test(
          src,
        )
      expect(
        claveCookie,
        `${relPath} still reads company_clave from raw cookie. Resolve from companies table via verified companyId.`,
      ).toBe(false)
      expect(
        nameCookie,
        `${relPath} still reads company_name from raw cookie. Resolve from companies table via verified companyId.`,
      ).toBe(false)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────
// Layer 2 — behavioral spot-check on 4 highest-impact routes
// ─────────────────────────────────────────────────────────────────────
//
// We test the SCOPE-RESOLUTION contract: with a valid client session
// for tenant 'evco' AND a forged `company_id=mafesa` cookie, the
// supabase `.eq('company_id', X)` call uses 'evco', never 'mafesa'.
// Heavy mocking — downstream behavior (LLM, PDF) is not exercised.

/* eslint-disable @typescript-eslint/no-explicit-any */

const eqCalls: Array<{ table: string; column: string; value: unknown }> = []
let mockSession: any = null
let currentTable: string = ''

vi.mock('@/lib/session', () => ({
  verifySession: async (_token: string) => mockSession,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      currentTable = table
      const chain: any = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          eqCalls.push({ table: currentTable, column: col, value: val })
          return chain
        },
        order: () => chain,
        limit: () => chain,
        gte: () => chain,
        lte: () => chain,
        is: () => chain,
        not: () => chain,
        in: () => chain,
        ilike: () => chain,
        single: async () => ({ data: null, error: null }),
        maybeSingle: async () => ({
          data: { name: 'EVCO Plastics', clave_cliente: '9254', rfc: 'EVC0123456ABC' },
          error: null,
        }),
        then: (onF: any) => Promise.resolve({ data: [], error: null }).then(onF),
        insert: () => ({ then: (onF: any) => Promise.resolve({}).then(onF) }),
      }
      return chain
    },
  }),
}))

function makeRequest(
  sessionCookie: string | null,
  forgedCookies: Record<string, string> = {},
  searchParams: Record<string, string> = {},
  body: unknown = undefined,
) {
  const cookies = new Map<string, { value: string }>()
  if (sessionCookie) cookies.set('portal_session', { value: sessionCookie })
  for (const [k, v] of Object.entries(forgedCookies)) cookies.set(k, { value: v })
  const sp = new URLSearchParams(searchParams)
  return {
    cookies: { get: (k: string) => cookies.get(k) },
    nextUrl: { searchParams: sp },
    headers: { get: (_k: string) => '' },
    json: async () => body ?? { messages: [{ role: 'user', content: 'test' }] },
  } as any
}

beforeEach(() => {
  eqCalls.length = 0
  mockSession = null
  currentTable = ''
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'fake-key'
  process.env.ANTHROPIC_API_KEY ||= 'sk-ant-fake'
})

describe('cookie-fence-sweep · behavioral · /api/risk-scores', () => {
  it('forged company_id cookie cannot escape session.companyId for client role', async () => {
    const { GET } = await import('../risk-scores/route')
    mockSession = { role: 'client', companyId: 'evco' }
    await GET(makeRequest('token', { company_id: 'mafesa' }))

    const tenantFilters = eqCalls.filter(c => c.column === 'company_id')
    expect(tenantFilters.length).toBeGreaterThan(0)
    for (const f of tenantFilters) {
      expect(f.value).toBe('evco')
      expect(f.value).not.toBe('mafesa')
    }
  })

  it('client with empty session.companyId → 400 (no DB read)', async () => {
    const { GET } = await import('../risk-scores/route')
    mockSession = { role: 'client', companyId: '' }
    const res = await GET(makeRequest('token', { company_id: 'mafesa' }))
    expect(res.status).toBe(400)
    const tenantFilters = eqCalls.filter(c => c.column === 'company_id')
    expect(tenantFilters.length).toBe(0)
  })

  it('no session → 401', async () => {
    const { GET } = await import('../risk-scores/route')
    mockSession = null
    const res = await GET(makeRequest(null))
    expect(res.status).toBe(401)
  })
})

describe('cookie-fence-sweep · behavioral · /api/status-summary', () => {
  it('forged company_id cookie cannot escape session.companyId', async () => {
    const { GET } = await import('../status-summary/route')
    mockSession = { role: 'client', companyId: 'evco' }
    await GET(makeRequest('token', { company_id: 'mafesa' }))
    const tenantFilters = eqCalls.filter(c => c.column === 'company_id')
    expect(tenantFilters.length).toBeGreaterThan(0)
    for (const f of tenantFilters) {
      expect(f.value).toBe('evco')
      expect(f.value).not.toBe('mafesa')
    }
  })

  it('empty session.companyId → 400', async () => {
    const { GET } = await import('../status-summary/route')
    mockSession = { role: 'client', companyId: '' }
    const res = await GET(makeRequest('token', { company_id: 'mafesa' }))
    expect(res.status).toBe(400)
  })
})

describe('cookie-fence-sweep · behavioral · /api/carriers', () => {
  it('forged company_id cookie cannot escape session.companyId', async () => {
    const { GET } = await import('../carriers/route')
    mockSession = { role: 'client', companyId: 'evco' }
    await GET(makeRequest('token', { company_id: 'mafesa' }))
    const tenantFilters = eqCalls.filter(c => c.column === 'company_id')
    expect(tenantFilters.length).toBeGreaterThan(0)
    for (const f of tenantFilters) {
      expect(f.value).toBe('evco')
      expect(f.value).not.toBe('mafesa')
    }
  })
})

describe('cookie-fence-sweep · behavioral · /api/cockpit-insight', () => {
  it('forged company_id cookie cannot escape session.companyId', async () => {
    const { GET } = await import('../cockpit-insight/route')
    mockSession = { role: 'client', companyId: 'evco' }
    await GET(makeRequest('token', { company_id: 'mafesa' }))
    const tenantFilters = eqCalls.filter(c => c.column === 'company_id')
    // Client role hits the `if (!isInternal) trafQuery = trafQuery.eq('company_id', companyId)` branch
    expect(tenantFilters.length).toBeGreaterThan(0)
    for (const f of tenantFilters) {
      expect(f.value).toBe('evco')
      expect(f.value).not.toBe('mafesa')
    }
  })
})
