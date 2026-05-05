import { describe, it, expect, vi, beforeEach } from 'vitest'

// Capture the row passed to supabase .insert() so we can assert shape.
const insertMock = vi.fn()

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      insert: (row: unknown) => {
        insertMock(row)
        return {
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'notif-test-1' }, error: null }),
          }),
        }
      },
    }),
  }),
}))

// Mock the tenant-tags helper so the test doesn't need to fake the
// companies.select().order() call chain. Real behavior is covered in
// src/lib/tenant/__tests__/resolve-slug.test.ts.
vi.mock('@/lib/tenant/resolve-slug', () => ({
  buildClaveMap: vi.fn(async () => new Map([['9254', 'evco'], ['4598', 'mafesa']])),
  resolveCompanyIdSlug: (input: unknown) => {
    if (input === 'evco' || input === 'mafesa') return { kind: 'resolved', slug: String(input), via: 'slug-passthrough' as const }
    if (input === '9254') return { kind: 'resolved', slug: 'evco', via: 'clave-mapped' as const }
    return { kind: 'unresolved', input, reason: 'unknown-clave' as const }
  },
}))

// Supply env vars the helper reads at module load.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'

import { createNotification } from '../notifications'

describe('createNotification()', () => {
  beforeEach(() => { insertMock.mockClear() })

  it('inserts a row with the expected shape', async () => {
    const result = await createNotification({
      companyId: 'evco',
      recipientKey: 'evco:admin',
      title: 'Nuevo documento recibido',
      description: 'Factura comercial para embarque 26 24 3596 6500441',
      severity: 'info',
      actionUrl: '/embarques/26-24-3596-6500441',
      traficoId: '26 24 3596 6500441',
      entityType: 'trafico',
      entityId: '26 24 3596 6500441',
    })

    expect(result.error).toBeNull()
    expect(result.id).toBe('notif-test-1')
    expect(insertMock).toHaveBeenCalledTimes(1)
    const row = insertMock.mock.calls[0][0] as Record<string, unknown>
    expect(row).toMatchObject({
      company_id: 'evco',
      recipient_key: 'evco:admin',
      title: 'Nuevo documento recibido',
      description: 'Factura comercial para embarque 26 24 3596 6500441',
      severity: 'info',
      action_url: '/embarques/26-24-3596-6500441',
      trafico_id: '26 24 3596 6500441',
      entity_type: 'trafico',
      entity_id: '26 24 3596 6500441',
      read: false,
    })
  })

  it('returns a typed VALIDATION_ERROR when companyId is missing', async () => {
    const result = await createNotification({
      companyId: '',
      title: 't', description: 'd',
    })
    expect(result.id).toBeNull()
    expect(result.error?.code).toBe('VALIDATION_ERROR')
  })

  it('normalizes a clave-shape companyId to its slug before insert', async () => {
    // 2026-04-29 audit guard: a stray '9254' (clave) gets remapped to
    // 'evco' (slug) by the resolve-slug normalizer. Without this guard
    // the row landed with company_id='9254' and was invisible to any
    // .eq('company_id', session.companyId) query.
    const result = await createNotification({
      companyId: '9254',
      title: 't', description: 'd',
    })
    expect(result.error).toBeNull()
    expect(result.id).toBe('notif-test-1')
    const row = insertMock.mock.calls[0][0] as Record<string, unknown>
    expect(row.company_id).toBe('evco')
  })

  it('rejects an unresolvable companyId with VALIDATION_ERROR (does NOT silently default)', async () => {
    const result = await createNotification({
      companyId: '9999', // not in the mocked claveMap
      title: 't', description: 'd',
    })
    expect(result.id).toBeNull()
    expect(result.error?.code).toBe('VALIDATION_ERROR')
    expect(result.error?.message).toContain('did not resolve')
    expect(insertMock).not.toHaveBeenCalled()
  })
})
