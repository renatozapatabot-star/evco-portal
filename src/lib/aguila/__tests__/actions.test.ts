import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  proposeAction,
  commitAction,
  cancelAction,
  CANCEL_WINDOW_MS,
  ACTION_KINDS,
  type AgentActionRow,
} from '../actions'

/**
 * Minimal in-memory Supabase stub covering exactly the call shapes
 * `actions.ts` uses:
 *
 *   .from('agent_actions').insert(row).select('*').single()
 *   .from('agent_actions').select('*').eq(..).eq(..).maybeSingle()
 *   .from('agent_actions').update(patch).eq(..).eq(..).eq(..).select('*').single()
 *
 * Tenant isolation is modeled honestly — every read filter must match
 * both `id` and `company_id`, otherwise `maybeSingle()` returns null.
 */
function makeFakeSupabase() {
  const rows: AgentActionRow[] = []

  function select() {
    // Build a chain that captures filters, then resolves on `single`
    // or `maybeSingle`.
    const filters: Record<string, unknown> = {}
    const chain: Record<string, unknown> = {}
    chain.eq = vi.fn((col: string, val: unknown) => {
      filters[col] = val
      return chain
    })
    chain.maybeSingle = vi.fn(() => {
      const match = rows.find((r) =>
        Object.entries(filters).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v),
      )
      return Promise.resolve({ data: match ?? null, error: null })
    })
    chain.single = vi.fn(() => {
      const match = rows.find((r) =>
        Object.entries(filters).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v),
      )
      return Promise.resolve(
        match
          ? { data: match, error: null }
          : { data: null, error: { message: 'not_found' } },
      )
    })
    return chain
  }

  function insert(row: Omit<AgentActionRow, 'id' | 'created_at'>) {
    const full: AgentActionRow = {
      id: `act-${rows.length + 1}`,
      created_at: new Date().toISOString(),
      ...row,
    } as AgentActionRow
    rows.push(full)
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.single = vi.fn(() => Promise.resolve({ data: full, error: null }))
    return chain
  }

  function update(patch: Partial<AgentActionRow>) {
    const filters: Record<string, unknown> = {}
    const chain: Record<string, unknown> = {}
    chain.eq = vi.fn((col: string, val: unknown) => {
      filters[col] = val
      return chain
    })
    chain.select = vi.fn(() => chain)
    chain.single = vi.fn(() => {
      const idx = rows.findIndex((r) =>
        Object.entries(filters).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v),
      )
      if (idx === -1) {
        return Promise.resolve({ data: null, error: { message: 'not_found_or_filter_mismatch' } })
      }
      rows[idx] = { ...rows[idx], ...patch } as AgentActionRow
      return Promise.resolve({ data: rows[idx], error: null })
    })
    return chain
  }

  return {
    from: (table: string) => {
      if (table !== 'agent_actions') throw new Error(`unexpected table ${table}`)
      return {
        select: vi.fn(() => select()),
        insert: vi.fn((row: Omit<AgentActionRow, 'id' | 'created_at'>) => insert(row)),
        update: vi.fn((patch: Partial<AgentActionRow>) => update(patch)),
      }
    },
    __rows: rows,
  }
}

// Type-erased cast for the `SupabaseClient` parameter — the lib only
// uses the subset implemented in `makeFakeSupabase`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asSb = (sb: ReturnType<typeof makeFakeSupabase>) => sb as unknown as any

describe('agent actions — contract', () => {
  it('registers three canonical kinds', () => {
    expect([...ACTION_KINDS].sort()).toEqual([
      'draft_mensajeria_to_anabel',
      'flag_shipment',
      'open_oca_request',
    ])
  })

  it('5-second cancel window is the canonical constant', () => {
    expect(CANCEL_WINDOW_MS).toBe(5000)
  })
})

