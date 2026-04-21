import { describe, it, expect } from 'vitest'
import { computeAgreementStats } from '../shadow-analysis'
import type { SupabaseClient } from '@supabase/supabase-js'

// Minimal fake client — only supports the exact chain the module uses.
function makeFakeClient(rows: unknown[]): SupabaseClient {
  const chain = {
    select: () => chain,
    gte: () => chain,
    order: () => chain,
    limit: async () => ({ data: rows, error: null }),
  }
  return {
    from: () => chain,
  } as unknown as SupabaseClient
}

describe('computeAgreementStats', () => {
  it('returns insufficient=true with empty data', async () => {
    const stats = await computeAgreementStats(7, makeFakeClient([]))
    expect(stats.totalCompared).toBe(0)
    expect(stats.insufficient).toBe(true)
    expect(stats.progress).toBe(0)
    expect(stats.byDay.length).toBe(7)
  })

  it('marks agreement when human and system decisions match', async () => {
    const base = new Date().toISOString()
    const rows = [
      // Pair 1: agree
      { trafico: 'T-1', decision_type: 'classify', decision: 'APPROVE',
        reasoning: 'Human reviewed documents and concluded approval is warranted for this shipment.',
        created_at: base, outcome: null, was_optimal: null },
      { trafico: 'T-1', decision_type: 'classify', decision: 'approve',
        reasoning: null, created_at: base, outcome: null, was_optimal: null },
      // Pair 2: disagree
      { trafico: 'T-2', decision_type: 'classify', decision: 'REJECT',
        reasoning: 'Human concluded the fraccion classification does not match declared product.',
        created_at: base, outcome: null, was_optimal: true },
      { trafico: 'T-2', decision_type: 'classify', decision: 'APPROVE',
        reasoning: null, created_at: base, outcome: null, was_optimal: null },
    ]
    const stats = await computeAgreementStats(7, makeFakeClient(rows))
    expect(stats.totalCompared).toBe(2)
    expect(stats.agreementRate).toBeCloseTo(0.5)
    expect(stats.humanWinsWhenDisagree).toBe(1)
    expect(stats.byAction.classify.n).toBe(2)
  })

  it('skips groups with only one row (no comparison possible)', async () => {
    const rows = [
      { trafico: 'T-3', decision_type: 'classify', decision: 'APPROVE',
        reasoning: 'Only one row exists so no pair to compare against the system decision.',
        created_at: new Date().toISOString(), outcome: null, was_optimal: null },
    ]
    const stats = await computeAgreementStats(7, makeFakeClient(rows))
    expect(stats.totalCompared).toBe(0)
    expect(stats.insufficient).toBe(true)
  })
})
