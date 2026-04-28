import { describe, it, expect } from 'vitest'
import { recommendNextAction, type RecommendInput } from '../recommend'
import type {
  Anomaly,
  FraccionHealth,
  PartStreak,
  ProveedorHealth,
  VerdePrediction,
  VolumeSummary,
} from '../crossing-insights'

// ── Fixtures ──────────────────────────────────────────────────────

function streak(overrides: Partial<PartStreak> = {}): PartStreak {
  return {
    cve_producto: 'SKU-A',
    current_verde_streak: 0,
    longest_verde_streak: 0,
    just_broke_streak: false,
    last_semaforo: 0,
    last_fecha_cruce: '2026-04-20T00:00:00Z',
    total_crossings: 3,
    ...overrides,
  }
}

function prediction(overrides: Partial<VerdePrediction> = {}): VerdePrediction {
  return {
    cve_producto: 'SKU-A',
    probability: 0.9,
    band: 'high',
    summary: 'Probabilidad 90%',
    factors: [],
    baseline_pct: 85,
    cve_proveedor: 'PRV_1',
    last_fecha_cruce: '2026-04-20T00:00:00Z',
    total_crossings: 8,
    ...overrides,
  }
}

function proveedor(overrides: Partial<ProveedorHealth> = {}): ProveedorHealth {
  return {
    cve_proveedor: 'PRV_1',
    total_crossings: 10,
    verde_count: 8,
    amarillo_count: 1,
    rojo_count: 1,
    pct_verde: 80,
    last_fecha_cruce: '2026-04-20T00:00:00Z',
    ...overrides,
  }
}

function fraccion(overrides: Partial<FraccionHealth> = {}): FraccionHealth {
  return {
    chapter: '39',
    total_crossings: 20,
    verde_count: 18,
    amarillo_count: 1,
    rojo_count: 1,
    pct_verde: 90,
    last_fecha_cruce: '2026-04-20T00:00:00Z',
    ...overrides,
  }
}

function anomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    kind: 'new_proveedor',
    subject: 'PRV_NEW',
    detail: 'Primer cruce observado',
    score: 0.5,
    occurred_at: '2026-04-20T00:00:00Z',
    metadata: {},
    ...overrides,
  }
}

