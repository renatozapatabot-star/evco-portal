/**
 * Session-guard contract tests.
 *
 * These are the load-bearing guards every /api/* handler calls.
 * The tests lock:
 *   - { session, error } shape is honored in both success + failure
 *   - Canonical 401 payload matches the repo-wide `{ data, error }` contract
 *   - Role gates reject correctly (no escalation paths)
 *   - "no session" and "wrong role" return the same 401 (no endpoint-leak)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any */

let mockSession: { companyId: string; role: string; expiresAt: number } | null = null

vi.mock('@/lib/session', () => ({
  verifySession: async (_token: string) => mockSession,
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (_name: string) => ({ value: 'mock-session-token' }),
  }),
}))

beforeEach(() => {
  mockSession = null
})

describe('requireAnySession', () => {
  it('returns the session when authenticated', async () => {
    const { requireAnySession } = await import('../session-guards')
    mockSession = { companyId: 'evco', role: 'client', expiresAt: Date.now() + 1000 }
    const result = await requireAnySession()
    expect(result.error).toBeNull()
    expect(result.session).toEqual(mockSession)
  })

  it('returns a 401 response when no session', async () => {
    const { requireAnySession } = await import('../session-guards')
    const result = await requireAnySession()
    expect(result.session).toBeNull()
    expect(result.error).not.toBeNull()
    expect(result.error!.status).toBe(401)
    const body = await result.error!.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(body.data).toBeNull()
  })
})

describe('requireAdminSession', () => {
  it('accepts admin role', async () => {
    const { requireAdminSession } = await import('../session-guards')
    mockSession = { companyId: 'admin', role: 'admin', expiresAt: Date.now() + 1000 }
    const result = await requireAdminSession()
    expect(result.error).toBeNull()
    expect(result.session?.role).toBe('admin')
  })

  it('accepts broker role', async () => {
    const { requireAdminSession } = await import('../session-guards')
    mockSession = { companyId: 'internal', role: 'broker', expiresAt: Date.now() + 1000 }
    const result = await requireAdminSession()
    expect(result.error).toBeNull()
    expect(result.session?.role).toBe('broker')
  })

  it('rejects client role with 401 (not 403 — no endpoint-leak)', async () => {
    const { requireAdminSession } = await import('../session-guards')
    mockSession = { companyId: 'evco', role: 'client', expiresAt: Date.now() + 1000 }
    const result = await requireAdminSession()
    expect(result.session).toBeNull()
    expect(result.error!.status).toBe(401)
    const body = await result.error!.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
    expect(body.error.message).toMatch(/admin\/broker/)
  })

  it('rejects operator role with 401', async () => {
    const { requireAdminSession } = await import('../session-guards')
    mockSession = { companyId: 'internal', role: 'operator', expiresAt: Date.now() + 1000 }
    const result = await requireAdminSession()
    expect(result.session).toBeNull()
    expect(result.error!.status).toBe(401)
  })

  it('rejects when no session with the same 401 (no endpoint-leak)', async () => {
    const { requireAdminSession } = await import('../session-guards')
    const result = await requireAdminSession()
    expect(result.session).toBeNull()
    expect(result.error!.status).toBe(401)
    const body = await result.error!.json()
    expect(body.error.code).toBe('UNAUTHORIZED')
  })
})

describe('requireClientSession', () => {
  it('accepts client role', async () => {
    const { requireClientSession } = await import('../session-guards')
    mockSession = { companyId: 'evco', role: 'client', expiresAt: Date.now() + 1000 }
    const result = await requireClientSession()
    expect(result.error).toBeNull()
    expect(result.session?.role).toBe('client')
  })

  it('rejects admin role (client-only gate)', async () => {
    const { requireClientSession } = await import('../session-guards')
    mockSession = { companyId: 'admin', role: 'admin', expiresAt: Date.now() + 1000 }
    const result = await requireClientSession()
    expect(result.session).toBeNull()
    expect(result.error!.status).toBe(401)
  })

  it('rejects broker role', async () => {
    const { requireClientSession } = await import('../session-guards')
    mockSession = { companyId: 'internal', role: 'broker', expiresAt: Date.now() + 1000 }
    const result = await requireClientSession()
    expect(result.session).toBeNull()
  })
})

describe('requireOneOf', () => {
  it('accepts when role is in the allowlist', async () => {
    const { requireOneOf } = await import('../session-guards')
    mockSession = { companyId: 'internal', role: 'operator', expiresAt: Date.now() + 1000 }
    const result = await requireOneOf(['admin', 'broker', 'operator'])
    expect(result.error).toBeNull()
    expect(result.session?.role).toBe('operator')
  })

  it('rejects when role is NOT in the allowlist', async () => {
    const { requireOneOf } = await import('../session-guards')
    mockSession = { companyId: 'evco', role: 'client', expiresAt: Date.now() + 1000 }
    const result = await requireOneOf(['admin', 'broker', 'operator'])
    expect(result.session).toBeNull()
    expect(result.error!.status).toBe(401)
  })

  it('propagates the description into the error message', async () => {
    const { requireOneOf } = await import('../session-guards')
    const result = await requireOneOf(['admin'], 'admin approval queue')
    const body = await result.error!.json()
    expect(body.error.message).toBe('admin approval queue')
  })
})

describe('unauthorized + forbidden response helpers', () => {
  it('unauthorized() returns 401 with canonical shape', async () => {
    const { unauthorized } = await import('../session-guards')
    const res = unauthorized('custom message')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body).toEqual({
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'custom message' },
    })
  })

  it('forbidden() returns 403 with canonical shape', async () => {
    const { forbidden } = await import('../session-guards')
    const res = forbidden()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })
})
