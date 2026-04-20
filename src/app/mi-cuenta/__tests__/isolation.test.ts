/**
 * Isolation contract — /mi-cuenta client A/R surface.
 *
 * Required by .claude/rules/client-accounting-ethics.md §7 — "Regression
 * on this test is a SEV-2." Tests the authorization logic in
 * ../access.ts which decides:
 *   1. render vs redirect-to-login vs redirect-to-inicio
 *   2. scopedCompanyId = session.companyId (client) vs null (internal)
 *   3. feature-flag gating for client role only
 *
 * The per-tenant aging math is tested separately in
 * src/lib/contabilidad/__tests__/aging.test.ts — this file covers the
 * page-level gating that wraps it.
 */

import { describe, it, expect } from 'vitest'
import { resolveMiCuentaAccess } from '../access'

describe('resolveMiCuentaAccess · isolation contract', () => {
  describe('no session (unauthenticated or expired)', () => {
    it('redirects to /login', () => {
      const result = resolveMiCuentaAccess(null, true)
      expect(result.decision).toBe('redirect')
      if (result.decision === 'redirect') {
        expect(result.to).toBe('/login')
        expect(result.reason).toBe('no-session')
      }
    })

    it('redirects to /login regardless of feature flag state', () => {
      const off = resolveMiCuentaAccess(null, false)
      const on = resolveMiCuentaAccess(null, true)
      expect(off.decision).toBe('redirect')
      expect(on.decision).toBe('redirect')
      if (off.decision === 'redirect') expect(off.to).toBe('/login')
      if (on.decision === 'redirect') expect(on.to).toBe('/login')
    })
  })

  describe('client role (Ursula / EVCO / any tenant)', () => {
    it('renders with scopedCompanyId = session.companyId when flag ON (EVCO)', () => {
      const result = resolveMiCuentaAccess({ role: 'client', companyId: 'evco' }, true)
      expect(result.decision).toBe('render')
      if (result.decision === 'render') {
        expect(result.isClient).toBe(true)
        expect(result.isInternal).toBe(false)
        expect(result.scopedCompanyId).toBe('evco')
        expect(result.companyId).toBe('evco')
      }
    })

    it('renders with scopedCompanyId = session.companyId when flag ON (MAFESA)', () => {
      const result = resolveMiCuentaAccess({ role: 'client', companyId: 'mafesa' }, true)
      expect(result.decision).toBe('render')
      if (result.decision === 'render') {
        expect(result.scopedCompanyId).toBe('mafesa')
        // Cross-tenant invariant: MAFESA session can NEVER surface with
        // scopedCompanyId = 'evco' or null (which would surface broker
        // aggregate). The only valid value is 'mafesa'.
        expect(result.scopedCompanyId).not.toBe('evco')
        expect(result.scopedCompanyId).not.toBeNull()
      }
    })

    it('redirects to /inicio when feature flag is OFF (default pre-Tito-walkthrough)', () => {
      const result = resolveMiCuentaAccess({ role: 'client', companyId: 'evco' }, false)
      expect(result.decision).toBe('redirect')
      if (result.decision === 'redirect') {
        expect(result.to).toBe('/inicio')
        expect(result.reason).toBe('feature-flag-off')
      }
    })
  })

  describe('internal roles (admin / broker / operator / contabilidad / owner)', () => {
    const internalRoles = ['admin', 'broker', 'operator', 'contabilidad', 'owner']

    it.each(internalRoles)('%s session renders with scopedCompanyId = null (broker aggregate)', (role) => {
      const result = resolveMiCuentaAccess({ role, companyId: 'admin' }, true)
      expect(result.decision).toBe('render')
      if (result.decision === 'render') {
        expect(result.isClient).toBe(false)
        expect(result.isInternal).toBe(true)
        expect(result.scopedCompanyId).toBeNull()
        expect(result.companyId).toBe('admin')
      }
    })

    it.each(internalRoles)('%s session ignores feature flag OFF (always pass through for QA)', (role) => {
      const result = resolveMiCuentaAccess({ role, companyId: 'internal' }, false)
      expect(result.decision).toBe('render')
      if (result.decision === 'render') {
        expect(result.scopedCompanyId).toBeNull()
      }
    })
  })

  describe('unknown / malformed roles', () => {
    it('redirects to /login on unknown role (not client, not internal)', () => {
      const result = resolveMiCuentaAccess({ role: 'hacker', companyId: 'evco' }, true)
      expect(result.decision).toBe('redirect')
      if (result.decision === 'redirect') {
        expect(result.to).toBe('/login')
        expect(result.reason).toBe('unknown-role')
      }
    })

    it('redirects to /login on empty role', () => {
      const result = resolveMiCuentaAccess({ role: '', companyId: 'evco' }, true)
      expect(result.decision).toBe('redirect')
    })
  })

  describe('cross-tenant leakage fence (SEV-2 per ethics contract)', () => {
    it('client role NEVER resolves to scopedCompanyId != session.companyId', () => {
      const tenants = ['evco', 'mafesa', 'tornillo', 'dyxon', 'calfer']
      for (const tenant of tenants) {
        const result = resolveMiCuentaAccess({ role: 'client', companyId: tenant }, true)
        expect(result.decision).toBe('render')
        if (result.decision === 'render') {
          expect(result.scopedCompanyId).toBe(tenant)
        }
      }
    })

    it('client role NEVER resolves to scopedCompanyId = null (would leak broker aggregate)', () => {
      const result = resolveMiCuentaAccess({ role: 'client', companyId: 'evco' }, true)
      expect(result.decision).toBe('render')
      if (result.decision === 'render') {
        expect(result.scopedCompanyId).not.toBeNull()
      }
    })

    it('internal role ALWAYS resolves to scopedCompanyId = null (even if companyId is a tenant slug)', () => {
      // Defensive: even if an internal session accidentally carries a
      // tenant companyId, the scope resolves to null (aggregate). Client-
      // scoping only happens for role === 'client'.
      const result = resolveMiCuentaAccess({ role: 'admin', companyId: 'evco' }, true)
      expect(result.decision).toBe('render')
      if (result.decision === 'render') {
        expect(result.scopedCompanyId).toBeNull()
      }
    })
  })
})
