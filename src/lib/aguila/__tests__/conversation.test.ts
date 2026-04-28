import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getOrCreateConversation,
  loadRecentTurns,
  appendTurn,
  CONVERSATION_CONSTANTS,
} from '../conversation'

/**
 * Lightweight table-mock. Each table has a programmable response; the
 * last-called filter state is captured for assertions. The chain only
 * implements the surface `conversation.ts` actually uses.
 */
interface TableState {
  lastEqs: Array<[string, string]>
  lastOrder: string | null
  lastLimit: number | null
  insertedRows: Array<Record<string, unknown>>
  updatedRows: Array<Record<string, unknown>>
}
interface Resp { data: unknown; error: unknown }
type RespOrFn = Resp | ((s: TableState) => Resp)

const state = new Map<string, TableState>()
const selectResponses = new Map<string, RespOrFn>()
const singleResponses = new Map<string, RespOrFn>()
const maybeSingleResponses = new Map<string, RespOrFn>()
const insertResponses = new Map<string, RespOrFn>()
const updateResponses = new Map<string, RespOrFn>()

function tableState(table: string): TableState {
  let s = state.get(table)
  if (!s) {
    s = { lastEqs: [], lastOrder: null, lastLimit: null, insertedRows: [], updatedRows: [] }
    state.set(table, s)
  }
  return s
}

function resolve(map: Map<string, RespOrFn>, table: string): Promise<Resp> {
  const r = map.get(table) ?? { data: null, error: null }
  const out = typeof r === 'function' ? r(tableState(table)) : r
  return Promise.resolve(out)
}

function makeSupabase() {
  return {
    from: vi.fn((table: string) => {
      const s = tableState(table)
      s.lastEqs = []
      s.lastOrder = null
      s.lastLimit = null
      const chain: Record<string, unknown> = {}

      // select path. Every select-side method returns the chain so the
      // real Supabase pattern `.select().eq().order().limit().maybeSingle()`
      // works. The chain is also awaitable (PromiseLike) and resolves
      // to `selectResponses[table]` when awaited directly (list fetch).
      chain.select = vi.fn(() => chain)
      chain.eq = vi.fn((col: string, val: string) => { s.lastEqs.push([col, val]); return chain })
      chain.order = vi.fn((col: string) => { s.lastOrder = col; return chain })
      chain.limit = vi.fn((n: number) => { s.lastLimit = n; return chain })
      chain.maybeSingle = vi.fn(() => resolve(maybeSingleResponses, table))
      chain.single = vi.fn(() => resolve(singleResponses, table))
      chain.then = (res: (x: Resp) => unknown) => resolve(selectResponses, table).then(res)

      // insert path — .insert(row).select('id').single() OR .insert(row) terminal
      chain.insert = vi.fn((row: Record<string, unknown>) => {
        s.insertedRows.push(row)
        const insertChain: Record<string, unknown> = {}
        insertChain.select = vi.fn(() => insertChain)
        insertChain.single = vi.fn(() => resolve(insertResponses, table))
        // raw .insert(...) awaits directly → {error}
        const thenable = {
          then: (res: (x: Resp) => unknown) => resolve(insertResponses, table).then(res),
        }
        return Object.assign(insertChain, thenable)
      })

      // update path — .update(patch).eq(...).eq(...) terminal
      chain.update = vi.fn((patch: Record<string, unknown>) => {
        s.updatedRows.push(patch)
        const updateChain: Record<string, unknown> = {}
        updateChain.eq = vi.fn(() => updateChain)
        const thenable = {
          then: (res: (x: Resp) => unknown) => resolve(updateResponses, table).then(res),
        }
        return Object.assign(updateChain, thenable)
      })

      return chain
    }),
  } as unknown as Parameters<typeof getOrCreateConversation>[0]
}

beforeEach(() => {
  state.clear()
  selectResponses.clear()
  singleResponses.clear()
  maybeSingleResponses.clear()
  insertResponses.clear()
  updateResponses.clear()
})

