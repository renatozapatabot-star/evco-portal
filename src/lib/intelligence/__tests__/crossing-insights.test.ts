/**
 * Unit tests for the pure aggregation helpers in crossing-insights.
 *
 * Three pure functions — all three get a fixture stream, no DB mocks
 * needed. This is by design: the DB-facing orchestrator
 * (getCrossingInsights) is a thin coordinator; the intelligence logic
 * lives here where it's cheap to test.
 */

import { describe, it, expect } from 'vitest'
import {
  computePartStreaks,
  computeProveedorHealth,
  computeVolumeSummary,
  computeFraccionHealth,
  predictVerdeProbability,
  detectAnomalies,
  type SemaforoValue,
  type PartStreak,
  type ProveedorHealth,
  type FraccionHealth,
} from '../crossing-insights'

function crossing(
  cve: string,
  iso: string,
  semaforo: SemaforoValue,
  cve_proveedor: string | null = 'PRV_1',
) {
  return { cve_producto: cve, cve_proveedor, fecha_cruce: iso, semaforo }
}

describe('computePartStreaks', () => {
  it('returns empty when no crossings', () => {
    expect(computePartStreaks([])).toEqual([])
  })

  it('computes a 3-verde current streak', () => {
    const rows = [
      { cve_producto: 'SKU-A', fecha_cruce: '2026-04-18', semaforo: 0 as const },
      { cve_producto: 'SKU-A', fecha_cruce: '2026-04-15', semaforo: 0 as const },
      { cve_producto: 'SKU-A', fecha_cruce: '2026-04-10', semaforo: 0 as const },
      { cve_producto: 'SKU-A', fecha_cruce: '2026-04-05', semaforo: 1 as const },
    ]
    const [s] = computePartStreaks(rows)
    expect(s.cve_producto).toBe('SKU-A')
    expect(s.current_verde_streak).toBe(3)
    expect(s.longest_verde_streak).toBe(3)
    expect(s.total_crossings).toBe(4)
    expect(s.last_semaforo).toBe(0)
    expect(s.just_broke_streak).toBe(false)
  })

  it('tracks longest streak even when current is broken', () => {
    const rows = [
      // newest first
      { cve_producto: 'SKU-B', fecha_cruce: '2026-04-18', semaforo: 2 as const },
      { cve_producto: 'SKU-B', fecha_cruce: '2026-04-15', semaforo: 0 as const },
      { cve_producto: 'SKU-B', fecha_cruce: '2026-04-10', semaforo: 0 as const },
      { cve_producto: 'SKU-B', fecha_cruce: '2026-04-05', semaforo: 0 as const },
      { cve_producto: 'SKU-B', fecha_cruce: '2026-04-01', semaforo: 0 as const },
    ]
    const [s] = computePartStreaks(rows)
    expect(s.current_verde_streak).toBe(0) // just broken
    expect(s.longest_verde_streak).toBe(4)
  })

  it('flags just_broke_streak when most-recent is non-verde + prior was verde', () => {
    const today = new Date().toISOString().slice(0, 10)
    const tenDaysAgo = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10)
    const rows = [
      { cve_producto: 'SKU-C', fecha_cruce: today, semaforo: 1 as const },
      { cve_producto: 'SKU-C', fecha_cruce: tenDaysAgo, semaforo: 0 as const },
    ]
    const [s] = computePartStreaks(rows)
    expect(s.just_broke_streak).toBe(true)
  })

  it('does NOT flag just_broke_streak when the break is older than 30 days', () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 86_400_000).toISOString().slice(0, 10)
    const fiftyDaysAgo = new Date(Date.now() - 50 * 86_400_000).toISOString().slice(0, 10)
    const rows = [
      { cve_producto: 'SKU-D', fecha_cruce: fortyDaysAgo, semaforo: 1 as const },
      { cve_producto: 'SKU-D', fecha_cruce: fiftyDaysAgo, semaforo: 0 as const },
    ]
    const [s] = computePartStreaks(rows)
    expect(s.just_broke_streak).toBe(false)
  })

  it('groups by cve_producto', () => {
    const rows = [
      { cve_producto: 'A', fecha_cruce: '2026-04-01', semaforo: 0 as const },
      { cve_producto: 'B', fecha_cruce: '2026-04-01', semaforo: 2 as const },
      { cve_producto: 'A', fecha_cruce: '2026-04-05', semaforo: 0 as const },
    ]
    const streaks = computePartStreaks(rows)
    expect(streaks).toHaveLength(2)
    expect(streaks.find((s) => s.cve_producto === 'A')?.current_verde_streak).toBe(2)
    expect(streaks.find((s) => s.cve_producto === 'B')?.current_verde_streak).toBe(0)
  })
})

