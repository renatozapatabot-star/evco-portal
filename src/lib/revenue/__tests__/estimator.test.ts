import { describe, it, expect } from 'vitest'
import {
  classifyRegime,
  estimateFeeUSD,
  estimateFromClaves,
  usdToMXN,
  pctChange,
  FEE_USD_STANDARD,
  FEE_USD_IMMEX,
} from '../estimator'

describe('classifyRegime', () => {
  it('classifies IMMEX claves as immex', () => {
    for (const k of ['IN', 'IMD', 'ITE', 'ITR', 'RT', 'AF', 'BM', 'F4', 'IM']) {
      expect(classifyRegime(k)).toBe('immex')
    }
  })

  it('classifies definitive claves as standard', () => {
    for (const k of ['A1', 'A3', 'A4', 'V1', 'BO']) {
      expect(classifyRegime(k)).toBe('standard')
    }
  })

  it('treats null and unknown claves as standard (safer floor)', () => {
    expect(classifyRegime(null)).toBe('standard')
    expect(classifyRegime(undefined)).toBe('standard')
    expect(classifyRegime('')).toBe('standard')
    expect(classifyRegime('XYZ')).toBe('standard')
  })

  it('is case-insensitive and trims whitespace', () => {
    expect(classifyRegime('in')).toBe('immex')
    expect(classifyRegime(' ITE ')).toBe('immex')
    expect(classifyRegime('a1')).toBe('standard')
  })
})

describe('estimateFeeUSD', () => {
  it('returns $400 USD for IMMEX claves', () => {
    expect(estimateFeeUSD('IN')).toBe(FEE_USD_IMMEX)
    expect(estimateFeeUSD('ITE')).toBe(400)
  })

  it('returns $125 USD for standard claves', () => {
    expect(estimateFeeUSD('A1')).toBe(FEE_USD_STANDARD)
    expect(estimateFeeUSD(null)).toBe(125)
  })
})

describe('estimateFromClaves', () => {
  it('rolls up a mixed batch with correct USD total', () => {
    const claves = ['A1', 'A1', 'IN', 'ITE', null, 'IMD', 'A3']
    const r = estimateFromClaves(claves)
    expect(r.count).toBe(7)
    expect(r.standardCount).toBe(4) // A1, A1, null→std, A3
    expect(r.immexCount).toBe(3) // IN, ITE, IMD
    expect(r.totalUSD).toBe(4 * 125 + 3 * 400) // 500 + 1200 = 1700
  })

  it('handles empty input', () => {
    const r = estimateFromClaves([])
    expect(r.count).toBe(0)
    expect(r.totalUSD).toBe(0)
  })
})

describe('usdToMXN', () => {
  it('multiplies USD by the rate', () => {
    expect(usdToMXN(100, 20)).toBe(2000)
    expect(usdToMXN(0, 20)).toBe(0)
  })

  it('returns 0 for non-finite inputs (keeps the dashboard stable)', () => {
    expect(usdToMXN(NaN, 20)).toBe(0)
    expect(usdToMXN(100, NaN)).toBe(0)
    expect(usdToMXN(100, Infinity)).toBe(0)
  })
})

describe('pctChange', () => {
  it('computes positive change', () => {
    expect(pctChange(110, 100)).toBe(10)
  })

  it('computes negative change', () => {
    expect(pctChange(80, 100)).toBe(-20)
  })

  it('returns null when the prior value is zero (undefined growth)', () => {
    expect(pctChange(50, 0)).toBeNull()
  })

  it('returns null for non-finite inputs', () => {
    expect(pctChange(NaN, 100)).toBeNull()
    expect(pctChange(100, NaN)).toBeNull()
  })
})