describe('getOrCreateConversation', () => {
  it('refuses missing input', async () => {
    const r = await getOrCreateConversation(makeSupabase(), {
      companyId: '', operatorId: null, sessionId: 'abc', role: 'client',
    })
    expect(r.error).toBe('invalid_input')
  })

  it('returns existing envelope when (session, company) match', async () => {
    maybeSingleResponses.set('cruz_ai_conversations', { data: { id: 'conv-existing' }, error: null })
    const r = await getOrCreateConversation(makeSupabase(), {
      companyId: 'evco', operatorId: null, sessionId: 'sess-1', role: 'client',
    })
    expect(r.conversationId).toBe('conv-existing')
    expect(r.created).toBe(false)
    expect(r.error).toBeNull()
  })

  it('creates a fresh envelope when none exists', async () => {
    maybeSingleResponses.set('cruz_ai_conversations', { data: null, error: null })
    insertResponses.set('cruz_ai_conversations', { data: { id: 'conv-new' }, error: null })
    const sb = makeSupabase()
    const r = await getOrCreateConversation(sb, {
      companyId: 'evco', operatorId: 'op-1', sessionId: 'sess-1', role: 'operator',
    })
    expect(r.conversationId).toBe('conv-new')
    expect(r.created).toBe(true)
    const inserts = tableState('cruz_ai_conversations').insertedRows
    expect(inserts[0]).toMatchObject({ company_id: 'evco', operator_id: 'op-1', session_id: 'sess-1' })
  })

  it('surfaces insert error on fresh-envelope failure', async () => {
    maybeSingleResponses.set('cruz_ai_conversations', { data: null, error: null })
    insertResponses.set('cruz_ai_conversations', { data: null, error: { message: 'unique violation' } })
    const r = await getOrCreateConversation(makeSupabase(), {
      companyId: 'evco', operatorId: null, sessionId: 'sess-1', role: 'client',
    })
    expect(r.conversationId).toBeNull()
    expect(r.error).toContain('unique violation')
  })
})

describe('loadRecentTurns', () => {
  it('returns [] when conversationId missing', async () => {
    const r = await loadRecentTurns(makeSupabase(), '', 'evco')
    expect(r).toEqual([])
  })

  it('returns [] when the conversation does not belong to the tenant (isolation)', async () => {
    // Ownership lookup returns null → wrong tenant.
    maybeSingleResponses.set('cruz_ai_conversations', { data: null, error: null })
    const r = await loadRecentTurns(makeSupabase(), 'conv-foreign', 'evco')
    expect(r).toEqual([])
  })

  it('happy path: returns turns in chronological (oldest-first) order', async () => {
    maybeSingleResponses.set('cruz_ai_conversations', { data: { id: 'conv-1' }, error: null })
    // Supabase returned newest-first per the .order('turn_index', desc).
    selectResponses.set('cruz_ai_messages', {
      data: [
        { role: 'assistant', content: 'turn 3 (latest)', tools_called: ['query_traficos'], created_at: '2026-04-22T03:00:00Z' },
        { role: 'user', content: 'turn 2', tools_called: null, created_at: '2026-04-22T02:00:00Z' },
        { role: 'user', content: 'turn 1 (oldest)', tools_called: [], created_at: '2026-04-22T01:00:00Z' },
      ],
      error: null,
    })
    const r = await loadRecentTurns(makeSupabase(), 'conv-1', 'evco')
    expect(r).toHaveLength(3)
    expect(r[0]?.content).toBe('turn 1 (oldest)')
    expect(r[2]?.content).toBe('turn 3 (latest)')
    expect(r[2]?.tools_called).toEqual(['query_traficos'])
    // null tools_called normalizes to []
    expect(r[1]?.tools_called).toEqual([])
  })

  it('caps limit at MAX_TURN_WINDOW', async () => {
    maybeSingleResponses.set('cruz_ai_conversations', { data: { id: 'conv-1' }, error: null })
    selectResponses.set('cruz_ai_messages', { data: [], error: null })
    const sb = makeSupabase()
    await loadRecentTurns(sb, 'conv-1', 'evco', 9999)
    expect(tableState('cruz_ai_messages').lastLimit).toBe(CONVERSATION_CONSTANTS.MAX_TURN_WINDOW)
  })

  it('default window is 6 turns', async () => {
    maybeSingleResponses.set('cruz_ai_conversations', { data: { id: 'conv-1' }, error: null })
    selectResponses.set('cruz_ai_messages', { data: [], error: null })
    const sb = makeSupabase()
    await loadRecentTurns(sb, 'conv-1', 'evco')
    expect(tableState('cruz_ai_messages').lastLimit).toBe(6)
  })

  it('filters out unexpected role values (defense in depth)', async () => {
    maybeSingleResponses.set('cruz_ai_conversations', { data: { id: 'conv-1' }, error: null })
    selectResponses.set('cruz_ai_messages', {
      data: [
        { role: 'assistant', content: 'ok', tools_called: [], created_at: 't2' },
        { role: 'system_junk', content: 'should be dropped', tools_called: [], created_at: 't1' },
      ],
      error: null,
    })
    const r = await loadRecentTurns(makeSupabase(), 'conv-1', 'evco')
    expect(r).toHaveLength(1)
    expect(r[0]?.role).toBe('assistant')
  })
})

