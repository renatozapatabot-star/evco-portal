import { describe, it, expect, vi } from 'vitest'
import {
  analyzeDecisions,
  composeReport,
  computeDraftApproval,
  computePredictionAccuracy,
  computeToneGuardTrend,
  computeToolAcceptance,
  generateWeeklyReport,
  suggestAdjustments,
  type LearningMetrics,
  type PredictionBand,
} from '../loop'
import type { DecisionRow } from '@/lib/intelligence/decision-log'
import * as decisionLogModule from '@/lib/intelligence/decision-log'

// ── Fixture helpers ───────────────────────────────────────────────

type RowOverrides = Partial<DecisionRow>

function row(o: RowOverrides = {}): DecisionRow {
  return {
    id: o.id ?? `dec-${Math.random().toString(36).slice(2, 8)}`,
    created_at: o.created_at ?? '2026-04-22T00:00:00Z',
    company_id: o.company_id ?? 'evco',
    tool_name: o.tool_name ?? null,
    workflow: o.workflow ?? null,
    trigger_type: o.trigger_type ?? null,
    trigger_id: o.trigger_id ?? null,
    decision: o.decision ?? null,
    reasoning: o.reasoning ?? null,
    confidence: o.confidence ?? null,
    autonomy_level: o.autonomy_level ?? 0,
    action_taken: o.action_taken ?? null,
    processing_ms: o.processing_ms ?? null,
    tool_input: o.tool_input ?? null,
    tool_output: o.tool_output ?? null,
    human_feedback: o.human_feedback ?? null,
    outcome: o.outcome ?? null,
    outcome_recorded_at: o.outcome_recorded_at ?? null,
  }
}

/** Analyze-trafico row with known band + outcome. */
function prediction(band: PredictionBand, outcome: 'verde' | 'amarillo' | 'rojo'): DecisionRow {
  return row({
    tool_name: 'analyze_trafico',
    tool_output: { data: { band_es: band, probability_pct: 80 } },
    outcome,
  })
}

function feedback(
  tool_name: string,
  sentiment: 'positive' | 'negative' | 'neutral' | null,
): DecisionRow {
  return row({
    tool_name,
    human_feedback: sentiment ? { sentiment } : null,
  })
}

function draftRow(
  type: string,
  outcome: string | null,
  extras: RowOverrides = {},
): DecisionRow {
  return row({
    tool_name: 'draft_mensajeria',
    tool_output: { data: { message_type: type } },
    outcome,
    ...extras,
  })
}

// ── computePredictionAccuracy ─────────────────────────────────────

describe('computePredictionAccuracy', () => {
  it('returns empty stats on no rows', () => {
    const m = computePredictionAccuracy([])
    expect(m.overall.total).toBe(0)
    expect(m.overall.verde_rate).toBeNull()
    expect(m.by_band.alta.total).toBe(0)
    expect(m.by_band.alta.verde_rate).toBeNull()
    expect(m.by_band.alta.gap_pp).toBeNull()
  })

  it('ignores rows without outcome', () => {
    const m = computePredictionAccuracy([
      row({ tool_name: 'analyze_trafico', tool_output: { data: { band_es: 'alta' } } }),
    ])
    expect(m.overall.total).toBe(0)
  })

  it('ignores rows from other tools', () => {
    const m = computePredictionAccuracy([
      row({ tool_name: 'query_traficos', outcome: 'verde' }),
    ])
    expect(m.overall.total).toBe(0)
  })

  it('aggregates per band + computes gap_pp', () => {
    const rows = [
      prediction('alta', 'verde'),
      prediction('alta', 'verde'),
      prediction('alta', 'rojo'),
      prediction('media', 'verde'),
      prediction('baja', 'amarillo'),
    ]
    const m = computePredictionAccuracy(rows)
    expect(m.overall.total).toBe(5)
    expect(m.overall.verde_count).toBe(3)
    expect(m.by_band.alta.total).toBe(3)
    expect(m.by_band.alta.verde_rate).toBeCloseTo(2 / 3, 5)
    expect(m.by_band.alta.gap_pp).toBeLessThan(0) // 66% < 95% midpoint
    expect(m.by_band.media.total).toBe(1)
    expect(m.by_band.baja.total).toBe(1)
    expect(m.by_band.baja.verde_rate).toBe(0)
  })

  it('reads band from tool_output.band_es when data wrapper absent', () => {
    const m = computePredictionAccuracy([
      row({
        tool_name: 'analyze_pedimento',
        tool_output: { band_es: 'media' },
        outcome: 'verde',
      }),
    ])
    expect(m.by_band.media.total).toBe(1)
    expect(m.by_band.media.verde_count).toBe(1)
  })

  it('skips rows with unknown band', () => {
    const m = computePredictionAccuracy([
      row({ tool_name: 'analyze_trafico', tool_output: { data: { band_es: 'wat' } }, outcome: 'verde' }),
    ])
    expect(m.overall.total).toBe(0)
  })
})

