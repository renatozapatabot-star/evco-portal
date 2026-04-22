/**
 * Phase 3 #3 integration test — every CRUZ AI exec tool logs to
 * agent_decisions via the Phase 3 #1 dispatch path.
 *
 * Mocks `runIntelligenceAgent` + the adminStub supabase `.from()` chain
 * used for tenant lookup + agent_decisions insert. Asserts:
 *   1. Each of the 4 tools writes an agent_decisions row on success.
 *   2. The row captures the correct tool_name + workflow + trigger_id.
 *   3. A thrown tool still writes a row with action_taken='error:…'.
 *   4. A log insert failure does not break the caller.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-role-key'

const agentMocks = vi.hoisted(() => ({
  runIntelligenceAgent: vi.fn(),
}))

vi.mock('@/lib/intelligence/agent', async () => {
  const actual = await vi.importActual<typeof import('@/lib/intelligence/agent')>(
    '@/lib/intelligence/agent',
  )
  return { ...actual, runIntelligenceAgent: agentMocks.runIntelligenceAgent }
})

// Programmable admin-client stub that routes by table name.
const tableResponses: Record<string, { insertId?: string; insertError?: string }> = {}
const tableInserts: Record<string, unknown[]> = {}

const adminStub = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => adminStub,
}))

import { runTool, type AguilaCtx } from '../tools'
import type { TraficoFocusReport } from '@/lib/intelligence/agent'

beforeEach(() => {
  agentMocks.runIntelligenceAgent.mockReset()
  for (const k of Object.keys(tableInserts)) delete tableInserts[k]
  for (const k of Object.keys(tableResponses)) delete tableResponses[k]
  adminStub.from.mockImplementation((table: string) => {
    tableInserts[table] = tableInserts[table] ?? []
    const resp = tableResponses[table] ?? {}
    const api: Record<string, unknown> = {}
    api.insert = (row: unknown) => {
      tableInserts[table].push(row)
      return api
    }
    api.select = () => api
    api.eq = () => api
    api.or = () => api
    api.maybeSingle = async () => {
      // companies table: pretend clientFilter always resolves to its own slug
      if (table === 'companies') return { data: { company_id: 'evco' }, error: null }
      return { data: null, error: null }
    }
    api.limit = () => api
    api.single = async () => {
      if (resp.insertError) return { data: null, error: { message: resp.insertError } }
      return { data: { id: resp.insertId ?? 'dec-1' }, error: null }
    }
    return api
  })
})

function traficoReport(): TraficoFocusReport {
  return {
    mode_label: 'trafico_focus',
    generated_at: '2026-04-22T00:00:00Z',
    company_id: 'evco',
    window_days: 90,
    insight: {
      target: { type: 'trafico', traficoId: 'T-1' },
      cve_producto: 'SKU-HOT',
      generated_at: '2026-04-22T00:00:00Z',
      company_id: 'evco',
      signals: {
        prediction: {
          cve_producto: 'SKU-HOT',
          probability: 0.95,
          band: 'high',
          summary: 'Probabilidad 95%',
          factors: [],
          baseline_pct: 85,
          cve_proveedor: 'PRV_1',
          last_fecha_cruce: '2026-04-20T00:00:00Z',
          total_crossings: 8,
        },
        streak: {
          cve_producto: 'SKU-HOT',
          current_verde_streak: 5,
          longest_verde_streak: 5,
          just_broke_streak: false,
          last_semaforo: 0,
          last_fecha_cruce: '2026-04-20T00:00:00Z',
          total_crossings: 8,
        },
        proveedor: null,
        fraccionHealth: null,
        baselinePct: 85,
        fraccion: '3903.20.01',
      },
      explanation: {
        headline: 'Probabilidad 95%',
        confidence_band_label: 'alta',
        confidence_band_en: 'high',
        probability_pct: 95,
        bullets: [],
        meta: '',
      },
      one_line: 'x',
      plain_text: 'x',
      recommendations: [],
      summary_es: 'Tráfico T-1: 95% verde · confianza alta.',
    },
    recommendations: [],
    summary_es: 'Tráfico T-1 · 95% verde · confianza alta.',
  }
}

const clientCtx: AguilaCtx = {
  companyId: 'evco',
  role: 'client',
  userId: 'u1',
  operatorId: null,
  supabase: {} as never,
}

describe('Phase 3 #3 integration — CRUZ AI exec tools log decisions', () => {
  it('analyze_trafico writes a decision row', async () => {
    agentMocks.runIntelligenceAgent.mockResolvedValue(traficoReport())
    await runTool('analyze_trafico', { traficoId: 'T-1' }, clientCtx)
    expect(tableInserts['agent_decisions']).toBeDefined()
    const row = tableInserts['agent_decisions'][0] as Record<string, unknown>
    expect(row.tool_name).toBe('analyze_trafico')
    expect(row.workflow).toBe('cruz_ai_chat')
    expect(row.company_id).toBe('evco')
    expect(row.trigger_id).toBe('T-1')
    expect(row.action_taken).toBe('completed')
    expect(typeof row.processing_ms).toBe('number')
    expect((row.tool_input as { traficoId: string }).traficoId).toBe('T-1')
  })

  it('analyze_pedimento writes a decision row with trigger_id = pedimento', async () => {
    agentMocks.runIntelligenceAgent.mockResolvedValue(traficoReport())
    await runTool(
      'analyze_pedimento',
      { pedimentoNumber: '26 24 3596 6500441' },
      clientCtx,
    )
    const row = tableInserts['agent_decisions']?.[0] as Record<string, unknown>
    expect(row.tool_name).toBe('analyze_pedimento')
    expect(row.trigger_id).toBe('26 24 3596 6500441')
  })

  it('tenant_anomalies writes a decision row', async () => {
    agentMocks.runIntelligenceAgent.mockResolvedValue({
      mode_label: 'anomaly_only',
      generated_at: '2026-04-22T00:00:00Z',
      company_id: 'evco',
      window_days: 90,
      anomaly_report: {
        generated_at: '2026-04-22T00:00:00Z',
        company_id: 'evco',
        window_days: 90,
        groups: [],
        total_count: 0,
        recommendations: [],
        summary_es: 'calm',
        insights: {} as never,
      },
      recommendations: [],
      summary_es: 'evco: calma',
    })
    await runTool('tenant_anomalies', { windowDays: 30 }, clientCtx)
    const row = tableInserts['agent_decisions']?.[0] as Record<string, unknown>
    expect(row.tool_name).toBe('tenant_anomalies')
    expect((row.tool_input as { windowDays: number }).windowDays).toBe(30)
  })

  it('intelligence_scan writes a decision row', async () => {
    agentMocks.runIntelligenceAgent.mockResolvedValue({
      mode_label: 'tenant_scan',
      generated_at: '2026-04-22T00:00:00Z',
      company_id: 'evco',
      window_days: 90,
      insights: {
        generated_at: '', company_id: 'evco', green_streaks: [], broken_streaks: [],
        top_proveedores: [], watch_proveedores: [], anomalies: [],
        volume: { recent_7d: 0, prior_7d: 0, ratio: null, delta_pct: null, daily_series: [] },
        fraccion_health: [], top_predictions: [], watch_predictions: [],
        baseline_verde_pct: 0,
      },
      anomaly_report: {
        generated_at: '', company_id: 'evco', window_days: 90, groups: [],
        total_count: 0, recommendations: [], summary_es: '', insights: {} as never,
      },
      focus_insights: [],
      recommendations: [],
      summary_es: 'x',
    })
    await runTool('intelligence_scan', { query: 'panorama' }, clientCtx)
    const row = tableInserts['agent_decisions']?.[0] as Record<string, unknown>
    expect(row.tool_name).toBe('intelligence_scan')
    expect((row.tool_input as { query: string }).query).toBe('panorama')
  })

  it('tool rejection from the agent surfaces as structured error in tool_output', async () => {
    // analyzeTrafico is contractually non-throwing — it catches the agent's
    // rejection and returns { success: false, error }. withDecisionLog sees
    // that as a completed call with structured error inside tool_output.
    agentMocks.runIntelligenceAgent.mockRejectedValue(new Error('db_exploded'))
    const res = await runTool('analyze_trafico', { traficoId: 'T-1' }, clientCtx)
    const inner = res.result as { success: boolean; error: string | null }
    expect(inner.success).toBe(false)
    expect(inner.error).toContain('db_exploded')
    const row = tableInserts['agent_decisions']?.[0] as Record<string, unknown>
    expect(row).toBeDefined()
    expect(row.action_taken).toBe('completed')
    const toolOutput = row.tool_output as { success: boolean; error: string }
    expect(toolOutput.success).toBe(false)
    expect(toolOutput.error).toContain('db_exploded')
  })

  it('log insert failure does not break the caller', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    tableResponses['agent_decisions'] = { insertError: 'insert_denied' }
    agentMocks.runIntelligenceAgent.mockResolvedValue(traficoReport())
    const res = await runTool('analyze_trafico', { traficoId: 'T-1' }, clientCtx)
    const inner = res.result as { success: boolean }
    expect(inner.success).toBe(true) // user-facing response still OK
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})
