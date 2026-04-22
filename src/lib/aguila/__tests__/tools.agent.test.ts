/**
 * Phase 3 #1 — CRUZ AI agent-tool tests.
 *
 * Each tool is tested in two shapes:
 *   1. Standalone (`analyzeTrafico`, `analyzePedimento`, `getTenantAnomalies`,
 *      `getFullIntelligence`) — the library entry points.
 *   2. Exec wrapper (dispatched via `runTool('analyze_trafico', …)`) —
 *      the CRUZ AI entry point that enforces scope resolution.
 *
 * `runIntelligenceAgent` is mocked per-test so we exercise the Spanish
 * formatter deterministically without hitting Supabase or the DB-facing
 * agent helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Env BEFORE imports — the tools module instantiates supabaseAdmin at load.
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://stub.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'stub-service-role-key'

// Hoisted mock for the intelligence agent. `vi.hoisted` ensures the mock
// reference is available before the `vi.mock` factory runs.
const agentMocks = vi.hoisted(() => {
  return {
    runIntelligenceAgent: vi.fn(),
  }
})

vi.mock('@/lib/intelligence/agent', async () => {
  const actual = await vi.importActual<typeof import('@/lib/intelligence/agent')>(
    '@/lib/intelligence/agent',
  )
  return {
    ...actual,
    runIntelligenceAgent: agentMocks.runIntelligenceAgent,
  }
})

// Mock supabaseAdmin usage inside exec wrappers (tenant lookups, pedimento
// resolution). The standalone functions take an explicit `supabase` arg so
// we can stub per-test.
const adminStub = vi.hoisted(() => {
  return { from: vi.fn() }
})
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => adminStub,
}))

import {
  analyzeTrafico,
  analyzePedimento,
  getTenantAnomalies,
  getFullIntelligence,
  runTool,
  type AguilaCtx,
} from '../tools'
import type {
  AgentReport,
  SkuFocusReport,
  TraficoFocusReport,
  TenantScanReport,
  AnomalyOnlyReport,
} from '@/lib/intelligence/agent'

// ── Fixtures ──────────────────────────────────────────────────────

function traficoReport(overrides: Partial<TraficoFocusReport> = {}): TraficoFocusReport {
  const base: TraficoFocusReport = {
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
          factors: [
            { factor: 'streak', delta_pp: 15, detail: '5 verdes consecutivos (+15 pp)' },
          ],
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
        proveedor: {
          cve_proveedor: 'PRV_1',
          total_crossings: 12,
          verde_count: 11,
          amarillo_count: 1,
          rojo_count: 0,
          pct_verde: 92,
          last_fecha_cruce: '2026-04-20T00:00:00Z',
        },
        fraccionHealth: null,
        baselinePct: 85,
        fraccion: '3903.20.01',
      },
      explanation: {
        headline: 'Probabilidad 95%',
        confidence_band_label: 'alta',
        confidence_band_en: 'high',
        probability_pct: 95,
        bullets: [
          {
            kind: 'streak',
            signed_delta: 15,
            label: '5 verdes consecutivos (+15 pp)',
            tone: 'positive',
          },
        ],
        meta: 'PRV_1 · 8 cruces · 2026-04-20',
      },
      one_line: 'SKU-HOT · 95% verde (alta) · 5 verdes consecutivos',
      plain_text: 'SKU-HOT\n95% probabilidad verde',
      recommendations: [
        {
          kind: 'celebrate_streak',
          priority: 'low',
          subject: 'SKU-HOT',
          action_es: 'Celebra la racha: SKU-HOT lleva 5 verdes consecutivos.',
          rationale_es: 'Racha fuerte.',
          metadata: {},
        },
      ],
      summary_es: 'Tráfico T-1 (SKU dominante SKU-HOT): 95% verde · confianza alta · operación en calma.',
    },
    recommendations: [
      {
        kind: 'celebrate_streak',
        priority: 'low',
        subject: 'SKU-HOT',
        action_es: 'Celebra la racha: SKU-HOT lleva 5 verdes consecutivos.',
        rationale_es: 'Racha fuerte.',
        metadata: {},
      },
    ],
    summary_es: 'Tráfico T-1 · 95% verde · confianza alta.',
  }
  return { ...base, ...overrides }
}

function skuFocusReport(cve = 'SKU-HOT'): SkuFocusReport {
  const t = traficoReport()
  return {
    ...t,
    mode_label: 'sku_focus',
    insight: t.insight ? { ...t.insight, target: { type: 'sku', cveProducto: cve } } : null,
  }
}

function anomalyReport(): AnomalyOnlyReport {
  return {
    mode_label: 'anomaly_only',
    generated_at: '2026-04-22T00:00:00Z',
    company_id: 'evco',
    window_days: 90,
    anomaly_report: {
      generated_at: '2026-04-22T00:00:00Z',
      company_id: 'evco',
      window_days: 90,
      groups: [
        {
          kind: 'new_proveedor',
          label_es: 'Proveedor nuevo',
          anomalies: [
            {
              kind: 'new_proveedor',
              subject: 'PRV_NEW',
              detail: 'Primer cruce',
              score: 0.5,
              occurred_at: '2026-04-20T00:00:00Z',
              metadata: {},
            },
          ],
          max_score: 0.5,
        },
      ],
      total_count: 1,
      recommendations: [
        {
          kind: 'validate_new_proveedor',
          priority: 'medium',
          subject: 'PRV_NEW',
          action_es: 'Valida proveedor nuevo PRV_NEW antes de escalar volumen.',
          rationale_es: 'Primer cruce observado.',
          metadata: {},
        },
      ],
      summary_es: 'evco: 1 anomalía · Proveedor nuevo (1).',
      insights: {} as never, // not consumed by formatter
    },
    recommendations: [
      {
        kind: 'validate_new_proveedor',
        priority: 'medium',
        subject: 'PRV_NEW',
        action_es: 'Valida proveedor nuevo PRV_NEW antes de escalar volumen.',
        rationale_es: 'Primer cruce observado.',
        metadata: {},
      },
    ],
    summary_es: 'evco: 1 anomalía · Proveedor nuevo (1).',
  }
}

function tenantScanReport(): TenantScanReport {
  return {
    mode_label: 'tenant_scan',
    generated_at: '2026-04-22T00:00:00Z',
    company_id: 'evco',
    window_days: 90,
    insights: {
      generated_at: '2026-04-22T00:00:00Z',
      company_id: 'evco',
      green_streaks: [],
      broken_streaks: [],
      top_proveedores: [],
      watch_proveedores: [],
      anomalies: [
        {
          kind: 'new_proveedor',
          subject: 'PRV_NEW',
          detail: 'Primer cruce',
          score: 0.5,
          occurred_at: '2026-04-20T00:00:00Z',
          metadata: {},
        },
      ],
      volume: { recent_7d: 20, prior_7d: 15, ratio: 1.33, delta_pct: 33, daily_series: [] },
      fraccion_health: [],
      top_predictions: [],
      watch_predictions: [],
      baseline_verde_pct: 88,
    },
    anomaly_report: anomalyReport().anomaly_report,
    focus_insights: [traficoReport().insight!],
    recommendations: [
      {
        kind: 'validate_new_proveedor',
        priority: 'medium',
        subject: 'PRV_NEW',
        action_es: 'Valida proveedor nuevo PRV_NEW antes de escalar volumen.',
        rationale_es: 'Primer cruce observado.',
        metadata: {},
      },
    ],
    summary_es: 'evco: verde base 88% · 1 anomalía · Proveedor nuevo (1).',
  }
}

beforeEach(() => {
  agentMocks.runIntelligenceAgent.mockReset()
  adminStub.from.mockReset()
})

// ── analyzeTrafico ────────────────────────────────────────────────

describe('analyzeTrafico (standalone)', () => {
  it('formats a trafico_focus report into Spanish structured response', async () => {
    agentMocks.runIntelligenceAgent.mockResolvedValue(traficoReport())
    const res = await analyzeTrafico({} as never, 'evco', 'T-1')

    expect(res.success).toBe(true)
    expect(res.error).toBeNull()
    expect(res.data).not.toBeNull()
    expect(res.data!.type).toBe('trafico_focus')
    expect(res.data!.cve_producto).toBe('SKU-HOT')
    expect(res.data!.trafico_id).toBe('T-1')
    expect(res.data!.probability_pct).toBe(95)
    expect(res.data!.band_es).toBe('alta')
    expect(res.data!.proveedor).toContain('PRV_1')
    expect(res.data!.fraccion).toBe('3903.20.01')
    expect(res.data!.headline_es).toContain('Tráfico T-1')
    expect(res.data!.factors).toHaveLength(1)
    expect(res.data!.factors[0].tone).toBe('positive')
    // celebrate_streak is kept (not filtered as no_action)
    expect(res.data!.recommendations.length).toBeGreaterThan(0)
    expect(res.data!.next_steps_es[0]).toMatch(/^1\./)
  })

  it('returns null data + error when agent returns no insight', async () => {
    const empty: TraficoFocusReport = {
      ...traficoReport(),
      insight: null,
    }
    agentMocks.runIntelligenceAgent.mockResolvedValue(empty)
    const res = await analyzeTrafico({} as never, 'evco', 'T-EMPTY')
    expect(res.success).toBe(true)
    expect(res.data).toBeNull()
    expect(res.error).toMatch(/sin señal/)
  })

  it('rejects empty companyId', async () => {
    const res = await analyzeTrafico({} as never, '', 'T-1')
    expect(res.success).toBe(false)
    expect(res.error).toBe('invalid_companyId')
  })

  it('rejects empty traficoId', async () => {
    const res = await analyzeTrafico({} as never, 'evco', '  ')
    expect(res.success).toBe(false)
    expect(res.error).toBe('invalid_traficoId')
  })

  it('wraps agent errors in the envelope', async () => {
    agentMocks.runIntelligenceAgent.mockRejectedValue(new Error('db_exploded'))
    const res = await analyzeTrafico({} as never, 'evco', 'T-1')
    expect(res.success).toBe(false)
    expect(res.error).toBe('db_exploded')
  })
})

// ── analyzePedimento ──────────────────────────────────────────────

describe('analyzePedimento (standalone)', () => {
  function supabaseWith(trafico: string | null) {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            or: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: trafico ? { trafico, pedimento: '26 24 3596 6500441' } : null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    }
  }

  it('resolves pedimento → trafico then delegates to analyzeTrafico', async () => {
    agentMocks.runIntelligenceAgent.mockResolvedValue(traficoReport())
    const res = await analyzePedimento(
      supabaseWith('T-1') as never,
      'evco',
      '26 24 3596 6500441',
    )
    expect(res.success).toBe(true)
    expect(res.data!.type).toBe('trafico_focus')
    expect(res.data!.trafico_id).toBe('T-1')
  })

  it('returns error when pedimento resolves to no trafico', async () => {
    const res = await analyzePedimento(
      supabaseWith(null) as never,
      'evco',
      '99 99 9999 9999999',
    )
    expect(res.success).toBe(true)
    expect(res.data).toBeNull()
    expect(res.error).toMatch(/no encontrado/)
  })

  it('rejects empty inputs', async () => {
    const a = await analyzePedimento({} as never, '', '26 24 3596 6500441')
    expect(a.success).toBe(false)
    expect(a.error).toBe('invalid_companyId')

    const b = await analyzePedimento({} as never, 'evco', '')
    expect(b.success).toBe(false)
    expect(b.error).toBe('invalid_pedimentoNumber')
  })

  it('wraps supabase errors', async () => {
    const sb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            or: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: { message: 'boom' } }),
              }),
            }),
          }),
        }),
      }),
    }
    const res = await analyzePedimento(sb as never, 'evco', '26 24 3596 6500441')
    expect(res.success).toBe(false)
    expect(res.error).toContain('boom')
  })
})

// ── getTenantAnomalies ────────────────────────────────────────────

describe('getTenantAnomalies (standalone)', () => {
  it('formats anomaly_only into Spanish response', async () => {
    agentMocks.runIntelligenceAgent.mockResolvedValue(anomalyReport())
    const res = await getTenantAnomalies({} as never, 'evco', { windowDays: 30 })
    expect(res.success).toBe(true)
    expect(res.data!.type).toBe('anomaly_only')
    expect(res.data!.anomaly_count).toBe(1)
    expect(res.data!.anomaly_groups_es[0].label_es).toBe('Proveedor nuevo')
    expect(res.data!.anomaly_groups_es[0].top_subjects).toContain('PRV_NEW')
    expect(res.data!.recommendations[0].priority_es).toBe('media')
    expect(agentMocks.runIntelligenceAgent).toHaveBeenCalledWith(
      expect.anything(),
      'evco',
      'anomaly_only',
      { windowDays: 30 },
    )
  })

  it('rejects empty companyId', async () => {
    const res = await getTenantAnomalies({} as never, '')
    expect(res.success).toBe(false)
    expect(res.error).toBe('invalid_companyId')
  })
})

// ── getFullIntelligence ───────────────────────────────────────────

describe('getFullIntelligence (standalone)', () => {
  it('routes to tenant_scan when query is general', async () => {
    agentMocks.runIntelligenceAgent.mockResolvedValue(tenantScanReport())
    const res = await getFullIntelligence({} as never, 'evco', '¿cómo está la operación?')
    expect(res.success).toBe(true)
    expect(res.data!.type).toBe('tenant_scan')
    if (res.data!.type === 'tenant_scan') {
      expect(res.data!.baseline_verde_pct).toBe(88)
      expect(res.data!.top_focus_es).toHaveLength(1)
      expect(res.data!.top_focus_es[0].cve_producto).toBe('SKU-HOT')
    }
    expect(agentMocks.runIntelligenceAgent).toHaveBeenCalledWith(
      expect.anything(),
      'evco',
      'tenant_scan',
      expect.any(Object),
    )
  })

  it('routes to anomaly_only when query mentions anomalías', async () => {
    agentMocks.runIntelligenceAgent.mockResolvedValue(anomalyReport())
    const res = await getFullIntelligence({} as never, 'evco', '¿hay anomalías?')
    expect(res.success).toBe(true)
    expect(res.data!.type).toBe('anomaly_only')
    expect(agentMocks.runIntelligenceAgent).toHaveBeenCalledWith(
      expect.anything(),
      'evco',
      'anomaly_only',
      expect.any(Object),
    )
  })

  it('routes to anomaly_only when query mentions alertas/problemas', async () => {
    agentMocks.runIntelligenceAgent.mockResolvedValue(anomalyReport())
    const a = await getFullIntelligence({} as never, 'evco', '¿alguna alerta?')
    expect(a.data!.type).toBe('anomaly_only')
    const b = await getFullIntelligence({} as never, 'evco', '¿qué problemas hay?')
    expect(b.data!.type).toBe('anomaly_only')
  })

  it('rejects empty companyId', async () => {
    const res = await getFullIntelligence({} as never, '', 'panorama')
    expect(res.success).toBe(false)
    expect(res.error).toBe('invalid_companyId')
  })
})

// ── Exec wrappers via runTool (tenant isolation) ──────────────────

describe('runTool — agent tools tenant isolation', () => {
  const clientCtx: AguilaCtx = {
    companyId: 'evco',
    role: 'client',
    userId: 'u1',
    operatorId: null,
    supabase: {} as never,
  }
  const adminCtx: AguilaCtx = {
    companyId: 'admin',
    role: 'admin',
    userId: 'a1',
    operatorId: null,
    supabase: {} as never,
  }

  it('client role: analyze_trafico scopes to own companyId', async () => {
    agentMocks.runIntelligenceAgent.mockResolvedValue(traficoReport())
    const res = await runTool('analyze_trafico', { traficoId: 'T-1' }, clientCtx)
    expect(res.tool).toBe('analyze_trafico')
    const inner = res.result as { success: boolean; data: unknown }
    expect(inner.success).toBe(true)
    expect(agentMocks.runIntelligenceAgent).toHaveBeenCalledWith(
      expect.anything(),
      'evco',
      { type: 'trafico', traficoId: 'T-1' },
    )
  })

  it('admin without clientFilter: tenant_anomalies is refused (no cross-tenant scan)', async () => {
    const res = await runTool('tenant_anomalies', {}, adminCtx)
    expect(res.forbidden).toBe(true)
  })

  it('admin with resolvable clientFilter: intelligence_scan runs on that tenant', async () => {
    // companies lookup returns evco
    adminStub.from.mockImplementation(() => ({
      select: () => ({
        or: () => ({ maybeSingle: async () => ({ data: { company_id: 'evco' }, error: null }) }),
      }),
    }))
    agentMocks.runIntelligenceAgent.mockResolvedValue(tenantScanReport())
    const res = await runTool(
      'intelligence_scan',
      { query: 'panorama', clientFilter: '9254' },
      adminCtx,
    )
    const inner = res.result as { success: boolean; data: { type: string } }
    expect(inner.success).toBe(true)
    expect(inner.data.type).toBe('tenant_scan')
    expect(agentMocks.runIntelligenceAgent).toHaveBeenCalledWith(
      expect.anything(),
      'evco',
      'tenant_scan',
      expect.objectContaining({ topFocusCount: undefined, windowDays: undefined }),
    )
  })

  it('admin with unknown clientFilter: refused (no silent cross-tenant)', async () => {
    adminStub.from.mockImplementation(() => ({
      select: () => ({
        or: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    }))
    const res = await runTool(
      'analyze_trafico',
      { traficoId: 'T-1', clientFilter: 'ghost' },
      adminCtx,
    )
    expect(res.forbidden).toBe(true)
  })
})

// ── Formatter edge cases ──────────────────────────────────────────

describe('formatter edge cases', () => {
  it('filters no_action recommendations from response', async () => {
    const report = traficoReport()
    report.insight!.recommendations = [
      {
        kind: 'no_action',
        priority: 'low',
        subject: 'tenant',
        action_es: 'Sin acciones prioritarias',
        rationale_es: 'Indicadores en calma',
        metadata: {},
      },
    ]
    agentMocks.runIntelligenceAgent.mockResolvedValue(report)
    const res = await analyzeTrafico({} as never, 'evco', 'T-1')
    expect(res.data!.recommendations).toHaveLength(0)
    expect(res.data!.next_steps_es).toHaveLength(0)
  })

  it('maps all three bands to Spanish', async () => {
    for (const [band, es] of [
      ['high', 'alta'],
      ['medium', 'media'],
      ['low', 'baja'],
    ] as const) {
      const r = traficoReport()
      r.insight!.signals.prediction.band = band
      r.insight!.explanation.confidence_band_en = band
      agentMocks.runIntelligenceAgent.mockResolvedValue(r)
      const res = await analyzeTrafico({} as never, 'evco', 'T-1')
      expect(res.data!.band_es).toBe(es)
    }
  })
})