// ── computeToolAcceptance ─────────────────────────────────────────

describe('computeToolAcceptance', () => {
  it('returns empty array for no rows', () => {
    expect(computeToolAcceptance([]).by_tool).toEqual([])
  })

  it('aggregates by tool_name + computes acceptance rate', () => {
    const rows = [
      feedback('analyze_trafico', 'positive'),
      feedback('analyze_trafico', 'positive'),
      feedback('analyze_trafico', 'negative'),
      feedback('analyze_trafico', null),
      feedback('tenant_anomalies', 'positive'),
      feedback('tenant_anomalies', 'neutral'),
    ]
    const m = computeToolAcceptance(rows)
    const t = m.by_tool.find((x) => x.tool_name === 'analyze_trafico')!
    expect(t.total).toBe(4)
    expect(t.positive).toBe(2)
    expect(t.negative).toBe(1)
    expect(t.no_feedback).toBe(1)
    expect(t.acceptance_rate).toBeCloseTo(2 / 3, 5)
    const a = m.by_tool.find((x) => x.tool_name === 'tenant_anomalies')!
    expect(a.total).toBe(2)
    expect(a.neutral).toBe(1)
    expect(a.acceptance_rate).toBe(1) // 1 positive, 0 negative
  })

  it('treats unknown sentiment as no_feedback', () => {
    const rows = [
      row({
        tool_name: 't',
        human_feedback: { sentiment: 'weird' as 'positive' },
      }),
    ]
    const m = computeToolAcceptance(rows)
    expect(m.by_tool[0].no_feedback).toBe(1)
    expect(m.by_tool[0].acceptance_rate).toBeNull()
  })

  it('sorts by total desc then tool_name asc', () => {
    const rows = [
      feedback('bravo', 'positive'),
      feedback('alpha', 'positive'),
      feedback('bravo', 'positive'),
    ]
    const m = computeToolAcceptance(rows)
    expect(m.by_tool[0].tool_name).toBe('bravo')
    expect(m.by_tool[1].tool_name).toBe('alpha')
  })

  it('labels null tool_name as "unknown"', () => {
    const m = computeToolAcceptance([row({})])
    expect(m.by_tool[0].tool_name).toBe('unknown')
  })
})

// ── computeDraftApproval ──────────────────────────────────────────

