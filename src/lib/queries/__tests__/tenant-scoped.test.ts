import { describe, it, expect, vi } from 'vitest'
import {
  getScopedFrom,
  getTenantScopedQuery,
  assertScopeMode,
} from '../tenant-scoped'

/**
 * Tenant-scope helper — smoke tests.
 *
 * The helper primarily enforces API shape + the "admin bypass must be
 * explicit" rule. Real tenant-isolation validation lives in the API
 * route isolation fences (cookie-forgery tests etc.). This suite
 * locks the contract.
 */

describe('assertScopeMode', () => {
  it('returns tenant when no requested mode given', () => {
    expect(assertScopeMode('client')).toBe('tenant')
    expect(assertScopeMode('operator')).toBe('tenant')
  })

  it('returns tenant when explicitly requested', () => {
    expect(assertScopeMode('client', 'tenant')).toBe('tenant')
    expect(assertScopeMode('admin', 'tenant')).toBe('tenant')
  })

  it('allows all-tenants for admin + broker', () => {
    expect(assertScopeMode('admin', 'all-tenants')).toBe('all-tenants')
    expect(assertScopeMode('broker', 'all-tenants')).toBe('all-tenants')
  })

  it('throws on all-tenants for client/operator/other roles', () => {
    expect(() => assertScopeMode('client', 'all-tenants')).toThrow(
      /requires admin or broker/,
    )
    expect(() => assertScopeMode('operator', 'all-tenants')).toThrow(
      /requires admin or broker/,
    )
    expect(() => assertScopeMode('warehouse', 'all-tenants')).toThrow(
      /requires admin or broker/,
    )
  })
})

describe('getScopedFrom', () => {
  function makeFakeSupabase() {
    const select = vi.fn().mockReturnThis()
    const eq = vi.fn().mockReturnThis()
    const from = vi.fn(() => ({ select, eq }))
    return {
      client: { from } as unknown as Parameters<typeof getScopedFrom>[0],
      select,
      eq,
      from,
    }
  }

  it('applies .eq(company_id, X) in tenant mode', () => {
    const fake = makeFakeSupabase()
    getScopedFrom(fake.client, 'traficos', 'evco')
    expect(fake.from).toHaveBeenCalledWith('traficos')
    expect(fake.select).toHaveBeenCalledWith('*')
    expect(fake.eq).toHaveBeenCalledWith('company_id', 'evco')
  })

  it('does NOT apply company_id filter in all-tenants mode', () => {
    const fake = makeFakeSupabase()
    getScopedFrom(fake.client, 'traficos', null, { mode: 'all-tenants' })
    expect(fake.from).toHaveBeenCalledWith('traficos')
    expect(fake.eq).not.toHaveBeenCalled()
  })

  it('throws if companyId is missing in tenant mode', () => {
    const fake = makeFakeSupabase()
    expect(() =>
      getScopedFrom(fake.client, 'traficos', null),
    ).toThrow(/companyId required/)
    expect(() =>
      getScopedFrom(fake.client, 'traficos', ''),
    ).toThrow(/companyId required/)
  })

  it('supports every tenant-scoped table from schema-contracts', () => {
    const fake = makeFakeSupabase()
    const tables = [
      'traficos', 'globalpc_partidas', 'globalpc_facturas',
      'globalpc_productos', 'globalpc_proveedores', 'companies',
      'expediente_documentos', 'entradas',
    ] as const
    for (const t of tables) {
      getScopedFrom(fake.client, t, 'evco')
    }
    expect(fake.from).toHaveBeenCalledTimes(tables.length)
  })
})

describe('getTenantScopedQuery', () => {
  function makeFakeSupabase() {
    const eq = vi.fn().mockReturnThis()
    const select = vi.fn(() => ({ eq }))
    const from = vi.fn(() => ({ select, eq }))
    return {
      client: { from } as unknown as Parameters<typeof getTenantScopedQuery>[0],
      select,
      eq,
      from,
    }
  }

  it('returns a scoped builder for tenant mode', () => {
    const fake = makeFakeSupabase()
    getTenantScopedQuery(fake.client, 'companies', 'evco')
    expect(fake.from).toHaveBeenCalledWith('companies')
    expect(fake.eq).toHaveBeenCalledWith('company_id', 'evco')
  })

  it('throws in tenant mode without companyId', () => {
    const fake = makeFakeSupabase()
    expect(() =>
      getTenantScopedQuery(fake.client, 'companies', null),
    ).toThrow(/companyId is required/)
  })

  it('allows null companyId in all-tenants mode', () => {
    const fake = makeFakeSupabase()
    expect(() =>
      getTenantScopedQuery(fake.client, 'companies', null, { mode: 'all-tenants' }),
    ).not.toThrow()
  })
})
