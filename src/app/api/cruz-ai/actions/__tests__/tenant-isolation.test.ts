/**
 * Tenant-isolation + auth fence for POST /api/cruz-ai/actions/{commit,cancel}.
 *
 * The routes write state changes to `agent_actions`. A forged action_id
 * from another tenant MUST resolve to 404, and no session MUST be 401.
 * These contracts are SEV-1 (cross-tenant write = regulatory violation).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any */

let mockSession: any = null
const commitCalls: Array<{ companyId: string; actionId: string }> = []
const cancelCalls: Array<{ companyId: string; actionId: string; reasonEs?: string }> = []
let commitResponse: any = null
let cancelResponse: any = null

vi.mock('@/lib/session', () => ({
  verifySession: async () => mockSession,
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({}),
}))

vi.mock('@/lib/operator-actions', () => ({
  logOperatorAction: async () => {},
}))

vi.mock('@/lib/aguila/actions', () => ({
  commitAction: async (_sb: unknown, companyId: string, actionId: string) => {
    commitCalls.push({ companyId, actionId })
    return commitResponse
  },
  cancelAction: async (_sb: unknown, companyId: string, actionId: string, reasonEs?: string) => {
    cancelCalls.push({ companyId, actionId, reasonEs })
    return cancelResponse
  },
}))

function makeRequest(sessionCookie: string | null, body: unknown) {
  const cookies = new Map<string, { value: string }>()
  if (sessionCookie) cookies.set('portal_session', { value: sessionCookie })
  return {
    cookies: { get: (k: string) => cookies.get(k) ?? undefined },
    json: async () => body,
  } as any
}

beforeEach(() => {
  mockSession = null
  commitCalls.length = 0
  cancelCalls.length = 0
  commitResponse = null
  cancelResponse = null
})

describe('POST /api/cruz-ai/actions/commit', () => {
  it('401 when session is missing', async () => {
    const { POST } = await import('../commit/route')
    const res = await POST(makeRequest(null, { actionId: 'a1' }))
    expect(res.status).toBe(401)
  })

  it('400 when actionId is missing', async () => {
    mockSession = { companyId: 'evco', role: 'client' }
    const { POST } = await import('../commit/route')
    const res = await POST(makeRequest('token', {}))
    expect(res.status).toBe(400)
  })

  it('forwards session.companyId to commitAction (never reads from body)', async () => {
    mockSession = { companyId: 'evco', role: 'client' }
    commitResponse = {
      ok: true,
      already: false,
      action: { id: 'a1', kind: 'flag_shipment', status: 'committed', committed_at: 'now' },
    }
    const { POST } = await import('../commit/route')
    // Attempt to override via body — route MUST ignore it.
    await POST(makeRequest('token', { actionId: 'a1', companyId: 'mafesa' }))
    expect(commitCalls).toEqual([{ companyId: 'evco', actionId: 'a1' }])
  })

  it('returns 404 on not_found (cross-tenant forged action_id)', async () => {
    mockSession = { companyId: 'evco', role: 'client' }
    commitResponse = { ok: false, error: 'not_found' }
    const { POST } = await import('../commit/route')
    const res = await POST(makeRequest('token', { actionId: 'foreign-id' }))
    expect(res.status).toBe(404)
  })

  it('returns 409 on invalid_transition (already cancelled)', async () => {
    mockSession = { companyId: 'evco', role: 'client' }
    commitResponse = { ok: false, error: 'invalid_transition' }
    const { POST } = await import('../commit/route')
    const res = await POST(makeRequest('token', { actionId: 'a1' }))
    expect(res.status).toBe(409)
  })

  it('returns 200 with already:true on idempotent commit', async () => {
    mockSession = { companyId: 'evco', role: 'client' }
    commitResponse = {
      ok: true,
      already: true,
      action: { id: 'a1', kind: 'flag_shipment', status: 'committed', committed_at: 'now' },
    }
    const { POST } = await import('../commit/route')
    const res = await POST(makeRequest('token', { actionId: 'a1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.already).toBe(true)
  })
})

describe('POST /api/cruz-ai/actions/cancel', () => {
  it('401 when session is missing', async () => {
    const { POST } = await import('../cancel/route')
    const res = await POST(makeRequest(null, { actionId: 'a1' }))
    expect(res.status).toBe(401)
  })

  it('400 when actionId is missing', async () => {
    mockSession = { companyId: 'evco', role: 'client' }
    const { POST } = await import('../cancel/route')
    const res = await POST(makeRequest('token', {}))
    expect(res.status).toBe(400)
  })

  it('forwards session.companyId to cancelAction and trims reason', async () => {
    mockSession = { companyId: 'evco', role: 'client' }
    cancelResponse = {
      ok: true,
      already: false,
      action: { id: 'a1', kind: 'flag_shipment', status: 'cancelled', cancelled_at: 'now' },
    }
    const { POST } = await import('../cancel/route')
    await POST(
      makeRequest('token', {
        actionId: 'a1',
        reasonEs: '  usuario canceló  ',
        companyId: 'mafesa',
      }),
    )
    expect(cancelCalls).toEqual([
      { companyId: 'evco', actionId: 'a1', reasonEs: 'usuario canceló' },
    ])
  })

  it('returns 404 on not_found', async () => {
    mockSession = { companyId: 'evco', role: 'client' }
    cancelResponse = { ok: false, error: 'not_found' }
    const { POST } = await import('../cancel/route')
    const res = await POST(makeRequest('token', { actionId: 'foreign-id' }))
    expect(res.status).toBe(404)
  })

  it('returns 409 when trying to cancel a committed action', async () => {
    mockSession = { companyId: 'evco', role: 'client' }
    cancelResponse = { ok: false, error: 'invalid_transition' }
    const { POST } = await import('../cancel/route')
    const res = await POST(makeRequest('token', { actionId: 'a1' }))
    expect(res.status).toBe(409)
  })
})
