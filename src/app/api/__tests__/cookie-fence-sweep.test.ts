/**
 * Cookie-fence sweep — P0-A2 + P0-A7 regression guard for 28 routes
 * that previously read tenant identifiers from raw, unsigned cookies
 * (`company_id` / `company_clave` / `company_name` / `company_rfc`)
 * instead of going through the HMAC-verified `session.companyId` or
 * the canonical `resolveTenantScope` helper.
 *
 * P0-A2 (commit 2026-04-28) covered 10 routes flagged by the audit at
 * ~/Desktop/audit-tenant-isolation-2026-04-28.md.
 *
 * P0-A7 (commit 2026-04-28) covered the additional 18 routes the audit
 * missed — caught by the expanded ratchet in
 * scripts/audit-tenant-isolation.sh that searches every tenant-scoped
 * cookie name (not just company_id).
 *
 * Threat model: client-role attacker logs in as their own tenant, then
 * sets `document.cookie = 'company_id=mafesa; path=/'` in dev tools.
 * Pre-fix, the next call to any flagged route returned the OTHER
 * tenant's data, plotted as if it were theirs.
 *
 * Strategy: two layers.
 *
 *   Layer 1 (static · always runs) — assert each affected route file
 *     no longer reads any tenant-id cookie (company_id, company_clave,
 *     company_name, company_rfc) AND uses `resolveTenantScope` (or has
 *     an explicit `session.role === 'client'` branch that forces
 *     session.companyId). This catches regressions even when
 *     behavioral mocks would be brittle (PDF rendering, LLM calls,
 *     multi-table joins).
 *
 *   Layer 2 (behavioral · 4 representative routes) — exercise each
 *     route with a forged `company_id` cookie + valid client session
 *     and assert the Supabase `.eq('company_id', X)` filter is
 *     applied with X = session.companyId, NOT cookie.value. Heavy
 *     mocks used; we only re-assert the scope-resolution contract.
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
  // P0-A2 (commit 2026-04-28 a81d3b2)
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
  // P0-A7 (this commit) — 18 additional routes the audit missed
  'src/app/api/anexo24-pdf/route.ts',
  'src/app/api/auditoria-pdf/route.ts',
  'src/app/api/executive-summary/route.ts',
  'src/app/api/oca/generate/route.ts',
  'src/app/api/pre-filing-check/route.ts',
  'src/app/api/reportes/kpis/route.ts',
  'src/app/api/reports/anexo-24/generate/route.ts',
  'src/app/api/reports/build/route.ts',
  'src/app/api/reports/export/route.ts',
  'src/app/api/reports/preview/route.ts',
  'src/app/api/search/route.ts',
  'src/app/api/search/advanced/route.ts',
  'src/app/api/search/universal/route.ts',
  'src/app/api/solicitar-documentos/route.ts',
  'src/app/api/subscribe-push/route.ts',
  'src/app/api/usmca/certificates/route.ts',
  'src/app/api/whatsapp/route.ts',
  'src/app/api/whatsapp/webhook/route.ts',
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

    it(`${relPath} defends tenant scope (helper, role-branch, session, or resource lookup)`, () => {
      // Accept any of the four canonical defenses:
      //   1. resolveTenantScope helper (preferred for new code)
      //   2. explicit `isInternal = session.role === 'broker' || 'admin'`
      //      check that uses session.companyId for non-internal callers
      //   3. session.companyId used directly without cookie fallback
      //   4. Resource lookup that derives company_id from a trusted
      //      foreign key (trafico_id, pedimento_id) — the webhook
      //      pattern, since inbound webhooks don't carry a session.
      // The previous, vulnerable shape was reading the cookie value AS
      // the tenant scope — which the first assertion already disallows.
      const src = readFileSync(join(REPO_ROOT, relPath), 'utf8')
      const usesHelper =
        src.includes("from '@/lib/api/tenant-scope'") ||
        src.includes('from "@/lib/api/tenant-scope"')
      const usesIsInternal = /session\.role[\s\S]{0,40}===[\s\S]{0,20}['"](broker|admin|client)['"]/.test(src)
      const usesSessionCompanyId = /session\.companyId/.test(src)
      // Resource-derived: the route looks up company_id from the
      // resource the webhook references (trafico, conversation, etc.)
      const usesResourceLookup = /\.select\(['"][^'"]*company_id[^'"]*['"]\)/.test(src) &&
        /\.eq\(['"](trafico|trafico_id|pedimento|pedimento_id|supplier_phone|cve_trafico)['"]/.test(src)
      expect(
        usesHelper || usesIsInternal || usesSessionCompanyId || usesResourceLookup,
        `${relPath} should defend tenant scope via resolveTenantScope, isInternal role-branch, session.companyId, or resource-derived company_id lookup — none detected.`,
      ).toBe(true)
    })

    it(`${relPath} also does not read company_clave / company_name / company_rfc from raw cookies`, () => {
      // Per-audit V3 + the P0-A7 expansion: routes also pulled
      // clave/name/rfc from forgeable cookies. The fix rebuilds them
      // from `companies` using the verified companyId.
      const src = readFileSync(join(REPO_ROOT, relPath), 'utf8')
      const claveCookie =
        /(?:request|req)\.cookies\.get\(['"]company_clave['"]\)|cookies\(\)\.get\(['"]company_clave['"]\)/.test(
          src,
        )
      const nameCookie =
        /(?:request|req)\.cookies\.get\(['"]company_name['"]\)|cookies\(\)\.get\(['"]company_name['"]\)/.test(
          src,
        )
      const rfcCookie =
        /(?:request|req)\.cookies\.get\(['"]company_rfc['"]\)|cookies\(\)\.get\(['"]company_rfc['"]\)/.test(
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
      expect(
        rfcCookie,
        `${relPath} still reads company_rfc from raw cookie. Resolve from companies table via verified companyId.`,
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