describe('computeDraftApproval', () => {
  it('buckets outcomes correctly', () => {
    const rows = [
      draftRow('preventive_alert', 'approved'),
      draftRow('preventive_alert', 'sent'),
      draftRow('preventive_alert', 'rejected'),
      draftRow('preventive_alert', null),
      draftRow('status_update', 'superseded'),
    ]
    const m = computeDraftApproval(rows)
    const pa = m.by_type.find((x) => x.message_type === 'preventive_alert')!
    expect(pa.approved).toBe(2)
    expect(pa.rejected).toBe(1)
    expect(pa.no_outcome).toBe(1)
    expect(pa.approval_rate).toBeCloseTo(2 / 3, 5)
    const st = m.by_type.find((x) => x.message_type === 'status_update')!
    expect(st.rejected).toBe(1)
    expect(st.approval_rate).toBe(0)
  })

  it('counts blocked-by-tone-guard rows separately', () => {
    const rows = [
      draftRow('preventive_alert', 'approved'),
      draftRow('x', null, { action_taken: 'blocked:tone_guard' }),
      draftRow('y', null, { action_taken: 'blocked:tone_guard' }),
    ]
    const m = computeDraftApproval(rows)
    expect(m.blocked_by_tone_guard).toBe(2)
    // Blocked rows do NOT appear in by_type.
    expect(m.by_type).toHaveLength(1)
    expect(m.by_type[0].message_type).toBe('preventive_alert')
  })

  it('labels drafts with missing message_type as "desconocido"', () => {
    const rows = [row({ tool_name: 'draft_mensajeria', outcome: 'approved' })]
    const m = computeDraftApproval(rows)
    expect(m.by_type[0].message_type).toBe('desconocido')
  })

  it('ignores rows from other tools', () => {
    const m = computeDraftApproval([
      row({ tool_name: 'analyze_trafico', outcome: 'verde' }),
    ])
    expect(m.by_type).toEqual([])
    expect(m.blocked_by_tone_guard).toBe(0)
  })
})

// ── computeToneGuardTrend ─────────────────────────────────────────

describe('computeToneGuardTrend', () => {
  it('returns zero state for no draft attempts', () => {
    expect(computeToneGuardTrend([])).toEqual({
      total_attempts: 0,
      blocked: 0,
      block_rate: null,
    })
  })

  it('computes block rate across draft_mensajeria rows', () => {
    const rows = [
      draftRow('x', 'approved'),
      draftRow('y', 'approved'),
      draftRow('z', null, { action_taken: 'blocked:tone_guard' }),
      draftRow('w', null, { action_taken: 'blocked:tone_guard' }),
    ]
    const m = computeToneGuardTrend(rows)
    expect(m.total_attempts).toBe(4)
    expect(m.blocked).toBe(2)
    expect(m.block_rate).toBe(0.5)
  })

  it('ignores non-draft rows', () => {
    const rows = [
      draftRow('x', null, { action_taken: 'blocked:tone_guard' }),
      row({ tool_name: 'analyze_trafico', action_taken: 'completed' }),
    ]
    const m = computeToneGuardTrend(rows)
    expect(m.total_attempts).toBe(1)
  })
})

// ── suggestAdjustments ────────────────────────────────────────────

function mkMetrics(o: Partial<LearningMetrics> = {}): LearningMetrics {
  const base: LearningMetrics = {
    window: { days: 7, generated_at: '2026-04-22T00:00:00Z', company_id: 'evco' },
    sample_size: { total: 50, with_outcome: 30, with_feedback: 20 },
    prediction_accuracy: {
      overall: { total: 30, verde_count: 28, verde_rate: 0.93 },
      by_band: {
        alta: { total: 20, verde_count: 19, verde_rate: 0.95, predicted_rate_mid: 95, gap_pp: 0 },
        media: { total: 8, verde_count: 7, verde_rate: 0.875, predicted_rate_mid: 86, gap_pp: 1.5 },
        baja: { total: 2, verde_count: 1, verde_rate: 0.5, predicted_rate_mid: 60, gap_pp: -10 },
      },
    },
    tool_acceptance: { by_tool: [] },
    draft_approval: { by_type: [], blocked_by_tone_guard: 0 },
    tone_guard: { total_attempts: 0, blocked: 0, block_rate: null },
  }
  return { ...base, ...o }
}

