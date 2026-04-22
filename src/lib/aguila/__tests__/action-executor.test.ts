import { describe, it, expect, beforeEach, vi } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Executor contract:
 *   - Never throws to the caller on validation or downstream failure.
 *   - Returns `{ ok: true, result }` with a `downstream: 'mensajeria.thread'`
 *     marker + `thread_id` reference on success.
 *   - Returns `{ ok: false, errorEs }` with Spanish copy safe for the UI.
 *   - Dispatches to the correct downstream primitive per `kind`.
 */

const createThreadMock = vi.fn()
const findOrCreateByTraficoMock = vi.fn()

vi.mock('@/lib/mensajeria/threads', () => ({
  createThread: (...args: unknown[]) => createThreadMock(...args),
  findOrCreateThreadByTrafico: (...args: unknown[]) => findOrCreateByTraficoMock(...args),
}))

import { runExecutor } from '../action-executor'
import type { AgentActionRow } from '../actions'

function actionRow(partial: Partial<AgentActionRow>): AgentActionRow {
  return {
    id: 'a1',
    created_at: new Date().toISOString(),
    company_id: 'evco',
    actor_id: 'user-1',
    actor_role: 'operator',
    kind: 'flag_shipment',
    payload: {},
    summary_es: 'x',
    status: 'committed',
    commit_deadline_at: new Date().toISOString(),
    committed_at: new Date().toISOString(),
    cancelled_at: null,
    cancel_reason_es: null,
    decision_id: null,
    executed_at: null,
    executed_by: null,
    executed_by_role: null,
    execute_attempts: 0,
    execute_error_es: null,
    execute_result: null,
    ...partial,
  }
}

const ctx = {
  supabase: {} as any,
  executorId: 'op-1',
  executorRole: 'operator' as const,
}

beforeEach(() => {
  createThreadMock.mockReset()
  findOrCreateByTraficoMock.mockReset()
})

describe('runExecutor · flag_shipment', () => {
  it('creates an escalated, internal-only mensajeria thread on the trafico', async () => {
    findOrCreateByTraficoMock.mockResolvedValue({
      data: { id: 'thread-1' },
      error: null,
    })
    const action = actionRow({
      kind: 'flag_shipment',
      payload: { trafico_id: 'Y-9001', reason_es: 'Documento faltante', severity: 'warn' },
      summary_es: 'Flag Y-9001',
    })
    const r = await runExecutor(action, ctx)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.result.downstream).toBe('mensajeria.thread')
    expect(r.result.thread_id).toBe('thread-1')
    expect(findOrCreateByTraficoMock).toHaveBeenCalledTimes(1)
    const call = findOrCreateByTraficoMock.mock.calls[0][0]
    expect(call.companyId).toBe('evco')
    expect(call.traficoId).toBe('Y-9001')
    expect(call.internalOnly).toBe(true)
    expect(call.role).toBe('system')
  })

  it('rejects a flag_shipment missing trafico_id', async () => {
    const action = actionRow({
      kind: 'flag_shipment',
      payload: { reason_es: 'x', severity: 'info' },
    })
    const r = await runExecutor(action, ctx)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errorEs).toMatch(/tráfico|trafico/i)
  })

  it('surfaces a mensajeria error as a Spanish-safe errorEs', async () => {
    findOrCreateByTraficoMock.mockResolvedValue({
      data: null,
      error: { code: 'DB_ERROR', message: 'conexión perdida' },
    })
    const action = actionRow({
      kind: 'flag_shipment',
      payload: { trafico_id: 'Y-1', reason_es: 'x', severity: 'warn' },
    })
    const r = await runExecutor(action, ctx)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errorEs).toBe('conexión perdida')
  })
})

describe('runExecutor · draft_mensajeria_to_anabel', () => {
  it('creates an internal-only thread tagged for Anabel', async () => {
    createThreadMock.mockResolvedValue({ data: { id: 'thread-2' }, error: null })
    const action = actionRow({
      kind: 'draft_mensajeria_to_anabel',
      payload: {
        subject_es: 'Duda sobre factura',
        body_es: 'Anabel, ¿cerraste el saldo?',
        related_trafico_id: 'Y-7',
      },
    })
    const r = await runExecutor(action, ctx)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.result.recipient).toBe('anabel')
    expect(r.result.thread_id).toBe('thread-2')
    const call = createThreadMock.mock.calls[0][0]
    expect(call.internalOnly).toBe(true)
    expect(call.role).toBe('system')
    expect(call.traficoId).toBe('Y-7')
  })

  it('rejects a draft with no body', async () => {
    const action = actionRow({
      kind: 'draft_mensajeria_to_anabel',
      payload: { subject_es: 'Asunto', body_es: '' },
    })
    const r = await runExecutor(action, ctx)
    expect(r.ok).toBe(false)
  })
})

describe('runExecutor · open_oca_request', () => {
  it('creates an internal thread marking oca_stage=requested', async () => {
    createThreadMock.mockResolvedValue({ data: { id: 'thread-3' }, error: null })
    const action = actionRow({
      kind: 'open_oca_request',
      payload: {
        product_description_es: 'Polipropileno granulado',
        reason_es: 'Duda sobre fracción',
        fraccion: '3901.20.01',
      },
    })
    const r = await runExecutor(action, ctx)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.result.oca_stage).toBe('requested')
    expect(r.result.thread_id).toBe('thread-3')
    const call = createThreadMock.mock.calls[0][0]
    expect(call.internalOnly).toBe(true)
    expect(call.subject).toMatch(/OCA/)
  })

  it('rejects an OCA request missing motivo', async () => {
    const action = actionRow({
      kind: 'open_oca_request',
      payload: { product_description_es: 'Polipropileno', reason_es: '' },
    })
    const r = await runExecutor(action, ctx)
    expect(r.ok).toBe(false)
  })
})

describe('runExecutor · error guard', () => {
  it('catches a throw inside the primitive and returns a safe errorEs', async () => {
    createThreadMock.mockImplementation(() => {
      throw new Error('ECONNRESET: mensajeria caída')
    })
    const action = actionRow({
      kind: 'draft_mensajeria_to_anabel',
      payload: { subject_es: 's', body_es: 'b' },
    })
    const r = await runExecutor(action, ctx)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errorEs).toContain('mensajeria caída')
  })
})
