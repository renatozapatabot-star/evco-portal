/**
 * Unit tests for the /mi-cuenta/cruz suggestion builder.
 *
 * Contract encoded here:
 *   - Always between MIN and MAX suggestions
 *   - Personalized prompts (last tráfico id, aging count) surface
 *     ONLY when their signal is present
 *   - Carrier-risk prompt requires the hasRiskyCarrier flag
 *   - No duplicates, ever
 *   - Calm/quiet state still returns ≥ MIN suggestions via fallbacks
 *   - No urgency language (VENCIDO / overdue / atrasado) in any copy
 */
import { describe, expect, it } from 'vitest'
import {
  buildSuggestedQuestions,
  SUGGESTED_QUESTION_LIMITS,
  type SuggestedQuestionsContext,
} from '../suggested-questions'

function ctx(overrides: Partial<SuggestedQuestionsContext> = {}): SuggestedQuestionsContext {
  return {
    arTotalMxn: 0,
    arOldCount: 0,
    lastTraficoId: null,
    shipmentsThisMonth: 0,
    hasRiskyCarrier: false,
    clientShortName: null,
    ...overrides,
  }
}

describe('buildSuggestedQuestions — shape + limits', () => {
  it('always returns at least the minimum number of suggestions', () => {
    const result = buildSuggestedQuestions(ctx())
    expect(result.length).toBeGreaterThanOrEqual(SUGGESTED_QUESTION_LIMITS.min)
  })

  it('never exceeds the maximum number of suggestions', () => {
    const result = buildSuggestedQuestions(
      ctx({
        arTotalMxn: 250_000,
        arOldCount: 5,
        lastTraficoId: 'EVCO-A0234',
        shipmentsThisMonth: 12,
        hasRiskyCarrier: true,
      }),
    )
    expect(result.length).toBeLessThanOrEqual(SUGGESTED_QUESTION_LIMITS.max)
  })

  it('never emits duplicate ids', () => {
    const result = buildSuggestedQuestions(
      ctx({
        arTotalMxn: 250_000,
        arOldCount: 5,
        lastTraficoId: 'EVCO-A0234',
        shipmentsThisMonth: 12,
        hasRiskyCarrier: true,
      }),
    )
    const ids = result.map(r => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('buildSuggestedQuestions — personalization', () => {
  it('surfaces the last-tráfico prompt (with interpolated id) when one is known', () => {
    const result = buildSuggestedQuestions(ctx({ lastTraficoId: 'EVCO-A0234' }))
    const prompt = result.find(r => r.id === 'last_trafico_status')
    expect(prompt).toBeDefined()
    expect(prompt!.text).toContain('EVCO-A0234')
  })

  it('does NOT surface the last-tráfico prompt when the id is missing', () => {
    const result = buildSuggestedQuestions(ctx({ lastTraficoId: null }))
    expect(result.find(r => r.id === 'last_trafico_status')).toBeUndefined()
  })

  it('uses singular copy when exactly one invoice is aged 61+ days', () => {
    const result = buildSuggestedQuestions(ctx({ arOldCount: 1 }))
    const prompt = result.find(r => r.id === 'ar_old_invoices')
    expect(prompt).toBeDefined()
    expect(prompt!.text).toMatch(/una factura de más de 60 días/)
  })

  it('uses plural copy with count when more than one invoice is aged', () => {
    const result = buildSuggestedQuestions(ctx({ arOldCount: 3 }))
    const prompt = result.find(r => r.id === 'ar_old_invoices')
    expect(prompt).toBeDefined()
    expect(prompt!.text).toContain('3 facturas')
  })

  it('only surfaces the carrier-risk prompt when hasRiskyCarrier is true', () => {
    const withRisk = buildSuggestedQuestions(
      ctx({ lastTraficoId: 'EVCO-A0234', hasRiskyCarrier: true }),
    )
    const withoutRisk = buildSuggestedQuestions(
      ctx({ lastTraficoId: 'EVCO-A0234', hasRiskyCarrier: false }),
    )
    expect(withRisk.find(r => r.id === 'risky_carriers')).toBeDefined()
    expect(withoutRisk.find(r => r.id === 'risky_carriers')).toBeUndefined()
  })
})

describe('buildSuggestedQuestions — calm-state fallbacks', () => {
  it('fills with knowledge-based fallbacks when the client has zero signals', () => {
    const result = buildSuggestedQuestions(ctx())
    expect(result.find(r => r.id === 'last_trafico_status')).toBeUndefined()
    expect(result.find(r => r.id === 'ar_old_invoices')).toBeUndefined()
    expect(result.find(r => r.id === 'risky_carriers')).toBeUndefined()
    expect(result.find(r => r.id === 'shipments_this_month')).toBeDefined()
    expect(result.length).toBeGreaterThanOrEqual(SUGGESTED_QUESTION_LIMITS.min)
  })

  it('promotes AR summary only when there is a saldo and other slots are thin', () => {
    const withSaldo = buildSuggestedQuestions(ctx({ arTotalMxn: 50_000 }))
    const clean = buildSuggestedQuestions(ctx({ arTotalMxn: 0 }))
    expect(withSaldo.find(r => r.id === 'ar_summary')).toBeDefined()
    expect(clean.find(r => r.id === 'ar_summary')).toBeUndefined()
  })

  it('always emits calm-tone copy — no urgency language in any prompt text', () => {
    const result = buildSuggestedQuestions(
      ctx({
        arTotalMxn: 250_000,
        arOldCount: 5,
        lastTraficoId: 'EVCO-A0234',
        shipmentsThisMonth: 12,
        hasRiskyCarrier: true,
      }),
    )
    const combined = result.map(r => r.text).join(' ')
    expect(combined).not.toMatch(/VENCIDO|URGENTE|overdue|past\s+due|atrasado/i)
  })
})
