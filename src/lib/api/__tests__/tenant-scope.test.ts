/**
 * Contract tests for resolveTenantScope — the single fence for
 * API-layer tenant resolution across the portal.
 *
 * Splits the two threat models:
 *   · client role        → session-only (cookie + param IGNORED)
 *   · internal role      → param || cookie || session (cookie path
 *                          restores admin view-as set by
 *                          /api/auth/view-as)
 */

import { describe, it, expect } from 'vitest'
import { resolveTenantScope, isInternalRole } from '../tenant-scope'

/* eslint-disable @typescript-eslint/no-explicit-any */

function fakeReq(qs: Record<string, string> = {}, cookies: Record<string, string> = {}) {
  const params = new URLSearchParams(qs)
  const cookieMap = new Map<string, { value: string }>()
  for (const [k, v] of Object.entries(cookies)) cookieMap.set(k, { value: v })
  return {
    cookies: { get: (k: string) => cookieMap.get(k) },
    nextUrl: { searchParams: params },
  } as any
}

describe('resolveTenantScope · null session', () => {
  it('returns empty string on null session (caller 400s)', () => {
    expect(resolveTenantScope(null, fakeReq())).toBe('')
    expect(resolveTenantScope(null, fakeReq({ company_id: 'mafesa' }))).toBe('')
    expect(resolveTenantScope(null, fakeReq({}, { company_id: 'mafesa' }))).toBe('')
  })
})

describe('resolveTenantScope · client role (SEV-1 fence)', () => {
  const session = { role: 'client', companyId: 'evco' }

  it('uses session.companyId, ignoring cookie + param (forgery defense)', () => {
    const req = fakeReq({ company_id: 'mafesa' }, { company_id: 'dyxon' })
    expect(resolveTenantScope(session, req)).toBe('evco')
  })

  it('no override → session.companyId', () => {
    expect(resolveTenantScope(session, fakeReq())).toBe('evco')
  })

  it('cookie alone → session.companyId', () => {
    expect(resolveTenantScope(session, fakeReq({}, { company_id: 'mafesa' }))).toBe('evco')
  })

  it('param alone → session.companyId (no escalation via query)', () => {
    expect(resolveTenantScope(session, fakeReq({ company_id: 'mafesa' }))).toBe('evco')
  })

  it('empty session.companyId → empty string (client edge → 400)', () => {
    expect(resolveTenantScope({ role: 'client', companyId: '' }, fakeReq())).toBe('')
  })
})

describe('resolveTenantScope · internal roles (view-as supported)', () => {
  const internalRoles = ['admin', 'broker', 'operator', 'contabilidad', 'owner']

  it.each(internalRoles)('%s + ?company_id=mafesa param → mafesa (explicit oversight)', (role) => {
    const session = { role, companyId: 'admin' }
    expect(resolveTenantScope(session, fakeReq({ company_id: 'mafesa' }))).toBe('mafesa')
  })

  it.each(internalRoles)('%s + company_id cookie → cookie value (restores admin view-as)', (role) => {
    // This is the KEY view-as fence: /api/auth/view-as sets the
    // company_id cookie when an admin impersonates a client. The
    // downstream API routes must honor that cookie so the admin
    // actually sees the impersonated tenant's data.
    const session = { role, companyId: 'internal' }
    expect(resolveTenantScope(session, fakeReq({}, { company_id: 'mafesa' }))).toBe('mafesa')
  })

  it('param wins over cookie (explicit beats implicit)', () => {
    const session = { role: 'admin', companyId: 'admin' }
    const req = fakeReq({ company_id: 'mafesa' }, { company_id: 'dyxon' })
    expect(resolveTenantScope(session, req)).toBe('mafesa')
  })

  it('no override → session.companyId (fallback to placeholder)', () => {
    const session = { role: 'admin', companyId: 'admin' }
    expect(resolveTenantScope(session, fakeReq())).toBe('admin')
  })

  it('admin with view-as cookie, no param → cookie wins (real usage path)', () => {
    const session = { role: 'admin', companyId: 'admin' }
    expect(resolveTenantScope(session, fakeReq({}, { company_id: 'evco' }))).toBe('evco')
  })
})

describe('resolveTenantScope · unknown role (fail-closed)', () => {
  it('unknown role + cookie forgery → empty (fail closed)', () => {
    const session = { role: 'hacker', companyId: 'evco' }
    expect(resolveTenantScope(session, fakeReq({ company_id: 'mafesa' }, { company_id: 'dyxon' }))).toBe('')
  })

  it('empty role → empty', () => {
    expect(resolveTenantScope({ role: '', companyId: 'evco' }, fakeReq())).toBe('')
  })
})

describe('isInternalRole helper', () => {
  it('returns true for admin/broker/operator/contabilidad/owner', () => {
    for (const role of ['admin', 'broker', 'operator', 'contabilidad', 'owner']) {
      expect(isInternalRole({ role, companyId: 'x' })).toBe(true)
    }
  })

  it('returns false for client / unknown / null', () => {
    expect(isInternalRole({ role: 'client', companyId: 'evco' })).toBe(false)
    expect(isInternalRole({ role: 'unknown', companyId: 'evco' })).toBe(false)
    expect(isInternalRole(null)).toBe(false)
  })
})
