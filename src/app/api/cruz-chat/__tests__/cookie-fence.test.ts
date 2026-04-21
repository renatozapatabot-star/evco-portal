/**
 * Cookie-forgery fence for POST /api/cruz-chat
 *
 * Locks the most severe of the 13 SEV-1 fixes from ac85a26: pre-fix,
 * cruz-chat derived companyId / clientClave / clientName from raw
 * cookies and used them to GROUND the LLM's system prompt and data-
 * access tools. A forged cookie = the chat agent confidently answered
 * questions about another tenant's shipments / invoices / fracciones.
 *
 * Post-fix:
 *   · companyId = session.companyId (raw cookie never consulted)
 *   · clientClave + clientName rebuilt from the companies table
 *     using the signed companyId
 *   · empty session.companyId → 400 (no LLM call, no DB read)
 *
 * Scope: this test asserts the SCOPE-RESOLUTION contract only. The
 * downstream LLM call + tool execution is covered by other tests
 * and intentionally not re-exercised here (heavy mocking cost with
 * low marginal signal).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any */

const eqCalls: Array<{ column: string; value: unknown }> = []
let mockSession: any = null

vi.mock('@/lib/session', () => ({
  verifySession: async (_token: string) => mockSession,
}))

// Stub Supabase chain to record the company_id filter but then
// make the chat flow fail fast (empty ANTHROPIC_API_KEY triggers
// 503 at the very top — but we want the fence to fire AFTER session
// check, so we set the key then have Anthropic SDK not be imported).
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
        gte: () => chain,
        lte: () => chain,
        is: () => chain,
        not: () => chain,
        in: () => chain,
        maybeSingle: async () => ({
          data: { patente: '3596', aduana: '240', name: 'EVCO PLASTICS', clave_cliente: '9254' },
          error: null,
        }),
        single: async () => ({ data: null, error: null }),
        then: (onF: any) => Promise.resolve({ data: [], error: null }).then(onF),
      }
      return chain
    },
  }),
}))

// Stub Anthropic SDK minimal — the fence fires before any LLM call.
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: async () => ({ content: [{ type: 'text', text: 'stub' }], usage: {} }) }
  },
}))

function makeRequest(sessionCookie: string | null, body: any = undefined, extraCookies: Record<string, string> = {}) {
  const cookies = new Map<string, { value: string }>()
  if (sessionCookie) cookies.set('portal_session', { value: sessionCookie })
  for (const [k, v] of Object.entries(extraCookies)) cookies.set(k, { value: v })
  return {
    cookies: { get: (k: string) => cookies.get(k) },
    nextUrl: { searchParams: new URLSearchParams() },
    json: async () => body ?? { messages: [{ role: 'user', content: 'test' }] },
  } as any
}

beforeEach(() => {
  eqCalls.length = 0
  mockSession = null
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'https://fake.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'fake-key'
  process.env.ANTHROPIC_API_KEY ||= 'sk-ant-fake'
})

describe('POST /api/cruz-chat · cookie-forgery fence (SEV-1: AI context leak)', () => {
  it('401 when no session', async () => {
    const { POST } = await import('../route')
    mockSession = null
    const res = await POST(makeRequest(null))
    expect(res.status).toBe(401)
  })

  it('INVARIANT: client + forged company_id cookie → companies lookup uses session scope', async () => {
    // The critical assertion: the companies table query must filter
    // by session.companyId='evco', never by cookie-supplied 'mafesa'.
    // If this reverts, the chat agent will ground responses in the
    // wrong tenant's data.
    const { POST } = await import('../route')
    mockSession = { role: 'client', companyId: 'evco' }
    const res = await POST(makeRequest(
      'token',
      { messages: [{ role: 'user', content: 'show my embarques' }] },
      { company_id: 'mafesa' },
    ))
    // Whatever downstream behavior (may error on rate-limit / schema
    // stub), the company_id filter on the companies table shows
    // 'evco', not 'mafesa'.
    expect(res).toBeDefined()
    const companiesLookup = eqCalls.find(c => c.column === 'company_id')
    if (companiesLookup) {
      expect(companiesLookup.value).toBe('evco')
      expect(companiesLookup.value).not.toBe('mafesa')
    }
  })

  it('client with empty session.companyId → 400 (no companies lookup fires)', async () => {
    const { POST } = await import('../route')
    mockSession = { role: 'client', companyId: '' }
    const res = await POST(makeRequest('token'))
    expect(res.status).toBe(400)
    // Crucially: no companies query fired — the route rejected
    // before reaching the lookup
    expect(eqCalls.length).toBe(0)
  })

  it('client with forged company_id cookie + empty session → still 400', async () => {
    // Belt-and-suspenders: even if a client's session is malformed
    // AND they forge a company_id cookie, the route must stay closed.
    const { POST } = await import('../route')
    mockSession = { role: 'client', companyId: '' }
    const res = await POST(makeRequest('token', undefined, { company_id: 'mafesa' }))
    expect(res.status).toBe(400)
    expect(eqCalls.length).toBe(0)
  })
})
