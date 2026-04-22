import { describe, it, expect } from 'vitest'
import {
  calculateDTA,
  calculateIGI,
  calculateIVA,
  calculatePedimento,
} from '../calculations'
import type { DTARates } from '@/lib/rates'

/**
 * Financial calculations — regression fence.
 *
 * These tests lock the cascading-base contract (core invariant #9).
 * Any change that makes `IVA = value × 0.16` flat here will fire.
 */

const RATES: DTARates = {
  A1: { type: 'fixed', amount: 0.008 },   // 8 per mille
  A3: { type: 'fixed', amount: 0.008 },
  IN: { type: 'fixed', amount: 408 },     // IMMEX cuota fija
  IT: { type: 'fixed', amount: 0 },
  F4: { type: 'fixed', amount: 0.008 },
  F5: { type: 'fixed', amount: 0 },
  F6: { type: 'fixed', amount: 0.008 },
}

describe('calculateDTA', () => {
  it('A1 regime: per-mille on valor_aduana', () => {
    const r = calculateDTA({
      valor_usd: 10000, tipo_cambio: 17, regimen: 'A1', rates: RATES,
    })
    // valor_aduana = 10000 × 17 = 170,000 MXN
    // DTA = 170,000 × 0.008 = 1,360 MXN
    expect(r.valor_aduana_mxn).toBe(170000)
    expect(r.dta_mxn).toBe(1360)
    expect(r.regimen_used).toBe('A1')
    expect(r.explanation).toMatch(/A1.*8\.0‰/)
  })

  it('IN regime (IMMEX): fixed cuota $408 regardless of value', () => {
    const r1 = calculateDTA({
      valor_usd: 10000, tipo_cambio: 17, regimen: 'IN', rates: RATES,
    })
    expect(r1.dta_mxn).toBe(408)

    // Same fixed amount on a 100× larger invoice.
    const r2 = calculateDTA({
      valor_usd: 1_000_000, tipo_cambio: 17, regimen: 'IN', rates: RATES,
    })
    expect(r2.dta_mxn).toBe(408)
    expect(r2.explanation).toMatch(/cuota fija/)
  })

  it('IT / F5 regimes: DTA exempt (0)', () => {
    expect(
      calculateDTA({
        valor_usd: 10000, tipo_cambio: 17, regimen: 'IT', rates: RATES,
      }).dta_mxn,
    ).toBe(0)
    expect(
      calculateDTA({
        valor_usd: 10000, tipo_cambio: 17, regimen: 'F5', rates: RATES,
      }).dta_mxn,
    ).toBe(0)
  })

  it('unknown regime defaults to A1 behavior (conservative)', () => {
    const r = calculateDTA({
      valor_usd: 10000, tipo_cambio: 17, regimen: 'XX', rates: RATES,
    })
    expect(r.dta_mxn).toBe(1360) // same as A1
    expect(r.regimen_used).toBe('A1')
  })

  it('rejects negative / invalid inputs', () => {
    expect(() =>
      calculateDTA({ valor_usd: -1, tipo_cambio: 17, regimen: 'A1', rates: RATES }),
    ).toThrow(/non-negative/)
    expect(() =>
      calculateDTA({ valor_usd: 100, tipo_cambio: 0, regimen: 'A1', rates: RATES }),
    ).toThrow(/tipo_cambio.*positive/)
    expect(() =>
      calculateDTA({ valor_usd: 100, tipo_cambio: NaN, regimen: 'A1', rates: RATES }),
    ).toThrow(/tipo_cambio/)
  })

  it('handles zero valor_usd without error', () => {
    const r = calculateDTA({
      valor_usd: 0, tipo_cambio: 17, regimen: 'A1', rates: RATES,
    })
    expect(r.valor_aduana_mxn).toBe(0)
    expect(r.dta_mxn).toBe(0)
  })
})

describe('calculateIGI', () => {
  it('general case: valor_aduana × rate', () => {
    const r = calculateIGI({ valor_aduana_mxn: 170000, igi_rate: 0.05 })
    expect(r.igi_mxn).toBe(8500)
    expect(r.tmec_applied).toBe(false)
    expect(r.rate_applied).toBe(0.05)
  })

  it('T-MEC eligible: IGI is zero + records savings estimate', () => {
    const r = calculateIGI({
      valor_aduana_mxn: 170000, igi_rate: 0.05, tmec_eligible: true,
    })
    expect(r.igi_mxn).toBe(0)
    expect(r.tmec_applied).toBe(true)
    expect(r.rate_applied).toBe(0)
    expect(r.explanation).toMatch(/T-MEC/)
    expect(r.explanation).toMatch(/8,500 MXN/) // the savings
  })

  it('rejects invalid rate ranges', () => {
    expect(() =>
      calculateIGI({ valor_aduana_mxn: 170000, igi_rate: -0.01 }),
    ).toThrow(/igi_rate.*\[0, 1\]/)
    expect(() =>
      calculateIGI({ valor_aduana_mxn: 170000, igi_rate: 5 }),
    ).toThrow(/igi_rate.*\[0, 1\]/)
  })
})