describe('computeProveedorHealth', () => {
  it('returns empty when no crossings', () => {
    expect(computeProveedorHealth([])).toEqual([])
  })

  it('aggregates per-proveedor semáforo counts and pct_verde', () => {
    const rows = [
      { cve_proveedor: 'PRV_A', fecha_cruce: '2026-04-10', semaforo: 0 as const },
      { cve_proveedor: 'PRV_A', fecha_cruce: '2026-04-09', semaforo: 0 as const },
      { cve_proveedor: 'PRV_A', fecha_cruce: '2026-04-08', semaforo: 0 as const },
      { cve_proveedor: 'PRV_A', fecha_cruce: '2026-04-07', semaforo: 1 as const },
      { cve_proveedor: 'PRV_B', fecha_cruce: '2026-04-10', semaforo: 2 as const },
    ]
    const result = computeProveedorHealth(rows)
    const a = result.find((p) => p.cve_proveedor === 'PRV_A')!
    const b = result.find((p) => p.cve_proveedor === 'PRV_B')!

    expect(a.total_crossings).toBe(4)
    expect(a.verde_count).toBe(3)
    expect(a.amarillo_count).toBe(1)
    expect(a.pct_verde).toBe(75)
    expect(a.last_fecha_cruce).toBe('2026-04-10')

    expect(b.total_crossings).toBe(1)
    expect(b.pct_verde).toBe(0)
  })

  it('sorts by pct_verde descending', () => {
    const rows = [
      { cve_proveedor: 'MID', fecha_cruce: '2026-04-10', semaforo: 0 as const },
      { cve_proveedor: 'MID', fecha_cruce: '2026-04-09', semaforo: 2 as const },
      { cve_proveedor: 'TOP', fecha_cruce: '2026-04-10', semaforo: 0 as const },
      { cve_proveedor: 'TOP', fecha_cruce: '2026-04-09', semaforo: 0 as const },
      { cve_proveedor: 'BOT', fecha_cruce: '2026-04-10', semaforo: 2 as const },
    ]
    const result = computeProveedorHealth(rows)
    expect(result.map((r) => r.cve_proveedor)).toEqual(['TOP', 'MID', 'BOT'])
  })
})