describe('suggestAdjustments', () => {
  it('fires prediction_overconfidence when alta underperforms with enough samples', () => {
    const m = mkMetrics({
      prediction_accuracy: {
        overall: { total: 30, verde_count: 22, verde_rate: 0.73 },
        by_band: {
          alta: { total: 30, verde_count: 22, verde_rate: 22 / 30, predicted_rate_mid: 95, gap_pp: -21.7 },
          media: { total: 0, verde_count: 0, verde_rate: null, predicted_rate_mid: 86, gap_pp: null },
          baja: { total: 0, verde_count: 0, verde_rate: null, predicted_rate_mid: 60, gap_pp: null },
        },
      },
    })
    const s = suggestAdjustments(m)
    const hit = s.find((x) => x.kind === 'prediction_overconfidence')
    expect(hit).toBeDefined()
    expect(hit!.priority).toBe('alta')
    expect(hit!.subject).toBe('banda_alta')
    expect(hit!.evidence.total).toBe(30)
  })

  it('does NOT fire overconfidence with too few samples', () => {
    const m = mkMetrics({
      prediction_accuracy: {
        overall: { total: 5, verde_count: 2, verde_rate: 0.4 },
        by_band: {
          alta: { total: 5, verde_count: 2, verde_rate: 0.4, predicted_rate_mid: 95, gap_pp: -55 },
          media: { total: 0, verde_count: 0, verde_rate: null, predicted_rate_mid: 86, gap_pp: null },
          baja: { total: 0, verde_count: 0, verde_rate: null, predicted_rate_mid: 60, gap_pp: null },
        },
      },
    })
    expect(
      suggestAdjustments(m).some((x) => x.kind === 'prediction_overconfidence'),
    ).toBe(false)
  })

  it('fires prediction_underconfidence for baja when n>=10 and rate>0.8', () => {
    const m = mkMetrics({
      prediction_accuracy: {
        overall: { total: 10, verde_count: 9, verde_rate: 0.9 },
        by_band: {
          alta: { total: 0, verde_count: 0, verde_rate: null, predicted_rate_mid: 95, gap_pp: null },
          media: { total: 0, verde_count: 0, verde_rate: null, predicted_rate_mid: 86, gap_pp: null },
          baja: { total: 10, verde_count: 9, verde_rate: 0.9, predicted_rate_mid: 60, gap_pp: 30 },
        },
      },
    })
    expect(
      suggestAdjustments(m).some((x) => x.kind === 'prediction_underconfidence'),
    ).toBe(true)
  })

  it('fires tool_low_acceptance when feedback >= 5 and rate < 0.6', () => {
    const m = mkMetrics({
      tool_acceptance: {
        by_tool: [
          {
            tool_name: 'analyze_trafico',
            total: 10,
            positive: 2,
            negative: 6,
            neutral: 1,
            no_feedback: 1,
            acceptance_rate: 2 / 8,
          },
        ],
      },
    })
    const hit = suggestAdjustments(m).find((x) => x.kind === 'tool_low_acceptance')
    expect(hit).toBeDefined()
    expect(hit!.subject).toBe('analyze_trafico')
  })

  it('fires draft_low_approval when n>=5 and rate<0.7', () => {
    const m = mkMetrics({
      draft_approval: {
        by_type: [
          {
            message_type: 'preventive_alert',
            total: 8,
            approved: 3,
            rejected: 5,
            no_outcome: 0,
            approval_rate: 3 / 8,
          },
        ],
        blocked_by_tone_guard: 0,
      },
    })
    const hit = suggestAdjustments(m).find((x) => x.kind === 'draft_low_approval')
    expect(hit).toBeDefined()
    expect(hit!.subject).toBe('preventive_alert')
  })

  it('fires tone_guard_drift when block_rate > 10% and total >= 20', () => {
    const m = mkMetrics({
      tone_guard: { total_attempts: 30, blocked: 5, block_rate: 5 / 30 },
    })
    const hit = suggestAdjustments(m).find((x) => x.kind === 'tone_guard_drift')
    expect(hit).toBeDefined()
  })

  it('fires sample_size_low when total < 10', () => {
    const m = mkMetrics({
      sample_size: { total: 3, with_outcome: 0, with_feedback: 0 },
    })
    const hit = suggestAdjustments(m).find((x) => x.kind === 'sample_size_low')
    expect(hit).toBeDefined()
    expect(hit!.priority).toBe('baja')
  })

  it('sorts suggestions by priority desc then subject asc', () => {
    const m = mkMetrics({
      prediction_accuracy: {
        overall: { total: 20, verde_count: 15, verde_rate: 0.75 },
        by_band: {
          alta: { total: 20, verde_count: 15, verde_rate: 0.75, predicted_rate_mid: 95, gap_pp: -20 },
          media: { total: 0, verde_count: 0, verde_rate: null, predicted_rate_mid: 86, gap_pp: null },
          baja: { total: 0, verde_count: 0, verde_rate: null, predicted_rate_mid: 60, gap_pp: null },
        },
      },
      draft_approval: {
        by_type: [
          { message_type: 'zeta_template', total: 6, approved: 2, rejected: 4, no_outcome: 0, approval_rate: 2 / 6 },
          { message_type: 'alpha_template', total: 6, approved: 2, rejected: 4, no_outcome: 0, approval_rate: 2 / 6 },
        ],
        blocked_by_tone_guard: 0,
      },
    })
    const s = suggestAdjustments(m)
    expect(s[0].priority).toBe('alta')
    // mediums sorted by subject asc
    const mediums = s.filter((x) => x.priority === 'media')
    if (mediums.length >= 2) {
      expect(mediums[0].subject.localeCompare(mediums[1].subject)).toBeLessThanOrEqual(0)
    }
  })
})

