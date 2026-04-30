import { describe, it, expect, vi } from 'vitest'
import { runIntelligenceAgent } from '../agent'
import * as insightsModule from '../crossing-insights'
import * as fullInsightModule from '../full-insight'
import * as predictByIdModule from '../predict-by-id'
import type { Anomaly, InsightsPayload, VerdePrediction } from '../crossing-insights'
import type { FullCrossingInsight } from '../full-insight'
import type { SkuSignals } from '../predict-by-id'

/**
 * agent — isolated tests via module mocks. The underlying DB-facing
 * helpers each have their own suite; here we prove the orchestrator
 * routes the right inputs to the right composer for each mode and
 * returns a well-formed report.
 */

function basePayload(anomalies: Anomaly[] = [], watch: VerdePrediction[] = []): InsightsPayload {
  return {
    generated_at: '2026-04-21T00:00:00Z',
    company_id: 'evco',
    green_streaks: [],
    broken_streaks: [],
    top_proveedores: [],
    watch_proveedores: [],
    anomalies,
    volume: { recent_7d: 12, prior_7d: 8, ratio: 1.5, delta_pct: 50, daily_series: [] },
    fraccion_health: [],
    top_predictions: [],
    watch_predictions: watch,
    baseline_verde_pct: 90,
  }
}

function fakeSignals(cve = 'SKU-WATCH'): SkuSignals {
  return {
    prediction: {
      cve_producto: cve,
      probability: 0.6,
      band: 'low',
      summary: 'Probabilidad 60%',
      factors: [],
      baseline_pct: 85,
      cve_proveedor: 'PRV_1',
      last_fecha_cruce: '2026-04-20T00:00:00Z',
      total_crossings: 5,
    },
    streak: {
      cve_producto: cve,
      current_verde_streak: 0,
      longest_verde_streak: 1,
      just_broke_streak: true,
      last_semaforo: 1,
      last_fecha_cruce: '2026-04-20T00:00:00Z',
      total_crossings: 5,
    },
    proveedor: null,
    fraccionHealth: null,
    baselinePct: 85,
    fraccion: '3903.20.01',
  }
}

function fakeInsight(cve = 'SKU-WATCH'): FullCrossingInsight {
  return {
    target: { type: 'sku', cveProducto: cve },
    cve_producto: cve,
    generated_at: '2026-04-21T00:00:00Z',
    company_id: 'evco',
    signals: fakeSignals(cve),
    explanation: {
      headline: 'Probabilidad 60%',
      confidence_band_label: 'baja',
      confidence_band_en: 'low',
      probability_pct: 60,
      bullets: [],
      meta: '',
    },
    one_line: `${cve} · 60% verde`,
    plain_text: `${cve}\n60% verde`,
    recommendations: [
      {
        kind: 'prioritize_rojo_review',
        priority: 'high',
        subject: cve,
        action_es: `Prepara documentación de ${cve}`,
        rationale_es: 'Confianza baja',
        metadata: { cve_producto: cve },
      },
    ],
    summary_es: `SKU ${cve}: 60% verde · confianza baja · prepara docs.`,
  }
}

describe('runIntelligenceAgent — sku_focus mode', () => {
  it('delegates to buildFullCrossingInsight and returns the bundle', async () => {
    const spy = vi
      .spyOn(fullInsightModule, 'buildFullCrossingInsight')
      .mockResolvedValue(fakeInsight('SKU-HOT'))

    const report = await runIntelligenceAgent({} as never, 'evco', {
      type: 'sku',
      cveProducto: 'SKU-HOT',
    })

    expect(report.mode_label).toBe('sku_focus')
    expect(report.company_id).toBe('evco')
    if (report.mode_label === 'sku_focus') {
      expect(report.insight?.cve_producto).toBe('SKU-HOT')
      expect(report.recommendations).toHaveLength(1)
      expect(report.summary_es).toContain('SKU-HOT')
    }
    expect(spy).toHaveBeenCalledOnce()
    spy.mockRestore()
  })

  it('handles null insight gracefully (no signal in window)', async () => {
    const spy = vi
      .spyOn(fullInsightModule, 'buildFullCrossingInsight')
      .mockResolvedValue(null)

    const report = await runIntelligenceAgent({} as never, 'evco', {
      type: 'sku',
      cveProducto: 'SKU-DEAD',
    })

    expect(report.mode_label).toBe('sku_focus')
    if (report.mode_label === 'sku_focus') {
      expect(report.insight).toBeNull()
      expect(report.recommendations[0].kind).toBe('no_action')
      expect(report.summary_es).toMatch(/sin señal/)
    }
    spy.mockRestore()
  })
})