describe('detectAnomalies', () => {
  const now = new Date('2026-04-21T12:00:00Z').getTime()

  function ago(days: number): string {
    return new Date(now - days * 86_400_000).toISOString()
  }

  it('fires proveedor_slip when verde rate drops ≥ 10 pp', () => {
    const rows = [
      // prior week: 5/5 verde = 100%
      crossing('X', ago(13), 0, 'PRV_A'),
      crossing('X', ago(12), 0, 'PRV_A'),
      crossing('X', ago(11), 0, 'PRV_A'),
      crossing('X', ago(10), 0, 'PRV_A'),
      crossing('X', ago(9), 0, 'PRV_A'),
      // current week: 1/4 verde = 25% → drop of 75 pp
      crossing('X', ago(6), 0, 'PRV_A'),
      crossing('X', ago(4), 2, 'PRV_A'),
      crossing('X', ago(3), 2, 'PRV_A'),
      crossing('X', ago(1), 1, 'PRV_A'),
    ]
    const anomalies = detectAnomalies(rows, now)
    const slip = anomalies.find((a) => a.kind === 'proveedor_slip' && a.subject === 'PRV_A')
    expect(slip).toBeDefined()
    expect(slip!.score).toBeGreaterThan(0.5)
    expect(slip!.metadata.drop_pp).toBeGreaterThanOrEqual(10)
  })

  it('does NOT fire proveedor_slip with insufficient sample size', () => {
    const rows = [
      // prior: only 1 crossing → below min=3
      crossing('X', ago(12), 0, 'PRV_B'),
      // current: 2 rojos → below min=3
      crossing('X', ago(3), 2, 'PRV_B'),
      crossing('X', ago(1), 2, 'PRV_B'),
    ]
    const anomalies = detectAnomalies(rows, now)
    expect(anomalies.find((a) => a.kind === 'proveedor_slip' && a.subject === 'PRV_B')).toBeUndefined()
  })

  it('does NOT fire proveedor_slip when prior rate was already low (< 70%)', () => {
    const rows = [
      // prior: 3/5 verde = 60% (below 70 threshold)
      crossing('X', ago(13), 0, 'PRV_C'),
      crossing('X', ago(12), 0, 'PRV_C'),
      crossing('X', ago(11), 0, 'PRV_C'),
      crossing('X', ago(10), 2, 'PRV_C'),
      crossing('X', ago(9), 2, 'PRV_C'),
      // current: 0/3 verde (big drop, but prior was already poor)
      crossing('X', ago(6), 2, 'PRV_C'),
      crossing('X', ago(4), 2, 'PRV_C'),
      crossing('X', ago(1), 2, 'PRV_C'),
    ]
    const anomalies = detectAnomalies(rows, now)
    expect(anomalies.find((a) => a.subject === 'PRV_C')).toBeUndefined()
  })

  it('fires streak_break on long-streak broken', () => {
    // Build a 6-verde streak then break.
    const rows = [
      crossing('LONG-SKU', ago(1), 2, 'PRV_X'),
      crossing('LONG-SKU', ago(5), 0, 'PRV_X'),
      crossing('LONG-SKU', ago(10), 0, 'PRV_X'),
      crossing('LONG-SKU', ago(15), 0, 'PRV_X'),
      crossing('LONG-SKU', ago(20), 0, 'PRV_X'),
      crossing('LONG-SKU', ago(25), 0, 'PRV_X'),
      crossing('LONG-SKU', ago(29), 0, 'PRV_X'),
    ]
    const anomalies = detectAnomalies(rows, now)
    const sb = anomalies.find(
      (a) => a.kind === 'streak_break' && a.subject === 'LONG-SKU',
    )
    expect(sb).toBeDefined()
    expect(sb!.metadata.longest_streak).toBe(6)
  })

  it('does NOT fire streak_break on short streaks (< 5)', () => {
    const rows = [
      crossing('SHORT', ago(1), 2, 'PRV_Y'),
      crossing('SHORT', ago(5), 0, 'PRV_Y'),
      crossing('SHORT', ago(10), 0, 'PRV_Y'),
    ]
    const anomalies = detectAnomalies(rows, now)
    expect(anomalies.find((a) => a.kind === 'streak_break' && a.subject === 'SHORT')).toBeUndefined()
  })

  it('sorts anomalies by score descending', () => {
    // Build one moderate slip + one severe slip; severe should come first.
    const rows = [
      // Severe: 5/5 → 0/4 → drop 100
      crossing('X', ago(13), 0, 'SEVERE'),
      crossing('X', ago(12), 0, 'SEVERE'),
      crossing('X', ago(11), 0, 'SEVERE'),
      crossing('X', ago(10), 0, 'SEVERE'),
      crossing('X', ago(9), 0, 'SEVERE'),
      crossing('X', ago(5), 2, 'SEVERE'),
      crossing('X', ago(3), 2, 'SEVERE'),
      crossing('X', ago(2), 2, 'SEVERE'),
      crossing('X', ago(1), 2, 'SEVERE'),
      // Moderate: 4/4 → 2/4 → drop 50
      crossing('X', ago(13), 0, 'MODERATE'),
      crossing('X', ago(12), 0, 'MODERATE'),
      crossing('X', ago(11), 0, 'MODERATE'),
      crossing('X', ago(9), 0, 'MODERATE'),
      crossing('X', ago(5), 0, 'MODERATE'),
      crossing('X', ago(3), 0, 'MODERATE'),
      crossing('X', ago(2), 2, 'MODERATE'),
      crossing('X', ago(1), 2, 'MODERATE'),
    ]
    const anomalies = detectAnomalies(rows, now).filter((a) => a.kind === 'proveedor_slip')
    expect(anomalies.map((a) => a.subject)).toEqual(['SEVERE', 'MODERATE'])
  })

  it('emits humanized Spanish detail copy', () => {
    const rows = [
      crossing('X', ago(13), 0, 'PRV_Z'),
      crossing('X', ago(12), 0, 'PRV_Z'),
      crossing('X', ago(11), 0, 'PRV_Z'),
      crossing('X', ago(10), 0, 'PRV_Z'),
      crossing('X', ago(6), 2, 'PRV_Z'),
      crossing('X', ago(4), 2, 'PRV_Z'),
      crossing('X', ago(1), 2, 'PRV_Z'),
    ]
    const anomalies = detectAnomalies(rows, now)
    const slip = anomalies.find((a) => a.kind === 'proveedor_slip')
    expect(slip?.detail).toMatch(/Proveedor PRV_Z bajó de \d+% a \d+% verde esta semana/)
  })

  // ── volume_spike rule ─────────────────────────────────────────
  it('fires volume_spike when a SKU triples week-over-week', () => {
    const rows = [
      // prior week: 3 crossings for SPIKE-SKU
      crossing('SPIKE-SKU', ago(13), 0, 'PRV_V'),
      crossing('SPIKE-SKU', ago(11), 0, 'PRV_V'),
      crossing('SPIKE-SKU', ago(9), 0, 'PRV_V'),
      // recent week: 12 crossings (4× spike)
      crossing('SPIKE-SKU', ago(6), 0, 'PRV_V'),
      crossing('SPIKE-SKU', ago(6), 0, 'PRV_V'),
      crossing('SPIKE-SKU', ago(5), 0, 'PRV_V'),
      crossing('SPIKE-SKU', ago(5), 0, 'PRV_V'),
      crossing('SPIKE-SKU', ago(4), 0, 'PRV_V'),
      crossing('SPIKE-SKU', ago(4), 0, 'PRV_V'),
      crossing('SPIKE-SKU', ago(3), 0, 'PRV_V'),
      crossing('SPIKE-SKU', ago(3), 0, 'PRV_V'),
      crossing('SPIKE-SKU', ago(2), 0, 'PRV_V'),
      crossing('SPIKE-SKU', ago(2), 0, 'PRV_V'),
      crossing('SPIKE-SKU', ago(1), 0, 'PRV_V'),
      crossing('SPIKE-SKU', ago(1), 0, 'PRV_V'),
    ]
    const anomalies = detectAnomalies(rows, now)
    const spike = anomalies.find(
      (a) => a.kind === 'volume_spike' && a.subject === 'SPIKE-SKU',
    )
    expect(spike).toBeDefined()
    expect(spike!.metadata.recent_count).toBe(12)
    expect(spike!.metadata.prior_count).toBe(3)
    expect(Number(spike!.metadata.ratio)).toBeGreaterThanOrEqual(4)
    expect(spike!.detail).toMatch(/subió de 3 a 12 cruces/)
  })

  it('does NOT fire volume_spike with insufficient prior sample (< 3)', () => {
    const rows = [
      // prior week: only 2 → below threshold
      crossing('LOW-PRIOR', ago(13), 0, 'PRV_W'),
      crossing('LOW-PRIOR', ago(11), 0, 'PRV_W'),
      // recent: 10 crossings (huge ratio, but prior too low to trust)
      ...Array.from({ length: 10 }, (_, i) =>
        crossing('LOW-PRIOR', ago(1 + (i % 5)), 0, 'PRV_W'),
      ),
    ]
    const anomalies = detectAnomalies(rows, now)
    expect(
      anomalies.find((a) => a.kind === 'volume_spike' && a.subject === 'LOW-PRIOR'),
    ).toBeUndefined()
  })

  it('does NOT fire volume_spike when ratio is below 3×', () => {
    const rows = [
      // prior: 5 crossings
      ...Array.from({ length: 5 }, (_, i) =>
        crossing('STEADY', ago(9 + i), 0, 'PRV_S'),
      ),
      // recent: 10 (2× — below threshold of 3×)
      ...Array.from({ length: 10 }, (_, i) =>
        crossing('STEADY', ago(1 + (i % 5)), 0, 'PRV_S'),
      ),
    ]
    const anomalies = detectAnomalies(rows, now)
    expect(
      anomalies.find((a) => a.kind === 'volume_spike' && a.subject === 'STEADY'),
    ).toBeUndefined()
  })

  // ── new_proveedor rule ─────────────────────────────────────────
  it('fires new_proveedor when a supplier appears for the first time in 14d', () => {
    const rows = [
      crossing('X', ago(5), 0, 'BRAND-NEW-SUPPLIER'),
      crossing('X', ago(3), 0, 'BRAND-NEW-SUPPLIER'),
    ]
    const anomalies = detectAnomalies(rows, now)
    const np = anomalies.find(
      (a) => a.kind === 'new_proveedor' && a.subject === 'BRAND-NEW-SUPPLIER',
    )
    expect(np).toBeDefined()
    expect(np!.score).toBe(0.4)
    expect(np!.metadata.total_crossings).toBe(2)
    expect(np!.detail).toMatch(/apareció por primera vez/)
    expect(np!.detail).toMatch(/Validar RFC, T-MEC/)
  })

  it('does NOT fire new_proveedor when supplier has > 3 crossings', () => {
    const rows = [
      crossing('X', ago(7), 0, 'ESTABLISHED'),
      crossing('X', ago(5), 0, 'ESTABLISHED'),
      crossing('X', ago(3), 0, 'ESTABLISHED'),
      crossing('X', ago(1), 0, 'ESTABLISHED'),
      crossing('X', ago(1), 0, 'ESTABLISHED'),
    ]
    const anomalies = detectAnomalies(rows, now)
    expect(
      anomalies.find((a) => a.kind === 'new_proveedor' && a.subject === 'ESTABLISHED'),
    ).toBeUndefined()
  })

  it('does NOT fire new_proveedor when first-seen is older than 14 days', () => {
    const rows = [
      crossing('X', ago(20), 0, 'OLD-BUT-RARE'),
      crossing('X', ago(3), 0, 'OLD-BUT-RARE'),
    ]
    const anomalies = detectAnomalies(rows, now)
    expect(
      anomalies.find((a) => a.kind === 'new_proveedor' && a.subject === 'OLD-BUT-RARE'),
    ).toBeUndefined()
  })
})

