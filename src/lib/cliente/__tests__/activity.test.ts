import { describe, it, expect, vi } from 'vitest'
import { getClienteActivity, CLIENT_ACTIVITY_TABLES } from '../activity'

type Row = Record<string, unknown>

function makeSupabase(rows: Row[], spy?: (state: { companyId?: string; tables?: string[] }) => void) {
  const state: { companyId?: string; tables?: string[] } = {}
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn((_col: string, val: string) => { state.companyId = val; return chain }),
    in: vi.fn((_col: string, values: string[]) => { state.tables = values; return chain }),
    order: vi.fn(() => chain),
    limit: vi.fn(() => {
      spy?.(state)
      return Promise.resolve({ data: rows, error: null })
    }),
  }
  return { from: vi.fn(() => chain) } as unknown as Parameters<typeof getClienteActivity>[0]
}

describe('getClienteActivity', () => {
  it('returns empty array for missing companyId', async () => {
    const sb = makeSupabase([])
    const out = await getClienteActivity(sb, '')
    expect(out).toEqual([])
  })

  it('maps audit rows to timeline items with readable titles', async () => {
    const sb = makeSupabase([
      { id: 1, table_name: 'traficos', action: 'UPDATE', record_id: 'T-001', changed_at: '2026-04-13T12:00:00Z', company_id: '9254' },
      { id: 2, table_name: 'pedimentos', action: 'INSERT', record_id: '26 24 3596 6500441', changed_at: '2026-04-13T11:00:00Z', company_id: '9254' },
    ])
    const items = await getClienteActivity(sb, '9254')
    expect(items).toHaveLength(2)
    expect(items[0].title).toContain('Embarque')
    expect(items[0].href).toBe('/embarques/T-001')
    expect(items[1].title).toContain('Pedimento')
  })

  it('applies company_id scope and table whitelist', async () => {
    let captured: { companyId?: string; tables?: string[] } = {}
    const sb = makeSupabase([], (s) => { captured = s })
    await getClienteActivity(sb, '9254')
    expect(captured.companyId).toBe('9254')
    expect(captured.tables).toEqual(Array.from(CLIENT_ACTIVITY_TABLES))
  })

  it('whitelist excludes anxiety-leaking tables', () => {
    const forbidden = ['mve_alerts', 'drafts', 'compliance_events', 'audit_log']
    for (const t of forbidden) {
      expect(CLIENT_ACTIVITY_TABLES).not.toContain(t as typeof CLIENT_ACTIVITY_TABLES[number])
    }
  })
})
