import { describe, it, expect } from 'vitest'
import {
  explainVerdePrediction,
  explainVerdePredictionOneLine,
  explainVerdePredictionPlainText,
} from '../explain'
import type { VerdePrediction } from '../crossing-insights'

function pred(overrides: Partial<VerdePrediction> = {}): VerdePrediction {
  return {
    cve_producto: 'SKU-A',
    probability: 0.87,
    band: 'medium',
    summary: 'Probabilidad 87% de cruzar verde · confianza media',
    factors: [
      { factor: 'streak', delta_pp: 15, detail: '3 verdes consecutivos (+15 pp)' },
      { factor: 'proveedor', delta_pp: 10, detail: 'Proveedor PRV_1 @ 96% verde (+10 pp)' },
      { factor: 'sample_confidence', delta_pp: 3, detail: '8 cruces en ventana (+3 pp)' },
    ],
    baseline_pct: 60,
    cve_proveedor: 'PRV_1',
    last_fecha_cruce: '2026-04-18T00:00:00Z',
    total_crossings: 8,
    ...overrides,
  }
}

describe('explainVerdePrediction', () => {
  it('returns structured output with headline + bullets + meta', () => {
    const out = explainVerdePrediction(pred())
    expect(out.headline).toContain('87%')
    expect(out.probability_pct).toBe(87)
    expect(out.confidence_band_label).toBe('media')
    expect(out.confidence_band_en).toBe('medium')
    expect(out.bullets).toHaveLength(3)
    expect(out.meta).toContain('Proveedor PRV_1')
    expect(out.meta).toContain('8 cruces ventana')
    expect(out.meta).toContain('último 2026-04-18')
  })

  it('sorts bullets by absolute delta_pp descending', () => {
    const out = explainVerdePrediction(
      pred({
        factors: [
          { factor: 'small', delta_pp: 3, detail: 'a' },
          { factor: 'huge_negative', delta_pp: -15, detail: 'c' },
          { factor: 'medium', delta_pp: 10, detail: 'b' },
        ],
      }),
    )
    expect(out.bullets.map((b) => b.kind)).toEqual(['huge_negative', 'medium', 'small'])
  })

  it('stable-sorts ties by factor name (determinism)', () => {
    const out = explainVerdePrediction(
      pred({
        factors: [
          { factor: 'beta', delta_pp: 5, detail: 'b' },
          { factor: 'alpha', delta_pp: 5, detail: 'a' },
        ],
      }),
    )
    expect(out.bullets.map((b) => b.kind)).toEqual(['alpha', 'beta'])
  })

  it('assigns tone based on sign', () => {
    const out = explainVerdePrediction(
      pred({
        factors: [
          { factor: 'a', delta_pp: 10, detail: 'positive' },
          { factor: 'b', delta_pp: -5, detail: 'negative' },
          { factor: 'c', delta_pp: 0, detail: 'neutral' },
        ],
      }),
    )
    expect(out.bullets.find((b) => b.kind === 'a')?.tone).toBe('positive')
    expect(out.bullets.find((b) => b.kind === 'b')?.tone).toBe('negative')
    expect(out.bullets.find((b) => b.kind === 'c')?.tone).toBe('neutral')
  })

  it('respects maxBullets opt', () => {
    const out = explainVerdePrediction(pred(), { maxBullets: 1 })
    expect(out.bullets).toHaveLength(1)
    expect(out.bullets[0].kind).toBe('streak') // highest magnitude
  })

  it('supports custom date formatter', () => {
    const out = explainVerdePrediction(pred(), {
      formatDate: () => 'CUSTOM-FORMAT',
    })
    expect(out.meta).toContain('CUSTOM-FORMAT')
    expect(out.meta).not.toContain('2026-04-18')
  })

  it('omits proveedor from meta when null', () => {
    const out = explainVerdePrediction(pred({ cve_proveedor: null }))
    expect(out.meta).not.toContain('Proveedor')
    expect(out.meta).toContain('8 cruces ventana')
  })

  it('omits último from meta when last_fecha_cruce is null', () => {
    const out = explainVerdePrediction(pred({ last_fecha_cruce: null }))
    expect(out.meta).not.toContain('último')
  })

  it('handles low band correctly', () => {
    const out = explainVerdePrediction(pred({ probability: 0.55, band: 'low' }))
    expect(out.probability_pct).toBe(55)
    expect(out.confidence_band_label).toBe('baja')
    expect(out.confidence_band_en).toBe('low')
  })

  it('handles high band correctly', () => {
    const out = explainVerdePrediction(pred({ probability: 0.95, band: 'high' }))
    expect(out.probability_pct).toBe(95)
    expect(out.confidence_band_label).toBe('alta')
  })

  it('singular "cruce" when total_crossings === 1', () => {
    const out = explainVerdePrediction(pred({ total_crossings: 1 }))
    expect(out.meta).toContain('1 cruce ventana')
    expect(out.meta).not.toContain('1 cruces')
  })
})

describe('explainVerdePredictionOneLine', () => {
  it('returns a terse single-line summary', () => {
    const s = explainVerdePredictionOneLine(pred())
    expect(s).toBe('SKU-A · 87% verde (media) · 3 verdes consecutivos (+15 pp)')
    expect(s.length).toBeLessThanOrEqual(160)
  })

  it('truncates when line exceeds 160 chars', () => {
    const s = explainVerdePredictionOneLine(
      pred({
        cve_producto: 'VERY-LONG-SKU-NAME-THAT-GOES-ON-AND-ON',
        factors: [
          {
            factor: 'proveedor',
            delta_pp: 10,
            detail: 'Proveedor A-VERY-LONG-SUPPLIER-NAME-THAT-TAKES-UP-LOTS-OF-SPACE @ 96% verde with all kinds of extra context to make this long long long (+10 pp)',
          },
        ],
      }),
    )
    expect(s.length).toBeLessThanOrEqual(160)
    expect(s.endsWith('...')).toBe(true)
  })

  it('handles zero-factors predictions gracefully', () => {
    const s = explainVerdePredictionOneLine(pred({ factors: [] }))
    expect(s).toBe('SKU-A · 87% verde (media)')
  })
})

describe('explainVerdePredictionPlainText', () => {
  it('returns a plain-text block suitable for email / PDF', () => {
    const s = explainVerdePredictionPlainText(pred())
    expect(s).toContain('SKU-A: 87% probable verde (confianza media).')
    expect(s).toContain('Factores:')
    expect(s).toContain('  - 3 verdes consecutivos (+15 pp) (+15 pp)')
    expect(s).toContain('Proveedor PRV_1 · 8 cruces ventana')
  })

  it('handles predictions with no factors (baseline only)', () => {
    const s = explainVerdePredictionPlainText(pred({ factors: [] }))
    expect(s).not.toContain('Factores:')
    expect(s).toContain('SKU-A: 87% probable verde')
    expect(s).toContain('Proveedor PRV_1')
  })

  it('signs positive deltas with + and negative without extra', () => {
    const s = explainVerdePredictionPlainText(
      pred({
        factors: [
          { factor: 'a', delta_pp: 10, detail: 'positive factor' },
          { factor: 'b', delta_pp: -5, detail: 'negative factor' },
        ],
      }),
    )
    expect(s).toContain('  - positive factor (+10 pp)')
    expect(s).toContain('  - negative factor (-5 pp)')
  })
})
