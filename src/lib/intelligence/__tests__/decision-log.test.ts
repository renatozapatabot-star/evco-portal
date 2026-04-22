import { describe, it, expect, vi } from 'vitest'
import {
  logDecision,
  withDecisionLog,
  getRecentDecisions,
  getDecisionHistory,
  recordOutcome,
  recordHumanFeedback,
  truncateJson,
} from '../decision-log'

// ── Fake supabase builder ─────────────────────────────────────────
//
// Captures every method call so tests can assert what the module sent.
// Each builder method returns `this` so the chained PostgREST API is
// satisfied; terminal methods (`.single()`, awaiting the chain) resolve
// with the programmed response.

function makeChain(response: { data: unknown; error: unknown }, recorder?: {
  inserted?: unknown
  filters?: Array<[string, unknown, unknown?]>
  update?: unknown
  order?: [string, boolean]
  limit?: number
  select?: string
}) {
  const api: Record<string, unknown> = {}
  api.insert = (row: unknown) => {
    if (recorder) recorder.inserted = row
    return api
  }
  api.update = (row: unknown) => {
    if (recorder) recorder.update = row
    return api
  }
  api.select = (cols?: string) => {
    if (recorder) recorder.select = cols
    return api
  }
  api.eq = (col: string, val: unknown) => {
    if (recorder) (recorder.filters ?? (recorder.filters = [])).push(['eq', col, val])
    return api
  }
  api.lt = (col: string, val: unknown) => {
    if (recorder) (recorder.filters ?? (recorder.filters = [])).push(['lt', col, val])
    return api
  }
  api.gt = (col: string, val: unknown) => {
    if (recorder) (recorder.filters ?? (recorder.filters = [])).push(['gt', col, val])
    return api
  }
  api.is = (col: string, val: unknown) => {
    if (recorder) (recorder.filters ?? (recorder.filters = [])).push(['is', col, val])
    return api
  }
  api.order = (col: string, opts: { ascending?: boolean } = {}) => {
    if (recorder) recorder.order = [col, !!opts.ascending]
    return api
  }
  api.limit = (n: number) => {
    if (recorder) recorder.limit = n
    return api
  }
  api.single = async () => response
  // Support `await chain` (PostgREST pattern)
  api.then = (resolve: (r: { data: unknown; error: unknown }) => unknown) =>
    Promise.resolve(resolve(response))
  return api
}

function fakeSupabase(responses: Record<string, { data: unknown; error: unknown }>) {
  const calls: Array<{ table: string; recorder: Record<string, unknown> }> = []
  return {
    calls,
    client: {
      from(table: string) {
        const recorder: Record<string, unknown> = {}
        calls.push({ table, recorder })
        const resp = responses[table] ?? { data: null, error: null }
        return makeChain(resp, recorder as never)
      },
    } as never,
  }
}

// ── truncateJson ──────────────────────────────────────────────────

describe('truncateJson', () => {
  it('returns value unchanged when under limit', () => {
    expect(truncateJson({ a: 1 }, 1024)).toEqual({ a: 1 })
  })

  it('returns a marker when value exceeds limit', () => {
    const big = 'x'.repeat(2000)
    const out = truncateJson({ big }, 500) as Record<string, unknown>
    expect(out._truncated).toBe(true)
    expect(out._original_bytes).toBeGreaterThan(500)
    expect(typeof out._preview).toBe('string')
  })

  it('handles non-serializable input without throwing', () => {
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    const out = truncateJson(cyclic)
    // Either returned a marker OR the original value; must not throw.
    expect(out).toBeDefined()
  })
})

// ── logDecision ───────────────────────────────────────────────────