describe('proposeAction', () => {
  let sb: ReturnType<typeof makeFakeSupabase>
  beforeEach(() => { sb = makeFakeSupabase() })

  it('accepts a valid flag_shipment payload and stamps a future deadline', async () => {
    const before = Date.now()
    const r = await proposeAction(asSb(sb), {
      companyId: 'evco',
      actorId: 'user-1',
      actorRole: 'client',
      kind: 'flag_shipment',
      payload: { trafico_id: 'Y-1234', reason_es: 'Documento faltante', severity: 'warn' },
      summaryEs: 'Marcar Y-1234 como pendiente',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.action.kind).toBe('flag_shipment')
    expect(r.action.status).toBe('proposed')
    expect(r.action.company_id).toBe('evco')
    const deadline = new Date(r.action.commit_deadline_at).getTime()
    expect(deadline).toBeGreaterThanOrEqual(before + CANCEL_WINDOW_MS - 5)
    expect(deadline).toBeLessThanOrEqual(Date.now() + CANCEL_WINDOW_MS + 50)
  })

  it('rejects a flag_shipment payload missing required fields', async () => {
    const r = await proposeAction(asSb(sb), {
      companyId: 'evco',
      actorId: null,
      actorRole: 'client',
      kind: 'flag_shipment',
      payload: { trafico_id: 'Y-1234' },
      summaryEs: 'x',
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('invalid_payload')
  })

  it('rejects open_oca_request with a malformed fracción (invariant #8)', async () => {
    const r = await proposeAction(asSb(sb), {
      companyId: 'evco',
      actorId: null,
      actorRole: 'client',
      kind: 'open_oca_request',
      payload: {
        fraccion: '39012001', // stripped dots — must be rejected
        product_description_es: 'Polipropileno granulado',
        reason_es: 'Duda clasificación',
      },
      summaryEs: 'x',
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('invalid_payload')
    expect(r.detail).toContain('fraccion')
  })

  it('accepts a well-formed draft_mensajeria_to_anabel payload', async () => {
    const r = await proposeAction(asSb(sb), {
      companyId: 'evco',
      actorId: 'user-1',
      actorRole: 'client',
      kind: 'draft_mensajeria_to_anabel',
      payload: {
        subject_es: 'Duda sobre factura del mes',
        body_es: 'Anabel, queremos confirmar el saldo al día.',
      },
      summaryEs: 'Enviar duda a Anabel',
    })
    expect(r.ok).toBe(true)
  })
})

describe('commitAction', () => {
  it('flips proposed → committed', async () => {
    const sb = makeFakeSupabase()
    const p = await proposeAction(asSb(sb), {
      companyId: 'evco',
      actorId: null,
      actorRole: 'client',
      kind: 'flag_shipment',
      payload: { trafico_id: 'Y-1', reason_es: 'x', severity: 'info' },
      summaryEs: 'x',
    })
    if (!p.ok) throw new Error('propose failed')

    const c = await commitAction(asSb(sb), 'evco', p.action.id)
    expect(c.ok).toBe(true)
    if (!c.ok) return
    expect(c.action.status).toBe('committed')
    expect(c.action.committed_at).toBeTruthy()
    expect(c.already).toBe(false)
  })

  it('is idempotent — second commit returns already:true', async () => {
    const sb = makeFakeSupabase()
    const p = await proposeAction(asSb(sb), {
      companyId: 'evco',
      actorId: null,
      actorRole: 'client',
      kind: 'flag_shipment',
      payload: { trafico_id: 'Y-1', reason_es: 'x', severity: 'info' },
      summaryEs: 'x',
    })
    if (!p.ok) throw new Error('propose failed')
    await commitAction(asSb(sb), 'evco', p.action.id)
    const c = await commitAction(asSb(sb), 'evco', p.action.id)
    expect(c.ok).toBe(true)
    if (!c.ok) return
    expect(c.already).toBe(true)
  })

  it('refuses to commit a cancelled action', async () => {
    const sb = makeFakeSupabase()
    const p = await proposeAction(asSb(sb), {
      companyId: 'evco',
      actorId: null,
      actorRole: 'client',
      kind: 'flag_shipment',
      payload: { trafico_id: 'Y-1', reason_es: 'x', severity: 'info' },
      summaryEs: 'x',
    })
    if (!p.ok) throw new Error('propose failed')
    await cancelAction(asSb(sb), 'evco', p.action.id)
    const c = await commitAction(asSb(sb), 'evco', p.action.id)
    expect(c.ok).toBe(false)
    if (c.ok) return
    expect(c.error).toBe('invalid_transition')
  })

  it('cross-tenant commit returns not_found (no info leak)', async () => {
    const sb = makeFakeSupabase()
    const p = await proposeAction(asSb(sb), {
      companyId: 'evco',
      actorId: null,
      actorRole: 'client',
      kind: 'flag_shipment',
      payload: { trafico_id: 'Y-1', reason_es: 'x', severity: 'info' },
      summaryEs: 'x',
    })
    if (!p.ok) throw new Error('propose failed')
    const c = await commitAction(asSb(sb), 'mafesa', p.action.id)
    expect(c.ok).toBe(false)
    if (c.ok) return
    expect(c.error).toBe('not_found')
  })
})

describe('cancelAction', () => {
  it('flips proposed → cancelled with an optional reason', async () => {
    const sb = makeFakeSupabase()
    const p = await proposeAction(asSb(sb), {
      companyId: 'evco',
      actorId: null,
      actorRole: 'client',
      kind: 'flag_shipment',
      payload: { trafico_id: 'Y-1', reason_es: 'x', severity: 'info' },
      summaryEs: 'x',
    })
    if (!p.ok) throw new Error('propose failed')
    const c = await cancelAction(asSb(sb), 'evco', p.action.id, 'user_clicked_cancel')
    expect(c.ok).toBe(true)
    if (!c.ok) return
    expect(c.action.status).toBe('cancelled')
    expect(c.action.cancel_reason_es).toBe('user_clicked_cancel')
  })

  it('is idempotent — second cancel returns already:true', async () => {
    const sb = makeFakeSupabase()
    const p = await proposeAction(asSb(sb), {
      companyId: 'evco',
      actorId: null,
      actorRole: 'client',
      kind: 'flag_shipment',
      payload: { trafico_id: 'Y-1', reason_es: 'x', severity: 'info' },
      summaryEs: 'x',
    })
    if (!p.ok) throw new Error('propose failed')
    await cancelAction(asSb(sb), 'evco', p.action.id)
    const c = await cancelAction(asSb(sb), 'evco', p.action.id)
    expect(c.ok).toBe(true)
    if (!c.ok) return
    expect(c.already).toBe(true)
  })

  it('refuses to cancel a committed action', async () => {
    const sb = makeFakeSupabase()
    const p = await proposeAction(asSb(sb), {
      companyId: 'evco',
      actorId: null,
      actorRole: 'client',
      kind: 'flag_shipment',
      payload: { trafico_id: 'Y-1', reason_es: 'x', severity: 'info' },
      summaryEs: 'x',
    })
    if (!p.ok) throw new Error('propose failed')
    await commitAction(asSb(sb), 'evco', p.action.id)
    const c = await cancelAction(asSb(sb), 'evco', p.action.id)
    expect(c.ok).toBe(false)
    if (c.ok) return
    expect(c.error).toBe('invalid_transition')
  })

  it('cross-tenant cancel returns not_found', async () => {
    const sb = makeFakeSupabase()
    const p = await proposeAction(asSb(sb), {
      companyId: 'evco',
      actorId: null,
      actorRole: 'client',
      kind: 'flag_shipment',
      payload: { trafico_id: 'Y-1', reason_es: 'x', severity: 'info' },
      summaryEs: 'x',
    })
    if (!p.ok) throw new Error('propose failed')
    const c = await cancelAction(asSb(sb), 'mafesa', p.action.id)
    expect(c.ok).toBe(false)
    if (c.ok) return
    expect(c.error).toBe('not_found')
  })
})
