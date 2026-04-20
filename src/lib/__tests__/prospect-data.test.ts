import { describe, expect, it } from 'vitest'
import { buildMonthlySparkline, type ProspectMonthlyBucket } from '@/lib/prospect-data'

describe('buildMonthlySparkline', () => {
  it('returns 12 buckets for any anchor', () => {
    const out = buildMonthlySparkline([], new Date('2026-04-15'))
    expect(out).toHaveLength(12)
    expect(out.every(v => v === 0)).toBe(true)
  })

  it('places bucket counts in the correct position', () => {
    const monthly: ProspectMonthlyBucket[] = [
      { month: '2026-04', pedimentos: 12, valor_usd: 100 },
      { month: '2026-03', pedimentos: 8, valor_usd: 50 },
      { month: '2025-05', pedimentos: 1, valor_usd: 5 },
    ]
    // anchor is April 2026 → series is May 2025 (idx 0) … April 2026 (idx 11)
    const out = buildMonthlySparkline(monthly, new Date('2026-04-15'))
    expect(out).toHaveLength(12)
    expect(out[0]).toBe(1) // May 2025
    expect(out[10]).toBe(8) // March 2026
    expect(out[11]).toBe(12) // April 2026
  })

  it('zero-fills missing months', () => {
    const monthly: ProspectMonthlyBucket[] = [
      { month: '2026-04', pedimentos: 5, valor_usd: 50 },
    ]
    const out = buildMonthlySparkline(monthly, new Date('2026-04-15'))
    // Eleven zeros, then 5 in the final slot
    expect(out.slice(0, 11)).toEqual(new Array(11).fill(0))
    expect(out[11]).toBe(5)
  })

  it('ignores months outside the 12-month window', () => {
    const monthly: ProspectMonthlyBucket[] = [
      { month: '2024-01', pedimentos: 999, valor_usd: 9999 }, // way before
      { month: '2026-04', pedimentos: 7, valor_usd: 70 },
    ]
    const out = buildMonthlySparkline(monthly, new Date('2026-04-15'))
    expect(out.includes(999)).toBe(false)
    expect(out[11]).toBe(7)
  })
})