// ── composeReport ─────────────────────────────────────────────────

describe('composeReport', () => {
  it('produces plain and HTML sections with headers', () => {
    const m = mkMetrics()
    const s = suggestAdjustments(m)
    const out = composeReport(m, s)
    expect(out.text_plain).toContain('Reporte de aprendizaje')
    expect(out.text_html).toContain('<b>📊 Reporte de aprendizaje')
    expect(out.text_plain).toContain('Predicciones')
    expect(out.text_plain).toContain('evco')
    expect(out.summary_es.length).toBeGreaterThan(0)
  })

  it('escapes HTML in injected fields', () => {
    const m = mkMetrics({
      window: { days: 7, generated_at: '2026-04-22T00:00:00Z', company_id: '<script>' },
    })
    const out = composeReport(m, suggestAdjustments(m))
    expect(out.text_html).not.toContain('<script>')
    expect(out.text_html).toContain('&lt;script&gt;')
  })

  it('includes suggestions with priority markers', () => {
    const m = mkMetrics({
      sample_size: { total: 3, with_outcome: 0, with_feedback: 0 },
    })
    const out = composeReport(m, suggestAdjustments(m))
    expect(out.text_plain).toMatch(/Muestra pequeña/)
    expect(out.text_plain).toMatch(/📎/) // low priority marker
  })

  it('truncates > 4000 chars', () => {
    const m = mkMetrics({
      tool_acceptance: {
        by_tool: Array.from({ length: 300 }, (_, i) => ({
          tool_name: `tool_${i}`,
          total: 5,
          positive: 2,
          negative: 1,
          neutral: 0,
          no_feedback: 2,
          acceptance_rate: 2 / 3,
        })),
      },
    })
    const out = composeReport(m, suggestAdjustments(m))
    expect(out.text_plain.length).toBeLessThanOrEqual(4000)
    expect(out.text_html.length).toBeLessThanOrEqual(4000)
  })

  it('summary_es leads with a high-priority finding when one exists', () => {
    const m = mkMetrics({
      prediction_accuracy: {
        overall: { total: 30, verde_count: 20, verde_rate: 0.66 },
        by_band: {
          alta: { total: 30, verde_count: 20, verde_rate: 20 / 30, predicted_rate_mid: 95, gap_pp: -28 },
          media: { total: 0, verde_count: 0, verde_rate: null, predicted_rate_mid: 86, gap_pp: null },
          baja: { total: 0, verde_count: 0, verde_rate: null, predicted_rate_mid: 60, gap_pp: null },
        },
      },
    })
    const out = composeReport(m, suggestAdjustments(m))
    expect(out.summary_es).toContain('alta')
  })
})