describe('computeVolumeSummary', () => {
  const now = Date.UTC(2026, 3, 21)
  function ago(days: number): string {
    return new Date(now - days * 86_400_000).toISOString()
  }

  it('returns zeros when no crossings', () => {
    const v = computeVolumeSummary([], now)
    expect(v.recent_7d).toBe(0)
    expect(v.prior_7d).toBe(0)
    expect(v.ratio).toBeNull()
    expect(v.delta_pct).toBeNull()
  })

  it('counts recent vs prior 7d windows correctly', () => {
    const v = computeVolumeSummary(
      [
        { fecha_cruce: ago(1) },   // recent
        { fecha_cruce: ago(3) },   // recent
        { fecha_cruce: ago(6) },   // recent
        { fecha_cruce: ago(8) },   // prior
        { fecha_cruce: ago(13) },  // prior
        { fecha_cruce: ago(20) },  // outside window
      ],
      now,
    )
    expect(v.recent_7d).toBe(3)
    expect(v.prior_7d).toBe(2)
    expect(v.ratio).toBeCloseTo(1.5, 1)
    expect(v.delta_pct).toBe(50)
  })

  it('returns ratio=null when prior window is empty', () => {
    const v = computeVolumeSummary(
      [
        { fecha_cruce: ago(1) },
        { fecha_cruce: ago(3) },
      ],
      now,
    )
    expect(v.recent_7d).toBe(2)
    expect(v.prior_7d).toBe(0)
    expect(v.ratio).toBeNull()
    expect(v.delta_pct).toBeNull()
  })

  it('signals a drop correctly', () => {
    const v = computeVolumeSummary(
      [
        { fecha_cruce: ago(1) },
        { fecha_cruce: ago(8) },
        { fecha_cruce: ago(9) },
        { fecha_cruce: ago(10) },
        { fecha_cruce: ago(12) },
      ],
      now,
    )
    expect(v.recent_7d).toBe(1)
    expect(v.prior_7d).toBe(4)
    expect(v.delta_pct).toBe(-75)
  })

  it('emits a 7-point daily series oldest → newest', () => {
    const v = computeVolumeSummary(
      [
        { fecha_cruce: ago(0), semaforo: 0 },
        { fecha_cruce: ago(0), semaforo: 0 },
        { fecha_cruce: ago(2), semaforo: 1 },
        { fecha_cruce: ago(6), semaforo: 0 },
      ],
      now,
    )
    expect(v.daily_series).toHaveLength(7)
    // Newest bucket is index 6 (today) — should have count 2, verde 100%.
    expect(v.daily_series[6].count).toBe(2)
    expect(v.daily_series[6].verde_pct).toBe(100)
    // 2 days ago (index 4): count 1, verde 0% (1 amarillo).
    expect(v.daily_series[4].count).toBe(1)
    expect(v.daily_series[4].verde_pct).toBe(0)
    // 6 days ago (index 0): count 1, verde 100%.
    expect(v.daily_series[0].count).toBe(1)
    expect(v.daily_series[0].verde_pct).toBe(100)
    // Days with no crossings: count 0, verde_pct null.
    expect(v.daily_series[1].count).toBe(0)
    expect(v.daily_series[1].verde_pct).toBeNull()
  })
})

