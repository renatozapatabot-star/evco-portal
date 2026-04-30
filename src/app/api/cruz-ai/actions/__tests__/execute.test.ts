/**
 * Contract + tenant-isolation fence for POST /api/cruz-ai/actions/execute.
 *
 * The route is internal-only (operator/admin/broker) and drives the
 * downstream side-effect of a committed action. Contract:
 *   - missing session → 401
 *   - client-role session → 403 (not an operator surface)
 *   - unknown action id → 404
 *   - proposed action → 409 (not yet authorized)
 *   - cancelled action → 409 (terminal)
 *   - already-executed action → 200 with already:true
 *   - committed action, executor ok → 200 with status=executed
 *   - committed action, executor fails → 500 with execute_failed marker
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any */

let mockSession: any = null
let executorOutcome: any = null
let rowToLoad: any = null
let markExecutedOutcome: any = null
let markExecuteFailedOutcome: any = null

const runExecutorCalls: Array<{ actionId: string; executorRole: string }> = []
const markExecutedCalls: Array<{ actionId: string; executorRole: string }> = []
const markFailedCalls: Array<{ actionId: string; errorEs: string }> = []

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
  getActionAdmin: async () => rowToLoad,
  markExecuted: async (_sb: unknown, actionId: string, input: { executorRole: string }) => {
    markExecutedCalls.push({ actionId, executorRole: input.executorRole })
    return markExecutedOutcome
  },
  markExecuteFailed: async (
    _sb: unknown,
    actionId: string,
    input: { errorEs: string },
  ) => {
    markFailedCalls.push({ actionId, errorEs: input.errorEs })
    return markExecuteFailedOutcome
  },
}))

vi.mock('@/lib/aguila/action-executor', () => ({
  runExecutor: async (action: any, ctx: any) => {
    runExecutorCalls.push({ actionId: action.id, executorRole: ctx.executorRole })
    return executorOutcome
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
  executorOutcome = null
  rowToLoad = null
  markExecutedOutcome = null
  markExecuteFailedOutcome = null
  runExecutorCalls.length = 0
  markExecutedCalls.length = 0
  markFailedCalls.length = 0
})

describe('POST /api/cruz-ai/actions/execute', () => {
  it('401 when session is missing', async () => {
    const { POST } = await import('../execute/route')
    const res = await POST(makeRequest(null, { actionId: 'a1' }))
    expect(res.status).toBe(401)
  })

  it('403 when session role is client', async () => {
    mockSession = { companyId: 'evco', role: 'client' }
    const { POST } = await import('../execute/route')
    const res = await POST(makeRequest('token', { actionId: 'a1' }))
    expect(res.status).toBe(403)
  })

  it('400 when actionId is missing', async () => {
    mockSession = { companyId: 'admin', role: 'operator' }
    const { POST } = await import('../execute/route')
    const res = await POST(makeRequest('token', {}))
    expect(res.status).toBe(400)
  })

  it('404 when the action is not found', async () => {
    mockSession = { companyId: 'admin', role: 'operator' }
    rowToLoad = null
    const { POST } = await import('../execute/route')
    const res = await POST(makeRequest('token', { actionId: 'missing' }))
    expect(res.status).toBe(404)
  })

  it('200 with already:true when the action was already executed', async () => {
    mockSession = { companyId: 'admin', role: 'operator' }
    rowToLoad = {
      id: 'a1',
      status: 'executed',
      kind: 'flag_shipment',
      executed_at: '2026-04-22T20:00:00Z',
      execute_result: { thread_id: 't1' },
    }
    const { POST } = await import('../execute/route')
    const res = await POST(makeRequest('token', { actionId: 'a1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.already).toBe(true)
    expect(runExecutorCalls).toHaveLength(0)
  })

  it('409 when the action is still in proposed state', async () => {
    mockSession = { companyId: 'admin', role: 'operator' }
    rowToLoad = { id: 'a1', status: 'proposed', kind: 'flag_shipment' }
    const { POST } = await import('../execute/route')
    const res = await POST(makeRequest('token', { actionId: 'a1' }))
    expect(res.status).toBe(409)
  })

  it('409 when the action was cancelled', async () => {
    mockSession = { companyId: 'admin', role: 'operator' }
    rowToLoad = { id: 'a1', status: 'cancelled', kind: 'flag_shipment' }
    const { POST } = await import('../execute/route')
    const res = await POST(makeRequest('token', { actionId: 'a1' }))
    expect(res.status).toBe(409)
  })

  it('200 with executed status when the downstream executor succeeds', async () => {
    mockSession = { companyId: 'admin', role: 'admin' }
    rowToLoad = {
      id: 'a1',
      status: 'committed',
      kind: 'flag_shipment',
      company_id: 'evco',
    }
    executorOutcome = { ok: true, result: { thread_id: 't1' } }
    markExecutedOutcome = {
      ok: true,
      already: false,
      action: {
        id: 'a1',
        status: 'executed',
        kind: 'flag_shipment',
        executed_at: '2026-04-22T20:01:00Z',
        execute_result: { thread_id: 't1' },
      },
    }

    const { POST } = await import('../execute/route')
    const res = await POST(makeRequest('token', { actionId: 'a1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.status).toBe('executed')
    expect(body.data.execute_result.thread_id).toBe('t1')
    expect(runExecutorCalls).toEqual([{ actionId: 'a1', executorRole: 'admin' }])
    expect(markExecutedCalls).toHaveLength(1)
    expect(markFailedCalls).toHaveLength(0)
  })

  it('500 and marks execute_failed when the executor reports an error', async () => {
    mockSession = { companyId: 'admin', role: 'operator' }
    rowToLoad = {
      id: 'a1',
      status: 'committed',
      kind: 'flag_shipment',
      company_id: 'evco',
    }
    executorOutcome = { ok: false, errorEs: 'mensajeria no disponible' }
    markExecuteFailedOutcome = {
      ok: true,
      already: false,
      action: {
        id: 'a1',
        status: 'execute_failed',
        kind: 'flag_shipment',
        execute_error_es: 'mensajeria no disponible',
      },
    }

    const { POST } = await import('../execute/route')
    const res = await POST(makeRequest('token', { actionId: 'a1' }))
    expect(res.status).toBe(500)
    expect(markFailedCalls).toEqual([{ actionId: 'a1', errorEs: 'mensajeria no disponible' }])
    expect(markExecutedCalls).toHaveLength(0)
  })

  it('allows retry on execute_failed (treats it like committed)', async () => {
    mockSession = { companyId: 'admin', role: 'broker' }
    rowToLoad = {
      id: 'a1',
      status: 'execute_failed',
      kind: 'open_oca_request',
      company_id: 'evco',
    }
    executorOutcome = { ok: true, result: { thread_id: 't9' } }
    markExecutedOutcome = {
      ok: true,
      already: false,
      action: {
        id: 'a1',
        status: 'executed',
        kind: 'open_oca_request',
        executed_at: '2026-04-22T20:05:00Z',
        execute_result: { thread_id: 't9' },
      },
    }

    const { POST } = await import('../execute/route')
    const res = await POST(makeRequest('token', { actionId: 'a1' }))
    expect(res.status).toBe(200)
    expect(runExecutorCalls).toEqual([{ actionId: 'a1', executorRole: 'broker' }])
  })
})