function volume(overrides: Partial<VolumeSummary> = {}): VolumeSummary {
  return {
    recent_7d: 20,
    prior_7d: 15,
    ratio: 20 / 15,
    delta_pct: 33.3,
    daily_series: [],
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────

describe('recommendNextAction — individual rules', () => {
  it('no signals → single no_action recommendation', () => {
    const recs = recommendNextAction({})
    expect(recs).toHaveLength(1)
    expect(recs[0].kind).toBe('no_action')
    expect(recs[0].priority).toBe('low')
    expect(recs[0].action_es).toMatch(/calma/i)
  })

  it('celebrate_streak fires on long streak + high band', () => {
    const input: RecommendInput = {
      streak: streak({ current_verde_streak: 7, longest_verde_streak: 7 }),
      prediction: prediction({ band: 'high' }),
    }
    const recs = recommendNextAction(input)
    expect(recs.some((r) => r.kind === 'celebrate_streak')).toBe(true)
  })

  it('celebrate_streak does NOT fire when band is not high', () => {
    const input: RecommendInput = {
      streak: streak({ current_verde_streak: 7 }),
      prediction: prediction({ band: 'medium' }),
    }
    const recs = recommendNextAction(input)
    expect(recs.some((r) => r.kind === 'celebrate_streak')).toBe(false)
  })

  it('watch_broken_streak fires when just_broke_streak is true', () => {
    const recs = recommendNextAction({
      streak: streak({ just_broke_streak: true }),
    })
    const rec = recs.find((r) => r.kind === 'watch_broken_streak')
    expect(rec).toBeDefined()
    expect(rec?.priority).toBe('medium')
    expect(rec?.action_es).toMatch(/racha/i)
  })

  it('prioritize_rojo_review fires on low band + enough crossings', () => {
    const recs = recommendNextAction({
      prediction: prediction({
        band: 'low',
        probability: 0.6,
        total_crossings: 4,
        factors: [{ factor: 'streak_break', delta_pp: -15, detail: 'Racha rota' }],
      }),
    })
    const rec = recs.find((r) => r.kind === 'prioritize_rojo_review')
    expect(rec).toBeDefined()
    expect(rec?.priority).toBe('high')
  })

  it('prioritize_rojo_review does NOT fire with too few crossings', () => {
    const recs = recommendNextAction({
      prediction: prediction({ band: 'low', total_crossings: 1 }),
    })
    expect(recs.some((r) => r.kind === 'prioritize_rojo_review')).toBe(false)
  })

  it('review_supplier_slip fires when pct_verde < 75 + enough crossings', () => {
    const recs = recommendNextAction({
      proveedor: proveedor({ pct_verde: 60, total_crossings: 10 }),
    })
    const rec = recs.find((r) => r.kind === 'review_supplier_slip')
    expect(rec).toBeDefined()
    expect(rec?.priority).toBe('medium')
    expect(rec?.subject).toBe('PRV_1')
  })

  it('review_supplier_slip does NOT fire with only 4 crossings', () => {
    const recs = recommendNextAction({
      proveedor: proveedor({ pct_verde: 60, total_crossings: 4 }),
    })
    expect(recs.some((r) => r.kind === 'review_supplier_slip')).toBe(false)
  })

  it('escalate_fraccion_risk fires when chapter pct_verde < 75 + vol >= 10', () => {
    const recs = recommendNextAction({
      fraccionHealth: fraccion({ chapter: '84', pct_verde: 60, total_crossings: 12 }),
    })
    const rec = recs.find((r) => r.kind === 'escalate_fraccion_risk')
    expect(rec).toBeDefined()
    expect(rec?.subject).toBe('capitulo-84')
  })

  it('validate_new_proveedor fires for new_proveedor anomaly', () => {
    const recs = recommendNextAction({
      anomalies: [anomaly({ kind: 'new_proveedor', subject: 'PRV_NEW' })],
    })
    const rec = recs.find((r) => r.kind === 'validate_new_proveedor')
    expect(rec).toBeDefined()
    expect(rec?.subject).toBe('PRV_NEW')
  })

  it('investigate_volume_spike fires for volume_spike anomaly', () => {
    const recs = recommendNextAction({
      anomalies: [anomaly({ kind: 'volume_spike', subject: 'SKU-HOT', detail: '3x volumen' })],
    })
    const rec = recs.find((r) => r.kind === 'investigate_volume_spike')
    expect(rec).toBeDefined()
    expect(rec?.subject).toBe('SKU-HOT')
  })

  it('unknown anomaly kinds pass through without firing recs', () => {
    const recs = recommendNextAction({
      anomalies: [anomaly({ kind: 'streak_break', subject: 'SKU-X' })],
    })
    expect(recs.every((r) => r.kind !== 'validate_new_proveedor')).toBe(true)
    expect(recs.every((r) => r.kind !== 'investigate_volume_spike')).toBe(true)
  })

  it('monitor_volume_drop fires when delta < -40 + prior >= 5', () => {
    const recs = recommendNextAction({
      volume: volume({ recent_7d: 2, prior_7d: 10, delta_pct: -80, ratio: 0.2 }),
    })
    const rec = recs.find((r) => r.kind === 'monitor_volume_drop')
    expect(rec).toBeDefined()
    expect(rec?.priority).toBe('low')
  })
})

describe('recommendNextAction — ordering + composition', () => {
  it('sorts by priority desc then subject asc', () => {
    const recs = recommendNextAction({
      prediction: prediction({
        cve_producto: 'SKU-Z',
        band: 'low',
        total_crossings: 5,
        factors: [{ factor: 'fraccion_risk', delta_pp: -10, detail: 'capítulo malo' }],
      }),
      proveedor: proveedor({ pct_verde: 50, total_crossings: 10, cve_proveedor: 'PRV_A' }),
      streak: streak({ just_broke_streak: true, cve_producto: 'SKU-M' }),
    })

    // priorities: rojo_review (high) → broken_streak + supplier_slip (medium) → low
    expect(recs[0].priority).toBe('high')
    expect(recs[0].kind).toBe('prioritize_rojo_review')

    const mediums = recs.filter((r) => r.priority === 'medium')
    expect(mediums.length).toBeGreaterThanOrEqual(2)
    // Among mediums, subject should be sorted asc: PRV_A < SKU-M
    const subjects = mediums.map((r) => r.subject)
    expect(subjects).toEqual([...subjects].sort((a, b) => a.localeCompare(b)))
  })

  it('handles full input stack with multiple concurrent rules', () => {
    const recs = recommendNextAction({
      streak: streak({ current_verde_streak: 8 }),
      prediction: prediction({ band: 'high' }),
      proveedor: proveedor({ pct_verde: 98, total_crossings: 20 }),
      fraccionHealth: fraccion({ pct_verde: 95 }),
      anomalies: [],
      volume: volume({ recent_7d: 25, prior_7d: 20, delta_pct: 25 }),
    })
    // Should at least fire celebrate_streak; no negatives present.
    expect(recs.some((r) => r.kind === 'celebrate_streak')).toBe(true)
    expect(recs.every((r) => r.kind !== 'no_action')).toBe(true)
  })

  it('every recommendation carries Spanish action + rationale', () => {
    const recs = recommendNextAction({
      prediction: prediction({ band: 'low', total_crossings: 5 }),
      proveedor: proveedor({ pct_verde: 50, total_crossings: 10 }),
      fraccionHealth: fraccion({ pct_verde: 60, total_crossings: 12 }),
    })
    for (const rec of recs) {
      expect(rec.action_es.length).toBeGreaterThan(0)
      expect(rec.rationale_es.length).toBeGreaterThan(0)
      expect(rec.metadata).toBeDefined()
    }
  })
})