describe('appendTurn', () => {
  it('refuses missing input', async () => {
    const r = await appendTurn(makeSupabase(), '', 'evco', 'user', 'hi')
    expect(r.success).toBe(false)
    expect(r.error).toBe('invalid_input')
  })

  it('refuses unsupported role', async () => {
    const r = await appendTurn(makeSupabase(), 'c-1', 'evco', 'system' as 'user', 'hi')
    expect(r.success).toBe(false)
    expect(r.error).toBe('invalid_role')
  })

  it('refuses when conversation belongs to a different tenant', async () => {
    maybeSingleResponses.set('cruz_ai_conversations', { data: null, error: null })
    const r = await appendTurn(makeSupabase(), 'conv-foreign', 'evco', 'user', 'hi')
    expect(r.success).toBe(false)
    expect(r.error).toBe('forbidden_tenant_mismatch')
  })

  it('inserts with turn_index = 0 on empty conversation', async () => {
    maybeSingleResponses.set('cruz_ai_conversations', { data: { id: 'conv-1' }, error: null })
    maybeSingleResponses.set('cruz_ai_messages', { data: null, error: null }) // no prior turns
    insertResponses.set('cruz_ai_messages', { data: null, error: null })
    updateResponses.set('cruz_ai_conversations', { data: null, error: null })
    const sb = makeSupabase()
    const r = await appendTurn(sb, 'conv-1', 'evco', 'user', 'primera pregunta')
    expect(r.success).toBe(true)
    expect(r.turnIndex).toBe(0)
    expect(tableState('cruz_ai_messages').insertedRows[0]).toMatchObject({
      conversation_id: 'conv-1',
      turn_index: 0,
      role: 'user',
      content: 'primera pregunta',
    })
  })

  it('computes next turn_index = last + 1', async () => {
    maybeSingleResponses.set('cruz_ai_conversations', { data: { id: 'conv-1' }, error: null })
    maybeSingleResponses.set('cruz_ai_messages', { data: { turn_index: 4 }, error: null })
    insertResponses.set('cruz_ai_messages', { data: null, error: null })
    updateResponses.set('cruz_ai_conversations', { data: null, error: null })
    const r = await appendTurn(makeSupabase(), 'conv-1', 'evco', 'assistant', 'respuesta', {
      toolsCalled: ['query_traficos', 'analyze_trafico'],
      metadata: { topic_class: 'estatus_trafico' },
    })
    expect(r.success).toBe(true)
    expect(r.turnIndex).toBe(5)
    const inserted = tableState('cruz_ai_messages').insertedRows[0]
    expect(inserted.tools_called).toEqual(['query_traficos', 'analyze_trafico'])
    expect(inserted.metadata).toEqual({ topic_class: 'estatus_trafico' })
  })

  it('caps content at MAX_CONTENT_CHARS to defend against runaway payloads', async () => {
    maybeSingleResponses.set('cruz_ai_conversations', { data: { id: 'conv-1' }, error: null })
    maybeSingleResponses.set('cruz_ai_messages', { data: null, error: null })
    insertResponses.set('cruz_ai_messages', { data: null, error: null })
    updateResponses.set('cruz_ai_conversations', { data: null, error: null })
    const huge = 'x'.repeat(CONVERSATION_CONSTANTS.MAX_CONTENT_CHARS + 500)
    const r = await appendTurn(makeSupabase(), 'conv-1', 'evco', 'user', huge)
    expect(r.success).toBe(true)
    const inserted = tableState('cruz_ai_messages').insertedRows[0]
    expect((inserted.content as string).length).toBe(CONVERSATION_CONSTANTS.MAX_CONTENT_CHARS)
  })

  it('surfaces insert error', async () => {
    maybeSingleResponses.set('cruz_ai_conversations', { data: { id: 'conv-1' }, error: null })
    maybeSingleResponses.set('cruz_ai_messages', { data: null, error: null })
    insertResponses.set('cruz_ai_messages', { data: null, error: { message: 'check_violation' } })
    const r = await appendTurn(makeSupabase(), 'conv-1', 'evco', 'user', 'x')
    expect(r.success).toBe(false)
    expect(r.error).toContain('check_violation')
  })
})