describe('computeFraccionHealth', () => {
  it('returns empty when no crossings have fraccion', () => {
    expect(
      computeFraccionHealth([
        { fraccion: null, fecha_cruce: '2026-04-18', semaforo: 0 },
      ]),
    ).toEqual([])
  })

  it('groups by 2-digit chapter and counts semáforo per chapter', () => {
    const out = computeFraccionHealth([
      { fraccion: '3903.20.01', fecha_cruce: '2026-04-18', semaforo: 0 },
      { fraccion: '3903.30.01', fecha_cruce: '2026-04-17', semaforo: 0 },
      { fraccion: '3903.20.01', fecha_cruce: '2026-04-16', semaforo: 2 },
      { fraccion: '8471.30.01', fecha_cruce: '2026-04-15', semaforo: 0 },
    ])
    const ch39 = out.find((f) => f.chapter === '39')
    expect(ch39).toBeDefined()
    expect(ch39!.total_crossings).toBe(3)
    expect(ch39!.verde_count).toBe(2)
    expect(ch39!.rojo_count).toBe(1)
    expect(ch39!.pct_verde).toBe(67)
    expect(ch39!.last_fecha_cruce).toBe('2026-04-18')

    const ch84 = out.find((f) => f.chapter === '84')
    expect(ch84).toBeDefined()
    expect(ch84!.total_crossings).toBe(1)
    expect(ch84!.pct_verde).toBe(100)
  })

  it('normalizes bare-digit fracciones (no dots)', () => {
    const out = computeFraccionHealth([
      { fraccion: '39032001', fecha_cruce: '2026-04-18', semaforo: 0 },
      { fraccion: '84713001', fecha_cruce: '2026-04-15', semaforo: 2 },
    ])
    expect(out.find((f) => f.chapter === '39')?.pct_verde).toBe(100)
    expect(out.find((f) => f.chapter === '84')?.pct_verde).toBe(0)
  })

  it('sorts by total_crossings descending', () => {
    const out = computeFraccionHealth([
      { fraccion: '8471.30.01', fecha_cruce: '2026-04-15', semaforo: 0 },
      { fraccion: '3903.20.01', fecha_cruce: '2026-04-18', semaforo: 0 },
      { fraccion: '3903.30.01', fecha_cruce: '2026-04-17', semaforo: 0 },
      { fraccion: '3903.20.01', fecha_cruce: '2026-04-16', semaforo: 2 },
    ])
    expect(out[0].chapter).toBe('39')
    expect(out[0].total_crossings).toBe(3)
    expect(out[1].chapter).toBe('84')
  })
})

