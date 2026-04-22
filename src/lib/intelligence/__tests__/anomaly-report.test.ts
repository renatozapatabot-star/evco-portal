import { describe, it, expect, vi } from 'vitest'
import { generateAnomalyReport } from '../anomaly-report'
import * as insightsModule from '../crossing-insights'
import type { Anomaly, InsightsPayload } from '../crossing-insights'

/**
 * anomaly-report — isolated tests via mocking `getCrossingInsights`.
 * Anomaly aggregation and summary copy are the interesting logic;
 * the underlying getCrossingInsights is exercised by its own suite.
 */

function basePayload(anomalies: Anomaly[]): InsightsPayload {
  return {
    generated_at: '2026-04-21T00:00:00Z',
    company_id: 'evco',
    green_streaks: [],
    broken_streaks: [],
    top_proveedores: [],
    watch_proveedores: [],
    anomalies,
    volume: { recent_7d: 10, prior_7d: 10, ratio: 1, delta_pct: 0, daily_series: [] },
    fraccion_health: [],
    top_predictions: [],
    watch_predictions: [],
    baseline_verde_pct: 90,
  }
}

function anomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    kind: 'streak_break',
    subject: 'SKU-A',
    detail: 'Racha rota',
    score: 0.5,
    occurred_at: '2026-04-20T00:00:00Z',
    metadata: {},
    ...overrides,
  }
}

describe('generateAnomalyReport', () => {
  it('returns a calm report when there are zero anomalies', async () => {
    const spy = vi
      .spyOn(insightsModule, 'getCrossingInsights')
      .mockResolvedValue(basePayload([]))

    const report = await generateAnomalyReport({} as never, 'evco', { now: 0 })
    expect(report.total_count).toBe(0)
    expect(report.groups).toHaveLength(0)
    expect(report.summary_es).toMatch(/calma/)
    expect(report.recommendations.length).toBeGreaterThan(0)
    expect(report.company_id).toBe('evco')
    expect(report.window_days).toBe(90)
    spy.mockRestore()
  })

  it('groups anomalies by kind and sorts by priority', async () => {
    const anomalies = [
      anomaly({ kind: 'volume_spike', subject: 'SKU-X', score: 0.5 }),
      anomaly({ kind: 'new_proveedor', subject: 'PRV_N', score: 0.4 }),
      anomaly({ kind: 'volume_spike', subject: 'SKU-Y', score: 0.9 }),
      anomaly({ kind: 'proveedor_slip', subject: 'PRV_S', score: 0.7 }),
    ]
    const spy = vi
      .spyOn(insightsModule, 'getCrossingInsights')
      .mockResolvedValue(basePayload(anomalies))

    const report = await generateAnomalyReport({} as never, 'evco')
    expect(report.total_count).toBe(4)
    // Order: proveedor_slip (4) > new_proveedor (3) > volume_spike (2)
    expect(report.groups.map((g) => g.kind)).toEqual([
      'proveedor_slip',
      'new_proveedor',
      'volume_spike',
    ])
    const spikeGroup = report.groups.find((g) => g.kind === 'volume_spike')
    expect(spikeGroup!.anomalies).toHaveLength(2)
    // Within group sorted by score desc
    expect(spikeGroup!.anomalies[0].score).toBe(0.9)
    expect(spikeGroup!.max_score).toBe(0.9)
    spy.mockRestore()
  })

  it('summary_es includes company + count + top labels', async () => {
    const anomalies = [
      anomaly({ kind: 'new_proveedor', subject: 'PRV_N' }),
      anomaly({ kind: 'volume_spike', subject: 'SKU-X' }),
    ]
    const spy = vi
      .spyOn(insightsModule, 'getCrossingInsights')
      .mockResolvedValue(basePayload(anomalies))

    const report = await generateAnomalyReport({} as never, 'evco')
    expect(report.summary_es).toContain('evco')
    expect(report.summary_es).toContain('2 anomalías')
    expect(report.summary_es).toMatch(/Proveedor nuevo/)
    spy.mockRestore()
  })

  it('singular form when total_count is 1', async () => {
    const spy = vi
      .spyOn(insightsModule, 'getCrossingInsights')
      .mockResolvedValue(basePayload([anomaly({ kind: 'new_proveedor' })]))

    const report = await generateAnomalyReport({} as never, 'evco')
    expect(report.summary_es).toContain('1 anomalía ')
    spy.mockRestore()
  })

  it('recommendations include validate_new_proveedor when anomaly present', async () => {
    const anomalies = [anomaly({ kind: 'new_proveedor', subject: 'PRV_NEW' })]
    const spy = vi
      .spyOn(insightsModule, 'getCrossingInsights')
      .mockResolvedValue(basePayload(anomalies))

    const report = await generateAnomalyReport({} as never, 'evco')
    expect(
      report.recommendations.some((r) => r.kind === 'validate_new_proveedor'),
    ).toBe(true)
    spy.mockRestore()
  })

  it('propagates windowDays option', async () => {
    const spy = vi
      .spyOn(insightsModule, 'getCrossingInsights')
      .mockResolvedValue(basePayload([]))

    const report = await generateAnomalyReport({} as never, 'evco', { windowDays: 30 })
    expect(report.window_days).toBe(30)
    expect(spy).toHaveBeenCalledWith(expect.anything(), 'evco', {
      windowDays: 30,
      now: expect.any(Number),
    })
    spy.mockRestore()
  })
})