describe('runIntelligenceAgent — trafico_focus mode', () => {
  it('delegates to buildFullCrossingInsight with trafico target', async () => {
    const insight = fakeInsight('SKU-DOMINANT')
    insight.target = { type: 'trafico', traficoId: 'T-1' }
    insight.summary_es = 'Tráfico T-1 (SKU dominante SKU-DOMINANT): 60% verde · confianza baja.'
    const spy = vi
      .spyOn(fullInsightModule, 'buildFullCrossingInsight')
      .mockResolvedValue(insight)

    const report = await runIntelligenceAgent({} as never, 'evco', {
      type: 'trafico',
      traficoId: 'T-1',
    })

    expect(report.mode_label).toBe('trafico_focus')
    if (report.mode_label === 'trafico_focus') {
      expect(report.insight?.cve_producto).toBe('SKU-DOMINANT')
      expect(report.summary_es).toContain('T-1')
    }
    spy.mockRestore()
  })

  it('handles null trafico insight', async () => {
    const spy = vi
      .spyOn(fullInsightModule, 'buildFullCrossingInsight')
      .mockResolvedValue(null)
    const report = await runIntelligenceAgent({} as never, 'evco', {
      type: 'trafico',
      traficoId: 'T-EMPTY',
    })
    expect(report.mode_label).toBe('trafico_focus')
    if (report.mode_label === 'trafico_focus') {
      expect(report.insight).toBeNull()
      expect(report.summary_es).toMatch(/sin señal/)
    }
    spy.mockRestore()
  })
})

describe('runIntelligenceAgent — anomaly_only mode', () => {
  it('returns structured anomaly report', async () => {
    const anomalies: Anomaly[] = [
      {
        kind: 'new_proveedor',
        subject: 'PRV_NEW',
        detail: 'Primer cruce',
        score: 0.6,
        occurred_at: '2026-04-20T00:00:00Z',
        metadata: {},
      },
    ]
    const spy = vi
      .spyOn(insightsModule, 'getCrossingInsights')
      .mockResolvedValue(basePayload(anomalies))

    const report = await runIntelligenceAgent({} as never, 'evco', 'anomaly_only')
    expect(report.mode_label).toBe('anomaly_only')
    if (report.mode_label === 'anomaly_only') {
      expect(report.anomaly_report.total_count).toBe(1)
      expect(report.recommendations.some((r) => r.kind === 'validate_new_proveedor')).toBe(true)
    }
    spy.mockRestore()
  })

  it('returns calm report when there are no anomalies', async () => {
    const spy = vi
      .spyOn(insightsModule, 'getCrossingInsights')
      .mockResolvedValue(basePayload([]))

    const report = await runIntelligenceAgent({} as never, 'evco', 'anomaly_only')
    if (report.mode_label === 'anomaly_only') {
      expect(report.anomaly_report.total_count).toBe(0)
      expect(report.summary_es).toMatch(/calma/)
    }
    spy.mockRestore()
  })
})

describe('runIntelligenceAgent — tenant_scan mode', () => {
  it('composes insights + anomalies + focus bundles', async () => {
    const watch: VerdePrediction[] = [
      {
        cve_producto: 'SKU-RISK',
        probability: 0.5,
        band: 'low',
        summary: 'Probabilidad 50%',
        factors: [],
        baseline_pct: 85,
        cve_proveedor: 'PRV_1',
        last_fecha_cruce: '2026-04-20T00:00:00Z',
        total_crossings: 4,
      },
    ]
    const insSpy = vi
      .spyOn(insightsModule, 'getCrossingInsights')
      .mockResolvedValue(basePayload([], watch))
    const signalSpy = vi
      .spyOn(predictByIdModule, 'computeSkuSignals')
      .mockResolvedValue(fakeSignals('SKU-RISK'))
    const fullSpy = vi
      .spyOn(fullInsightModule, 'buildFullCrossingInsight')
      .mockResolvedValue(fakeInsight('SKU-RISK'))

    const report = await runIntelligenceAgent({} as never, 'evco', 'tenant_scan', {
      topFocusCount: 1,
    })

    expect(report.mode_label).toBe('tenant_scan')
    if (report.mode_label === 'tenant_scan') {
      expect(report.insights.watch_predictions).toHaveLength(1)
      expect(report.focus_insights).toHaveLength(1)
      expect(report.focus_insights[0].cve_producto).toBe('SKU-RISK')
      expect(report.anomaly_report).toBeDefined()
    }
    insSpy.mockRestore()
    signalSpy.mockRestore()
    fullSpy.mockRestore()
  })

  it('empty tenant returns calm tenant_scan report', async () => {
    const insSpy = vi
      .spyOn(insightsModule, 'getCrossingInsights')
      .mockResolvedValue({
        ...basePayload([]),
        volume: { recent_7d: 0, prior_7d: 0, ratio: null, delta_pct: null, daily_series: [] },
      })

    const report = await runIntelligenceAgent({} as never, 'evco', 'tenant_scan')
    if (report.mode_label === 'tenant_scan') {
      expect(report.focus_insights).toHaveLength(0)
      expect(report.summary_es).toMatch(/pausa/)
    }
    insSpy.mockRestore()
  })

  it('deduplicates recommendations across anomaly + volume sources', async () => {
    const anomalies: Anomaly[] = [
      {
        kind: 'new_proveedor',
        subject: 'PRV_NEW',
        detail: 'Primer cruce',
        score: 0.5,
        occurred_at: '2026-04-20T00:00:00Z',
        metadata: {},
      },
    ]
    const insSpy = vi
      .spyOn(insightsModule, 'getCrossingInsights')
      .mockResolvedValue(basePayload(anomalies))

    const report = await runIntelligenceAgent({} as never, 'evco', 'tenant_scan', {
      topFocusCount: 0,
    })
    if (report.mode_label === 'tenant_scan') {
      const newProvRecs = report.recommendations.filter(
        (r) => r.kind === 'validate_new_proveedor' && r.subject === 'PRV_NEW',
      )
      expect(newProvRecs).toHaveLength(1) // deduped despite appearing in both sources
    }
    insSpy.mockRestore()
  })
})
