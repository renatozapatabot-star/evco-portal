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

describe('prospect tokens', () => {
  let signProspectToken: typeof import('../session').signProspectToken
  let verifyProspectToken: typeof import('../session').verifyProspectToken
  let hashProspectToken: typeof import('../session').hashProspectToken
  let verifySession: typeof import('../session').verifySession
  let signSession: typeof import('../session').signSession

  beforeAll(async () => {
    const mod = await import('../session')
    signProspectToken = mod.signProspectToken
    verifyProspectToken = mod.verifyProspectToken
    hashProspectToken = mod.hashProspectToken
    verifySession = mod.verifySession
    signSession = mod.signSession
  })

  it('signs and verifies a 12-char RFC', async () => {
    const token = await signProspectToken('FSA980318AL3', 60 * 60 * 24 * 7)
    expect(token).toContain('prospect:FSA980318AL3:')
    const verified = await verifyProspectToken(token)
    expect(verified?.rfc).toBe('FSA980318AL3')
    expect(verified?.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000))
  })

  it('uppercases lowercase RFC input', async () => {
    const token = await signProspectToken('fsa980318al3', 3600)
    const verified = await verifyProspectToken(token)
    expect(verified?.rfc).toBe('FSA980318AL3')
  })

  it('rejects malformed RFC', async () => {
    await expect(signProspectToken('not-an-rfc')).rejects.toThrow('invalid_rfc')
    await expect(signProspectToken('FOO')).rejects.toThrow('invalid_rfc')
  })

  it('rejects expired prospect tokens', async () => {
    // Sign with negative TTL → already expired at issuance
    const token = await signProspectToken('FSA980318AL3', -10)
    const verified = await verifyProspectToken(token)
    expect(verified).toBeNull()
  })

  it('rejects prospect tokens through the portal-session verifier', async () => {
    const prospectToken = await signProspectToken('FSA980318AL3', 3600)
    const wrongVerify = await verifySession(prospectToken)
    expect(wrongVerify).toBeNull()
  })

  it('rejects portal session tokens through the prospect verifier', async () => {
    const portalToken = await signSession('evco', 'client', 3600)
    const wrongVerify = await verifyProspectToken(portalToken)
    expect(wrongVerify).toBeNull()
  })

  it('hashProspectToken returns 64-char hex', async () => {
    const token = await signProspectToken('FSA980318AL3', 3600)
    const hash = await hashProspectToken(token)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('hashProspectToken is deterministic for the same token', async () => {
    const token = await signProspectToken('FSA980318AL3', 3600)
    const a = await hashProspectToken(token)
    const b = await hashProspectToken(token)
    expect(a).toBe(b)
  })
})
