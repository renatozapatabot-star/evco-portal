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
})