// ── analyzeDecisions / generateWeeklyReport (mocked) ──────────────

describe('analyzeDecisions', () => {
  it('fetches + composes the full report', async () => {
    const rows: DecisionRow[] = [
      prediction('alta', 'verde'),
      prediction('alta', 'rojo'),
      feedback('analyze_trafico', 'positive'),
      draftRow('preventive_alert', 'approved'),
    ]
    const spy = vi
      .spyOn(decisionLogModule, 'getDecisionHistory')
      .mockResolvedValue(rows)

    const report = await analyzeDecisions({} as never, 'evco', { windowDays: 7, now: Date.UTC(2026, 3, 22) })
    expect(report.metrics.sample_size.total).toBe(4)
    expect(report.metrics.prediction_accuracy.overall.total).toBe(2)
    expect(report.metrics.tool_acceptance.by_tool.length).toBeGreaterThan(0)
    expect(report.text_plain).toContain('Reporte de aprendizaje')
    expect(report.suggestions.length).toBeGreaterThan(0)

    // Fetched with the right window
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      'evco',
      expect.objectContaining({ limit: 500 }),
    )
    spy.mockRestore()
  })

  it('clamps window to [1, 90]', async () => {
    const spy = vi
      .spyOn(decisionLogModule, 'getDecisionHistory')
      .mockResolvedValue([])
    await analyzeDecisions({} as never, 'evco', { windowDays: 999, now: Date.UTC(2026, 3, 22) })
    const opts = spy.mock.calls[0][2] as { after?: string }
    const diff =
      Date.UTC(2026, 3, 22) - new Date(opts.after!).getTime()
    // 90 * 86_400_000 = 7.776e9
    expect(Math.round(diff / 86_400_000)).toBe(90)
    spy.mockRestore()
  })

  it('handles no rows gracefully (calm report)', async () => {
    const spy = vi
      .spyOn(decisionLogModule, 'getDecisionHistory')
      .mockResolvedValue([])
    const report = await analyzeDecisions({} as never, 'evco')
    expect(report.metrics.sample_size.total).toBe(0)
    expect(report.summary_es).toMatch(/Sin decisiones/)
    expect(report.suggestions.some((s) => s.kind === 'sample_size_low')).toBe(true)
    spy.mockRestore()
  })
})

describe('generateWeeklyReport', () => {
  it('rejects empty companyId', async () => {
    const out = await generateWeeklyReport({} as never, '')
    expect(out.success).toBe(false)
    expect(out.error).toBe('invalid_companyId')
  })

  it('wraps analyzeDecisions with withDecisionLog and returns envelope', async () => {
    const getSpy = vi
      .spyOn(decisionLogModule, 'getDecisionHistory')
      .mockResolvedValue([])
    const logSpy = vi
      .spyOn(decisionLogModule, 'withDecisionLog')
      .mockImplementation(async (_sb, _ctx, fn) => fn())

    const out = await generateWeeklyReport({} as never, 'evco', { windowDays: 7 })
    expect(out.success).toBe(true)
    expect(out.data).not.toBeNull()
    expect(logSpy).toHaveBeenCalledOnce()
    const ctx = logSpy.mock.calls[0][1] as {
      toolName: string
      workflow: string
      triggerType: string
      toolInput: unknown
    }
    expect(ctx.toolName).toBe('learning_loop')
    expect(ctx.workflow).toBe('learning_report')
    expect(ctx.triggerType).toBe('cron')

    getSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('returns error envelope when the wrapper throws', async () => {
    const logSpy = vi
      .spyOn(decisionLogModule, 'withDecisionLog')
      .mockImplementation(async () => {
        throw new Error('db_exploded')
      })

    const out = await generateWeeklyReport({} as never, 'evco')
    expect(out.success).toBe(false)
    expect(out.error).toContain('db_exploded')
    logSpy.mockRestore()
  })
})
