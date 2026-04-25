import { describe, it, expect } from 'vitest'
import { OPERATOR_ROLES } from '../require-operator'

/**
 * `requireOperatorRole()` and `isOperator()` themselves call
 * `await cookies()` and `verifySession()`, both of which require a
 * Next.js request context. Asserting their full runtime behavior needs
 * a route-level integration test (see `src/app/api/broker/data/__tests__/`
 * for the canonical pattern). What we can lock down at the unit level
 * is the role allowlist itself — the structural contract every caller
 * relies on.
 */

describe('OPERATOR_ROLES allowlist', () => {
  it('contains the canonical six operator-tier roles', () => {
    expect(OPERATOR_ROLES.has('operator')).toBe(true)
    expect(OPERATOR_ROLES.has('admin')).toBe(true)
    expect(OPERATOR_ROLES.has('broker')).toBe(true)
    expect(OPERATOR_ROLES.has('owner')).toBe(true)
    expect(OPERATOR_ROLES.has('warehouse')).toBe(true)
    expect(OPERATOR_ROLES.has('contabilidad')).toBe(true)
  })

  it('does NOT include client', () => {
    expect(OPERATOR_ROLES.has('client')).toBe(false)
  })

  it('does NOT include unknown roles (case-sensitive)', () => {
    expect(OPERATOR_ROLES.has('Admin')).toBe(false)
    expect(OPERATOR_ROLES.has('OPERATOR')).toBe(false)
    expect(OPERATOR_ROLES.has('')).toBe(false)
    expect(OPERATOR_ROLES.has('superuser')).toBe(false)
  })

  it('exposes exactly six entries (locked — change requires founder override)', () => {
    expect(OPERATOR_ROLES.size).toBe(6)
  })
})