describe('calculateIVA (cascading base — the critical one)', () => {
  it('applies IVA to valor_aduana + DTA + IGI (NEVER value × 0.16 flat)', () => {
    const r = calculateIVA({
      valor_aduana_mxn: 170000,
      dta_mxn: 1360,
      igi_mxn: 8500,
      iva_rate: 0.16,
    })
    // Base = 170000 + 1360 + 8500 = 179,860
    // IVA  = 179860 × 0.16 = 28,777.60
    expect(r.iva_base_mxn).toBe(179860)
    expect(r.iva_mxn).toBe(28777.6)
    expect(r.explanation).toMatch(/cascada/)
  })

  it('regression fence: result differs from naive value × 0.16 flat', () => {
    const cascading = calculateIVA({
      valor_aduana_mxn: 170000,
      dta_mxn: 1360,
      igi_mxn: 8500,
      iva_rate: 0.16,
    })
    const naiveFlat = 170000 * 0.16 // the WRONG formula — 27,200
    // Cascading is ~5.8% higher than flat — that's the real IVA owed.
    expect(cascading.iva_mxn).toBeGreaterThan(naiveFlat)
    expect(cascading.iva_mxn - naiveFlat).toBeCloseTo(1577.6, 1)
  })

  it('rejects rate > 1 (common mistake: passing 16 instead of 0.16)', () => {
    expect(() =>
      calculateIVA({
        valor_aduana_mxn: 170000, dta_mxn: 1360, igi_mxn: 8500, iva_rate: 16,
      }),
    ).toThrow(/iva_rate looks like a percentage/)
  })

  it('handles zero DTA + IGI correctly (still cascades, just trivially)', () => {
    const r = calculateIVA({
      valor_aduana_mxn: 170000, dta_mxn: 0, igi_mxn: 0, iva_rate: 0.16,
    })
    expect(r.iva_base_mxn).toBe(170000)
    expect(r.iva_mxn).toBe(27200)
  })
})

describe('calculatePedimento — end-to-end', () => {
  it('A1 general (non-T-MEC) cascades correctly through all 3 stages', () => {
    const r = calculatePedimento({
      valor_usd: 10000,
      tipo_cambio: 17,
      regimen: 'A1',
      igi_rate: 0.05,
      tmec_eligible: false,
      rates: RATES,
      iva_rate: 0.16,
    })
    expect(r.valor_aduana_mxn).toBe(170000)
    expect(r.dta.dta_mxn).toBe(1360)
    expect(r.igi.igi_mxn).toBe(8500)
    expect(r.iva.iva_mxn).toBe(28777.6)
    // Total = 1360 + 8500 + 28777.60 = 38,637.60
    expect(r.total_taxes_mxn).toBe(38637.6)
    expect(r.total_landed_mxn).toBe(208637.6)
    expect(r.total_landed_usd).toBeCloseTo(12272.8, 1)
    expect(r.tmec_savings_mxn).toBeNull()
  })

  it('A1 T-MEC eligible — IGI zeroed, IVA base shrinks accordingly', () => {
    const r = calculatePedimento({
      valor_usd: 10000,
      tipo_cambio: 17,
      regimen: 'A1',
      igi_rate: 0.05,
      tmec_eligible: true,
      rates: RATES,
      iva_rate: 0.16,
    })
    expect(r.igi.igi_mxn).toBe(0)
    expect(r.iva.iva_base_mxn).toBe(171360) // 170000 + 1360 DTA, no IGI
    expect(r.iva.iva_mxn).toBe(27417.6)
    // T-MEC savings = general-IGI × (1 + IVA rate) = 8500 × 1.16 = 9,860
    expect(r.tmec_savings_mxn).toBeCloseTo(9860, 1)
  })

  it('IN (IMMEX) regime — fixed DTA + normal IGI + cascading IVA', () => {
    const r = calculatePedimento({
      valor_usd: 10000,
      tipo_cambio: 17,
      regimen: 'IN',
      igi_rate: 0.05,
      tmec_eligible: false,
      rates: RATES,
      iva_rate: 0.16,
    })
    expect(r.dta.dta_mxn).toBe(408) // fixed
    expect(r.igi.igi_mxn).toBe(8500)
    // Base = 170000 + 408 + 8500 = 178,908 · IVA = 28,625.28
    expect(r.iva.iva_base_mxn).toBe(178908)
    expect(r.iva.iva_mxn).toBe(28625.28)
  })

  it('IT regime — DTA exempt, only IGI + IVA (no cascade from DTA)', () => {
    const r = calculatePedimento({
      valor_usd: 10000,
      tipo_cambio: 17,
      regimen: 'IT',
      igi_rate: 0.05,
      tmec_eligible: false,
      rates: RATES,
      iva_rate: 0.16,
    })
    expect(r.dta.dta_mxn).toBe(0)
    expect(r.igi.igi_mxn).toBe(8500)
    expect(r.iva.iva_base_mxn).toBe(178500) // 170000 + 0 + 8500
    expect(r.total_taxes_mxn).toBe(37060) // 0 + 8500 + 28560
  })
})
