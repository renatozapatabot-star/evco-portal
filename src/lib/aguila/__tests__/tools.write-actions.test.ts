/**
 * Executor contract for the three write-gated tools.
 *
 * Exercises `runTool` with `flag_shipment`, `draft_mensajeria_to_anabel`,
 * and `open_oca_request` so the Anthropic tool-use path is covered the
 * same way the streaming route calls it. Tenant isolation, payload
 * normalization, and the ActionProposalResponse shape are all here.
 */

import { describe, it, expect, beforeEach } from 'vitest'

// Env BEFORE imports — `tools.ts` + `mentions.ts` build module-level
// Supabase clients at load time and throw on missing env vars.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-role-key'

const { runTool, isWriteGatedTool } = await import('../tools')
type ToolName = Parameters<typeof runTool>[0]
type AguilaCtx = Parameters<typeof runTool>[2]
const { CANCEL_WINDOW_MS } = await import('../actions')

interface FakeRow {
  id: string
  created_at: string
  company_id: string
  actor_id: string | null
  actor_role: string
  kind: string
  payload: Record<string, unknown>
  summary_es: string
  status: string
  commit_deadline_at: string
  committed_at: string | null
  cancelled_at: string | null
  cancel_reason_es: string | null
  decision_id: string | null
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// Minimal Supabase stub covering only the call shape
// `proposeAction` uses: `.from('agent_actions').insert(row).select('*').single()`.
function makeSupabaseStub() {
  const rows: FakeRow[] = []
  return {
    rows,
    client: {
      from: (table: string) => {
        if (table !== 'agent_actions') throw new Error(`unexpected table ${table}`)
        return {
          insert: (row: Omit<FakeRow, 'id' | 'created_at'>) => {
            const full: FakeRow = {
              id: `act-${rows.length + 1}`,
              created_at: new Date().toISOString(),
              ...row,
            }
            rows.push(full)
            return {
              select: () => ({
                single: async () => ({ data: full, error: null }),
              }),
            }
          },
        }
      },
    } as any,
  }
}

describe('write-gated tool registry', () => {
  it('tags exactly the three action tools as write-gated', () => {
    const expected: ToolName[] = ['flag_shipment', 'draft_mensajeria_to_anabel', 'open_oca_request']
    for (const name of expected) expect(isWriteGatedTool(name)).toBe(true)
    // A sample of read-only tools must NOT be gated — otherwise the
    // streaming route would emit spurious action events.
    const readOnly: ToolName[] = ['query_traficos', 'analyze_trafico', 'intelligence_scan']
    for (const name of readOnly) expect(isWriteGatedTool(name)).toBe(false)
  })
})

describe('runTool: flag_shipment', () => {
  let stub: ReturnType<typeof makeSupabaseStub>
  let ctx: AguilaCtx
  beforeEach(() => {
    stub = makeSupabaseStub()
    ctx = { companyId: 'evco', role: 'client', userId: 'u-1', operatorId: 'op-1', supabase: stub.client }
  })

  it('proposes, inserts with session companyId, and returns the action envelope', async () => {
    const r = await runTool(
      'flag_shipment',
      { traficoId: 'Y-1234', reasonEs: 'Documento faltante', severity: 'warn' },
      ctx,
    )
    expect(r.tool).toBe('flag_shipment')
    const env = r.result as {
      success: boolean
      awaiting_commit: boolean
      action_id: string | null
      kind: string | null
      summary_es: string | null
      cancel_window_ms: number
      commit_deadline_at: string | null
      message_es: string
    }
    expect(env.success).toBe(true)
    expect(env.awaiting_commit).toBe(true)
    expect(env.action_id).toBeTruthy()
    expect(env.kind).toBe('flag_shipment')
    expect(env.cancel_window_ms).toBe(CANCEL_WINDOW_MS)
    expect(env.summary_es).toContain('Y-1234')
    expect(env.message_es).toContain('5 segundos')
    const deadline = new Date(env.commit_deadline_at ?? '').getTime()
    expect(deadline).toBeGreaterThan(Date.now() - 100)

    // Tenant stamp + actor role carried from the session.
    expect(stub.rows).toHaveLength(1)
    expect(stub.rows[0].company_id).toBe('evco')
    expect(stub.rows[0].actor_role).toBe('client')
    expect(stub.rows[0].actor_id).toBe('op-1') // operatorId preferred over userId
    expect(stub.rows[0].payload).toEqual({
      trafico_id: 'Y-1234',
      reason_es: 'Documento faltante',
      severity: 'warn',
    })
    expect(stub.rows[0].status).toBe('proposed')
  })

  it('defaults severity to "warn" when omitted', async () => {
    await runTool('flag_shipment', { traficoId: 'Y-9', reasonEs: 'x' }, ctx)
    expect(stub.rows[0].payload).toMatchObject({ severity: 'warn' })
  })

  it('returns an error envelope (not a throw) when payload is invalid', async () => {
    const r = await runTool('flag_shipment', { traficoId: 'Y-1' }, ctx) // missing reasonEs
    const env = r.result as { success: boolean; awaiting_commit: boolean; error: string | null; error_detail: string | null }
    expect(env.success).toBe(false)
    expect(env.awaiting_commit).toBe(false)
    expect(env.error).toBe('invalid_payload')
    expect(env.error_detail).toContain('reason_es')
    expect(stub.rows).toHaveLength(0) // nothing inserted
  })
})

describe('runTool: draft_mensajeria_to_anabel', () => {
  it('inserts subject+body and only includes optional refs when provided', async () => {
    const stub = makeSupabaseStub()
    const ctx: AguilaCtx = {
      companyId: 'mafesa',
      role: 'operator',
      userId: 'u-7',
      operatorId: 'op-7',
      supabase: stub.client,
    }
    const r = await runTool(
      'draft_mensajeria_to_anabel',
      {
        subjectEs: 'Duda sobre factura del mes',
        bodyEs: 'Anabel, queremos confirmar el saldo al día.',
        relatedPedimento: '26 24 3596 6500441',
      },
      ctx,
    )
    const env = r.result as { success: boolean; kind: string | null }
    expect(env.success).toBe(true)
    expect(env.kind).toBe('draft_mensajeria_to_anabel')
    expect(stub.rows[0].company_id).toBe('mafesa')
    expect(stub.rows[0].payload).toEqual({
      subject_es: 'Duda sobre factura del mes',
      body_es: 'Anabel, queremos confirmar el saldo al día.',
      related_pedimento: '26 24 3596 6500441',
    })
    // related_trafico_id intentionally omitted — only truthy optional keys flow through.
    expect(stub.rows[0].payload).not.toHaveProperty('related_trafico_id')
  })
})

describe('runTool: open_oca_request', () => {
  it('rejects stripped-dots fracción (invariant #8)', async () => {
    const stub = makeSupabaseStub()
    const ctx: AguilaCtx = { companyId: 'evco', role: 'client', userId: null, operatorId: null, supabase: stub.client }
    const r = await runTool(
      'open_oca_request',
      {
        productDescriptionEs: 'Polipropileno granulado',
        reasonEs: 'Duda clasificación',
        fraccion: '39012001', // dots stripped — Zod rejects
      },
      ctx,
    )
    const env = r.result as { success: boolean; error: string | null; error_detail: string | null }
    expect(env.success).toBe(false)
    expect(env.error).toBe('invalid_payload')
    expect(env.error_detail).toContain('fraccion')
    expect(stub.rows).toHaveLength(0)
  })

  it('accepts a well-formed fracción and passes optional traficoId + cveProducto through', async () => {
    const stub = makeSupabaseStub()
    const ctx: AguilaCtx = { companyId: 'evco', role: 'broker', userId: 'tito', operatorId: 'op-tito', supabase: stub.client }
    const r = await runTool(
      'open_oca_request',
      {
        productDescriptionEs: 'Resina PP homopolímero',
        reasonEs: 'Dos fracciones candidatas',
        fraccion: '3901.20.01',
        traficoId: 'Y-1234',
        cveProducto: 'PP-100',
      },
      ctx,
    )
    const env = r.result as { success: boolean; action_id: string | null }
    expect(env.success).toBe(true)
    expect(env.action_id).toBeTruthy()
    expect(stub.rows[0].payload).toEqual({
      product_description_es: 'Resina PP homopolímero',
      reason_es: 'Dos fracciones candidatas',
      fraccion: '3901.20.01',
      trafico_id: 'Y-1234',
      cve_producto: 'PP-100',
    })
    expect(stub.rows[0].actor_role).toBe('broker')
  })
})
