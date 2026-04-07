import { describe, it, expect, vi, beforeAll } from 'vitest'

// Mock the crypto API for testing
beforeAll(() => {
  // Ensure SESSION_SECRET is set for tests
  process.env.SESSION_SECRET = 'test-secret-key-for-vitest-only'
})

describe('session', () => {
  let signSession: typeof import('../session').signSession
  let verifySession: typeof import('../session').verifySession

  beforeAll(async () => {
    const mod = await import('../session')
    signSession = mod.signSession
    verifySession = mod.verifySession
  })

  it('signSession returns a token with payload and signature', async () => {
    const token = await signSession('evco', 'client', 3600)
    expect(token).toBeTruthy()
    expect(token).toContain('evco:client:')
    expect(token).toContain('.')
  })

  it('verifySession validates a fresh token', async () => {
    const token = await signSession('evco', 'client', 3600)
    const session = await verifySession(token)
    expect(session).not.toBeNull()
    expect(session?.companyId).toBe('evco')
    expect(session?.role).toBe('client')
    expect(session?.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('verifySession rejects tampered tokens', async () => {
    const token = await signSession('evco', 'client', 3600)
    // Tamper with company ID
    const tampered = token.replace('evco', 'mafesa')
    const session = await verifySession(tampered)
    expect(session).toBeNull()
  })

  it('verifySession rejects expired tokens', async () => {
    // Sign with 0 seconds (immediately expired)
    const token = await signSession('evco', 'client', -1)
    const session = await verifySession(token)
    expect(session).toBeNull()
  })

  it('verifySession rejects empty tokens', async () => {
    expect(await verifySession('')).toBeNull()
  })

  it('verifySession rejects tokens without dot separator', async () => {
    expect(await verifySession('nodot')).toBeNull()
  })

  it('verifySession rejects malformed payload', async () => {
    expect(await verifySession('only:two.parts')).toBeNull()
  })

  it('supports different roles', async () => {
    const adminToken = await signSession('internal', 'admin', 3600)
    const brokerToken = await signSession('internal', 'broker', 3600)

    const adminSession = await verifySession(adminToken)
    const brokerSession = await verifySession(brokerToken)

    expect(adminSession?.role).toBe('admin')
    expect(brokerSession?.role).toBe('broker')
  })

  it('supports multi-tenant company IDs', async () => {
    const evcoToken = await signSession('evco', 'client', 3600)
    const mafesaToken = await signSession('mafesa', 'client', 3600)

    const evcoSession = await verifySession(evcoToken)
    const mafesaSession = await verifySession(mafesaToken)

    expect(evcoSession?.companyId).toBe('evco')
    expect(mafesaSession?.companyId).toBe('mafesa')
  })
})