describe('logDecision', () => {
  it('inserts a row with all fields + returns the id', async () => {
    const { calls, client } = fakeSupabase({
      agent_decisions: { data: { id: 'dec-1' }, error: null },
    })
    const id = await logDecision(client, {
      trigger_type: 'chat',
      trigger_id: 'T-1',
      company_id: 'evco',
      tool_name: 'analyze_trafico',
      tool_input: { traficoId: 'T-1' },
      tool_output: { success: true },
      decision: 'Tráfico T-1 · 95% verde',
      reasoning: 'Racha 5 verdes',
      confidence: 1.0,
      autonomy_level: 0,
      action_taken: 'completed',
      processing_ms: 120,
    })

    expect(id).toBe('dec-1')
    const inserted = calls[0].recorder.inserted as Record<string, unknown>
    expect(inserted.company_id).toBe('evco')
    expect(inserted.tool_name).toBe('analyze_trafico')
    expect(inserted.decision).toContain('95% verde')
    expect(inserted.confidence).toBe(1.0)
    expect(inserted.autonomy_level).toBe(0)
    expect(inserted.tool_input).toEqual({ traficoId: 'T-1' })
    expect(inserted.tool_output).toEqual({ success: true })
  })

  it('returns null when the insert fails', async () => {
    const { client } = fakeSupabase({
      agent_decisions: { data: null, error: { message: 'db_down' } },
    })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const id = await logDecision(client, {
      trigger_type: 'test',
      company_id: 'evco',
      decision: 'x',
    })
    expect(id).toBeNull()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('truncates oversized tool_input and tool_output', async () => {
    const { calls, client } = fakeSupabase({
      agent_decisions: { data: { id: 'dec-2' }, error: null },
    })
    const huge = 'x'.repeat(20000)
    await logDecision(client, {
      trigger_type: 'chat',
      company_id: 'evco',
      tool_input: { huge },
      tool_output: { huge },
      decision: 'truncated',
    })
    const inserted = calls[0].recorder.inserted as Record<string, unknown>
    expect((inserted.tool_input as Record<string, unknown>)._truncated).toBe(true)
    expect((inserted.tool_output as Record<string, unknown>)._truncated).toBe(true)
  })

  it('defaults optional fields correctly', async () => {
    const { calls, client } = fakeSupabase({
      agent_decisions: { data: { id: 'dec-3' }, error: null },
    })
    await logDecision(client, {
      trigger_type: 'cron',
      company_id: 'evco',
      decision: 'minimal',
    })
    const inserted = calls[0].recorder.inserted as Record<string, unknown>
    expect(inserted.autonomy_level).toBe(0)
    expect(inserted.confidence).toBeNull()
    expect(inserted.tool_input).toBeNull()
    expect(inserted.tool_output).toBeNull()
    expect(inserted.action_taken).toBeNull()
  })
})

// ── withDecisionLog ───────────────────────────────────────────────

describe('withDecisionLog', () => {
  it('records elapsed time + output summary on success', async () => {
    const { calls, client } = fakeSupabase({
      agent_decisions: { data: { id: 'dec-1' }, error: null },
    })
    const result = await withDecisionLog(
      client,
      {
        companyId: 'evco',
        toolName: 'analyze_trafico',
        triggerId: 'T-1',
        toolInput: { traficoId: 'T-1' },
      },
      async () => ({ success: true, data: { headline_es: 'Headline aquí' } }),
    )
    expect(result).toEqual({ success: true, data: { headline_es: 'Headline aquí' } })

    const inserted = calls[0].recorder.inserted as Record<string, unknown>
    expect(inserted.tool_name).toBe('analyze_trafico')
    expect(inserted.decision).toContain('Headline aquí')
    expect(inserted.action_taken).toBe('completed')
    expect(typeof inserted.processing_ms).toBe('number')
    expect(Number(inserted.processing_ms)).toBeGreaterThanOrEqual(0)
    expect(inserted.tool_output).toEqual({ success: true, data: { headline_es: 'Headline aquí' } })
  })

  it('still logs + re-throws when the wrapped fn rejects', async () => {
    const { calls, client } = fakeSupabase({
      agent_decisions: { data: { id: 'dec-2' }, error: null },
    })
    await expect(
      withDecisionLog(
        client,
        { companyId: 'evco', toolName: 'analyze_trafico' },
        async () => { throw new Error('boom') },
      ),
    ).rejects.toThrow('boom')
    const inserted = calls[0].recorder.inserted as Record<string, unknown>
    expect(inserted.decision).toContain('error')
    expect(String(inserted.action_taken)).toContain('error:')
    expect(String(inserted.reasoning)).toContain('boom')
    expect(inserted.tool_output).toBeNull()
  })

  it('log insert failure does not break the caller', async () => {
    const { client } = fakeSupabase({
      agent_decisions: { data: null, error: { message: 'db_down' } },
    })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await withDecisionLog(
      client,
      { companyId: 'evco', toolName: 'x' },
      async () => 'ok',
    )
    expect(result).toBe('ok')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('uses decisionOverride when provided', async () => {
    const { calls, client } = fakeSupabase({
      agent_decisions: { data: { id: 'dec-3' }, error: null },
    })
    await withDecisionLog(
      client,
      {
        companyId: 'evco',
        toolName: 'x',
        decisionOverride: 'Custom decision headline',
      },
      async () => ({ whatever: 1 }),
    )
    const inserted = calls[0].recorder.inserted as Record<string, unknown>
    expect(inserted.decision).toBe('Custom decision headline')
  })
})

// ── Queries ───────────────────────────────────────────────────────

describe('getRecentDecisions', () => {
  it('returns data and passes companyId + limit + order', async () => {
    const rows = [{ id: 'a' }, { id: 'b' }]
    const { calls, client } = fakeSupabase({
      agent_decisions: { data: rows, error: null },
    })
    const out = await getRecentDecisions(client, 'evco', { limit: 5 })
    expect(out).toEqual(rows)
    const rec = calls[0].recorder
    expect(rec.filters).toEqual([['eq', 'company_id', 'evco']])
    expect(rec.order).toEqual(['created_at', false])
    expect(rec.limit).toBe(5)
  })

  it('returns [] on empty companyId', async () => {
    const { client } = fakeSupabase({})
    expect(await getRecentDecisions(client, '')).toEqual([])
  })

  it('returns [] on query error', async () => {
    const { client } = fakeSupabase({
      agent_decisions: { data: null, error: { message: 'db_down' } },
    })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const out = await getRecentDecisions(client, 'evco')
    expect(out).toEqual([])
    spy.mockRestore()
  })

  it('clamps limit to [1, 500]', async () => {
    const { calls, client } = fakeSupabase({
      agent_decisions: { data: [], error: null },
    })
    await getRecentDecisions(client, 'evco', { limit: 9999 })
    expect(calls[0].recorder.limit).toBe(500)
    await getRecentDecisions(client, 'evco', { limit: 0 })
    expect(calls[1].recorder.limit).toBe(1)
  })
})

describe('getDecisionHistory', () => {
  it('applies toolName + date range + outcomePending filters', async () => {
    const { calls, client } = fakeSupabase({
      agent_decisions: { data: [], error: null },
    })
    await getDecisionHistory(client, 'evco', {
      toolName: 'analyze_trafico',
      after: '2026-04-01T00:00:00Z',
      before: '2026-04-30T00:00:00Z',
      outcomePending: true,
      limit: 10,
    })
    const rec = calls[0].recorder
    const filters = rec.filters as Array<[string, string, unknown]>
    expect(filters).toContainEqual(['eq', 'company_id', 'evco'])
    expect(filters).toContainEqual(['eq', 'tool_name', 'analyze_trafico'])
    expect(filters).toContainEqual(['gt', 'created_at', '2026-04-01T00:00:00Z'])
    expect(filters).toContainEqual(['lt', 'created_at', '2026-04-30T00:00:00Z'])
    expect(filters).toContainEqual(['is', 'outcome', null])
    expect(rec.limit).toBe(10)
  })

  it('returns [] for empty companyId', async () => {
    const { client } = fakeSupabase({})
    expect(await getDecisionHistory(client, '')).toEqual([])
  })
})

// ── Outcome + feedback writes ─────────────────────────────────────

describe('recordOutcome', () => {
  it('writes outcome + outcome_recorded_at', async () => {
    const { calls, client } = fakeSupabase({
      agent_decisions: { data: null, error: null },
    })
    const ok = await recordOutcome(client, 'dec-1', 'verde')
    expect(ok).toBe(true)
    const update = calls[0].recorder.update as Record<string, unknown>
    expect(update.outcome).toBe('verde')
    expect(typeof update.outcome_recorded_at).toBe('string')
    const filters = calls[0].recorder.filters as Array<[string, string, unknown]>
    expect(filters).toContainEqual(['eq', 'id', 'dec-1'])
  })

  it('returns false on empty inputs', async () => {
    const { client } = fakeSupabase({})
    expect(await recordOutcome(client, '', 'verde')).toBe(false)
    expect(await recordOutcome(client, 'dec-1', '')).toBe(false)
  })

  it('returns false on DB error', async () => {
    const { client } = fakeSupabase({
      agent_decisions: { data: null, error: { message: 'nope' } },
    })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await recordOutcome(client, 'dec-1', 'verde')).toBe(false)
    spy.mockRestore()
  })
})

describe('recordHumanFeedback', () => {
  it('writes human_feedback with reviewed_at auto-set', async () => {
    const { calls, client } = fakeSupabase({
      agent_decisions: { data: null, error: null },
    })
    const ok = await recordHumanFeedback(client, 'dec-1', {
      sentiment: 'positive',
      note_es: 'Buena recomendación.',
      reviewer_id: 'renato',
    })
    expect(ok).toBe(true)
    const update = calls[0].recorder.update as Record<string, unknown>
    const hf = update.human_feedback as Record<string, unknown>
    expect(hf.sentiment).toBe('positive')
    expect(hf.note_es).toBe('Buena recomendación.')
    expect(hf.reviewer_id).toBe('renato')
    expect(typeof hf.reviewed_at).toBe('string')
  })

  it('returns false on empty id', async () => {
    const { client } = fakeSupabase({})
    expect(
      await recordHumanFeedback(client, '', { sentiment: 'neutral' }),
    ).toBe(false)
  })
})