describe('predictVerdeProbability', () => {
  function streak(overrides: Partial<PartStreak>): PartStreak {
    return {
      cve_producto: 'SKU-A',
      current_verde_streak: 0,
      longest_verde_streak: 0,
      just_broke_streak: false,
      last_semaforo: null,
      last_fecha_cruce: null,
      total_crossings: 0,
      ...overrides,
    }
  }
  function proveedor(overrides: Partial<ProveedorHealth>): ProveedorHealth {
    return {
      cve_proveedor: 'PRV_1',
      total_crossings: 10,
      verde_count: 9,
      amarillo_count: 1,
      rojo_count: 0,
      pct_verde: 90,
      last_fecha_cruce: null,
      ...overrides,
    }
  }
  function fraccion(overrides: Partial<FraccionHealth>): FraccionHealth {
    return {
      chapter: '39',
      total_crossings: 20,
      verde_count: 19,
      amarillo_count: 1,
      rojo_count: 0,
      pct_verde: 95,
      last_fecha_cruce: null,
      ...overrides,
    }
  }

  it('returns the baseline when no streak + no proveedor signal', () => {
    const p = predictVerdeProbability({
      streak: streak({ current_verde_streak: 0, total_crossings: 1 }),
      proveedor: null,
      fraccionHealth: null,
      baselinePct: 85,
    })
    // No positive factors, no negative factors → probability = baseline.
    expect(p.probability).toBe(0.85)
    expect(p.baseline_pct).toBe(85)
  })

  it('adds streak contribution capped at +15pp', () => {
    const p = predictVerdeProbability({
      streak: streak({ current_verde_streak: 10, total_crossings: 10 }),
      proveedor: null,
      fraccionHealth: null,
      baselinePct: 85,
    })
    // 10 × 5 = 50, capped at 15. Plus sample_confidence +3 (≥5 cruces).
    expect(p.factors.find((f) => f.factor === 'streak')?.delta_pp).toBe(15)
    expect(p.probability).toBe(1.03 > 0.99 ? 0.99 : 1.03)
    expect(p.band).toBe('high')
  })

  it('adds +10pp for excellent proveedor (≥95% verde)', () => {
    const p = predictVerdeProbability({
      streak: streak({ current_verde_streak: 0, total_crossings: 2 }),
      proveedor: proveedor({ pct_verde: 98, total_crossings: 20 }),
      fraccionHealth: null,
      baselinePct: 85,
    })
    expect(p.factors.find((f) => f.factor === 'proveedor')?.delta_pp).toBe(10)
  })

  it('subtracts -15pp for just_broke_streak', () => {
    const p = predictVerdeProbability({
      streak: streak({
        current_verde_streak: 0,
        longest_verde_streak: 6,
        just_broke_streak: true,
        total_crossings: 7,
      }),
      proveedor: null,
      fraccionHealth: null,
      baselinePct: 85,
    })
    expect(p.factors.find((f) => f.factor === 'streak_break')?.delta_pp).toBe(-15)
    expect(p.probability).toBe(0.73) // 85 + 3 (sample) - 15 (break) = 73
  })

  it('subtracts -10pp for risky fracción chapter (<90%)', () => {
    const p = predictVerdeProbability({
      streak: streak({ current_verde_streak: 2, total_crossings: 3 }),
      proveedor: null,
      fraccionHealth: fraccion({ pct_verde: 75, total_crossings: 20 }),
      baselinePct: 85,
    })
    expect(p.factors.find((f) => f.factor === 'fraccion_risk')?.delta_pp).toBe(-10)
  })

  it('ignores proveedor with fewer than 3 crossings (noise guard)', () => {
    const p = predictVerdeProbability({
      streak: streak({ current_verde_streak: 1, total_crossings: 1 }),
      proveedor: proveedor({ pct_verde: 100, total_crossings: 1 }),
      fraccionHealth: null,
      baselinePct: 85,
    })
    // streak(1)*5=5, no sample boost, no proveedor factor → 90
    expect(p.factors.find((f) => f.factor === 'proveedor')).toBeUndefined()
  })

  it('clips result to [5, 99]', () => {
    // Extreme positive case
    const hi = predictVerdeProbability({
      streak: streak({ current_verde_streak: 100, total_crossings: 100 }),
      proveedor: proveedor({ pct_verde: 100, total_crossings: 100 }),
      fraccionHealth: fraccion({ pct_verde: 100 }),
      baselinePct: 85,
    })
    expect(hi.probability).toBeLessThanOrEqual(0.99)
    expect(hi.probability).toBeGreaterThan(0.95)

    // Extreme negative case
    const lo = predictVerdeProbability({
      streak: streak({
        current_verde_streak: 0,
        longest_verde_streak: 6,
        just_broke_streak: true,
        total_crossings: 10,
      }),
      proveedor: proveedor({ pct_verde: 50, total_crossings: 20 }),
      fraccionHealth: fraccion({ pct_verde: 60 }),
      baselinePct: 50,
    })
    expect(lo.probability).toBeGreaterThanOrEqual(0.05)
    expect(lo.band).toBe('low')
  })

  it('emits Spanish summary with the probability + band', () => {
    const p = predictVerdeProbability({
      streak: streak({ current_verde_streak: 4, total_crossings: 5 }),
      proveedor: proveedor({ pct_verde: 96, total_crossings: 10 }),
      fraccionHealth: null,
      baselinePct: 85,
    })
    expect(p.summary).toMatch(/Probabilidad \d+% de cruzar verde/)
    expect(p.summary).toMatch(/confianza (alta|media|baja)/)
  })

  it('classifies bands ≥92 high · ≥80 medium · <80 low', () => {
    // high
    expect(
      predictVerdeProbability({
        streak: streak({ current_verde_streak: 3, total_crossings: 10 }),
        proveedor: proveedor({ pct_verde: 98, total_crossings: 20 }),
        fraccionHealth: null,
        baselinePct: 85,
      }).band,
    ).toBe('high')

    // medium
    expect(
      predictVerdeProbability({
        streak: streak({ total_crossings: 5 }),
        proveedor: null,
        fraccionHealth: null,
        baselinePct: 85,
      }).band,
    ).toBe('medium')

    // low
    expect(
      predictVerdeProbability({
        streak: streak({
          current_verde_streak: 0,
          longest_verde_streak: 6,
          just_broke_streak: true,
          total_crossings: 8,
        }),
        proveedor: proveedor({ pct_verde: 60, total_crossings: 20 }),
        fraccionHealth: null,
        baselinePct: 85,
      }).band,
    ).toBe('low')
  })
})
