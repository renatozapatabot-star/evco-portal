import { describe, it, expect, vi } from 'vitest'
import {
  proposeAction,
  commitAction,
  listActionsAdmin,
  getActionAdmin,
  markExecuted,
  markExecuteFailed,
  type AgentActionRow,
} from '../actions'

/**
 * Coverage for the operator-queue helpers added in 20260422210000:
 *   - listActionsAdmin: status/kind/company filters compose correctly
 *   - getActionAdmin: no tenant filter (ids from any company resolve)
 *   - markExecuted: committed → executed, idempotent on re-run
 *   - markExecuteFailed: committed → execute_failed with Spanish reason
 *   - markExecuted on cancelled row: refuses
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
function makeFakeSupabase() {
  const rows: AgentActionRow[] = []

  function select() {
    const filters: Record<string, unknown> = {}
    const inFilters: Record<string, unknown[]> = {}
    let orderAsc = true
    let limitN = 1000
    function resolveList() {
      const matched = rows
        .filter((r) =>
          Object.entries(filters).every(
            ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
          ),
        )
        .filter((r) =>
          Object.entries(inFilters).every(([k, vs]) =>
            vs.includes((r as unknown as Record<string, unknown>)[k]),
          ),
        )
      matched.sort((a, b) => {
        const da = new Date(a.created_at).getTime()
        const db = new Date(b.created_at).getTime()
        return orderAsc ? da - db : db - da
      })
      return { data: matched.slice(0, limitN), error: null }
    }
    const chain: Record<string, unknown> = {}
    chain.eq = vi.fn((col: string, val: unknown) => {
      filters[col] = val
      return chain
    })
    chain.in = vi.fn((col: string, vals: unknown[]) => {
      inFilters[col] = vals
      return chain
    })
    chain.order = vi.fn((_col: string, opts: { ascending?: boolean }) => {
      orderAsc = opts?.ascending !== false
      return chain
    })
    chain.limit = vi.fn((n: number) => {
      limitN = n
      return chain
    })
    // Thenable: awaiting the chain resolves to the filtered+sorted list.
    chain.then = (onFulfilled: (r: unknown) => unknown) =>
      Promise.resolve(resolveList()).then(onFulfilled)
    chain.maybeSingle = vi.fn(() => {
      const match = rows.find((r) =>
        Object.entries(filters).every(
          ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
        ),
      )
      return Promise.resolve({ data: match ?? null, error: null })
    })
    chain.single = vi.fn(() => {
      const match = rows.find(
        (r) =>
          Object.entries(filters).every(
            ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
          ) &&
          Object.entries(inFilters).every(([k, vs]) =>
            vs.includes((r as unknown as Record<string, unknown>)[k]),
          ),
      )
      return Promise.resolve(
        match ? { data: match, error: null } : { data: null, error: { message: 'not_found' } },
      )
    })
    return chain
  }

  function insert(row: Omit<AgentActionRow, 'id' | 'created_at'>) {
    const full: AgentActionRow = {
      id: `act-${rows.length + 1}`,
      created_at: new Date(Date.now() + rows.length).toISOString(),
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
    const inFilters: Record<string, unknown[]> = {}
    const chain: Record<string, unknown> = {}
    chain.eq = vi.fn((col: string, val: unknown) => {
      filters[col] = val
      return chain
    })
    chain.in = vi.fn((col: string, vals: unknown[]) => {
      inFilters[col] = vals
      return chain
    })
    chain.select = vi.fn(() => chain)
    chain.single = vi.fn(() => {
      const idx = rows.findIndex(
        (r) =>
          Object.entries(filters).every(
            ([k, v]) => (r as unknown as Record<string, unknown>)[k] === v,
          ) &&
          Object.entries(inFilters).every(([k, vs]) =>
            vs.includes((r as unknown as Record<string, unknown>)[k]),
          ),
      )
      if (idx === -1) {
        return Promise.resolve({ data: null, error: { message: 'no_match' } })
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

const asSb = (sb: ReturnType<typeof makeFakeSupabase>) => sb as unknown as any

async function seed(sb: ReturnType<typeof makeFakeSupabase>, companyId: string) {
  const r = await proposeAction(asSb(sb), {
    companyId,
    actorId: null,
    actorRole: 'client',
    kind: 'flag_shipment',
    payload: { trafico_id: 'Y-1', reason_es: 'x', severity: 'info' },
    summaryEs: 'x',
  })
  if (!r.ok) throw new Error('propose failed')
  await commitAction(asSb(sb), companyId, r.action.id)
  return r.action.id
}

describe('listActionsAdmin', () => {
  it('returns rows across tenants (no tenant filter)', async () => {
    const sb = makeFakeSupabase()
    await seed(sb, 'evco')
    await seed(sb, 'mafesa')
    const list = await listActionsAdmin(asSb(sb), { statuses: ['committed'] })
    expect(list).toHaveLength(2)
    const tenants = list.map((r) => r.company_id).sort()
    expect(tenants).toEqual(['evco', 'mafesa'])
  })

  it('filters by kind', async () => {
    const sb = makeFakeSupabase()
    const p1 = await proposeAction(asSb(sb), {
      companyId: 'evco',
      actorId: null,
      actorRole: 'client',
      kind: 'flag_shipment',
      payload: { trafico_id: 'Y-1', reason_es: 'x', severity: 'info' },
      summaryEs: 'x',
    })
    const p2 = await proposeAction(asSb(sb), {
      companyId: 'evco',
      actorId: null,
      actorRole: 'client',
      kind: 'draft_mensajeria_to_anabel',
      payload: { subject_es: 'Asunto', body_es: 'Cuerpo' },
      summaryEs: 'y',
    })
    if (!p1.ok || !p2.ok) throw new Error('propose failed')
    const list = await listActionsAdmin(asSb(sb), {
      kinds: ['draft_mensajeria_to_anabel'],
    })
    expect(list).toHaveLength(1)
    expect(list[0].kind).toBe('draft_mensajeria_to_anabel')
  })

  it('filters by company', async () => {
    const sb = makeFakeSupabase()
    await seed(sb, 'evco')
    await seed(sb, 'mafesa')
    const list = await listActionsAdmin(asSb(sb), {
      statuses: ['committed'],
      companyId: 'mafesa',
    })
    expect(list).toHaveLength(1)
    expect(list[0].company_id).toBe('mafesa')
  })
})

describe('getActionAdmin', () => {
  it('resolves regardless of tenant (internal only)', async () => {
    const sb = makeFakeSupabase()
    const id = await seed(sb, 'mafesa')
    const row = await getActionAdmin(asSb(sb), id)
    expect(row?.company_id).toBe('mafesa')
  })

  it('returns null for unknown id', async () => {
    const sb = makeFakeSupabase()
    const row = await getActionAdmin(asSb(sb), 'nope')
    expect(row).toBeNull()
  })
})

describe('markExecuted', () => {
  it('flips committed → executed and stamps executor metadata', async () => {
    const sb = makeFakeSupabase()
    const id = await seed(sb, 'evco')
    const result = { thread_id: 't1', downstream: 'mensajeria.thread' }
    const r = await markExecuted(asSb(sb), id, {
      executorId: 'op-1',
      executorRole: 'operator',
      result,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.action.status).toBe('executed')
    expect(r.action.executed_by).toBe('op-1')
    expect(r.action.executed_by_role).toBe('operator')
    expect(r.action.execute_result).toEqual(result)
    expect(r.action.execute_attempts).toBe(1)
    expect(r.already).toBe(false)
  })

  it('is idempotent — second mark returns already:true', async () => {
    const sb = makeFakeSupabase()
    const id = await seed(sb, 'evco')
    await markExecuted(asSb(sb), id, {
      executorId: 'op-1',
      executorRole: 'operator',
      result: { thread_id: 't1' },
    })
    const second = await markExecuted(asSb(sb), id, {
      executorId: 'op-2',
      executorRole: 'operator',
      result: { thread_id: 't2' },
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.already).toBe(true)
    expect(second.action.execute_result).toEqual({ thread_id: 't1' })
  })

  it('refuses to execute a cancelled action', async () => {
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
    // Simulate cancellation at the row level.
    ;(sb.__rows[0] as AgentActionRow).status = 'cancelled'
    const r = await markExecuted(asSb(sb), p.action.id, {
      executorId: 'op-1',
      executorRole: 'operator',
      result: {},
    })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('invalid_transition')
  })

  it('allows retry from execute_failed', async () => {
    const sb = makeFakeSupabase()
    const id = await seed(sb, 'evco')
    await markExecuteFailed(asSb(sb), id, {
      executorId: 'op-1',
      executorRole: 'operator',
      errorEs: 'fallo transitorio',
    })
    const retry = await markExecuted(asSb(sb), id, {
      executorId: 'op-1',
      executorRole: 'operator',
      result: { thread_id: 't1' },
    })
    expect(retry.ok).toBe(true)
    if (!retry.ok) return
    expect(retry.action.status).toBe('executed')
    expect(retry.action.execute_attempts).toBe(2)
    expect(retry.action.execute_error_es).toBeNull()
  })
})

describe('markExecuteFailed', () => {
  it('stamps execute_failed with the Spanish reason truncated', async () => {
    const sb = makeFakeSupabase()
    const id = await seed(sb, 'evco')
    const longMsg = 'x'.repeat(600)
    const r = await markExecuteFailed(asSb(sb), id, {
      executorId: 'op-1',
      executorRole: 'operator',
      errorEs: longMsg,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.action.status).toBe('execute_failed')
    expect((r.action.execute_error_es ?? '').length).toBe(500)
    expect(r.action.execute_attempts).toBe(1)
  })

  it('refuses to mark an executed action failed', async () => {
    const sb = makeFakeSupabase()
    const id = await seed(sb, 'evco')
    await markExecuted(asSb(sb), id, {
      executorId: 'op-1',
      executorRole: 'operator',
      result: { thread_id: 't1' },
    })
    const r = await markExecuteFailed(asSb(sb), id, {
      executorId: 'op-1',
      executorRole: 'operator',
      errorEs: 'too late',
    })
    expect(r.ok).toBe(false)
  })
})
