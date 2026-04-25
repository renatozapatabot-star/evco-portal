import { describe, it, expect } from 'vitest'
import { formatDateDMY, formatNumber, formatCurrencyUSD } from '../format'

describe('formatDateDMY', () => {
  it('formats ISO date as DD/MM/YYYY', () => {
    expect(formatDateDMY('2026-04-25')).toBe('25/04/2026')
  })

  it('strips T-suffixed timestamps', () => {
    expect(formatDateDMY('2026-01-03T14:30:00Z')).toBe('03/01/2026')
  })

  it('returns empty string for null / undefined / empty', () => {
    expect(formatDateDMY(null)).toBe('')
    expect(formatDateDMY(undefined)).toBe('')
    expect(formatDateDMY('')).toBe('')
  })

  it('returns empty string for malformed input (no throw)', () => {
    expect(formatDateDMY('not-a-date')).toBe('')
    expect(formatDateDMY('2026/04/25')).toBe('')
    expect(formatDateDMY('25-04-2026')).toBe('')
  })
})

describe('formatNumber', () => {
  it('formats integers with es-MX thousand separators', () => {
    expect(formatNumber(1234)).toBe('1,234')
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  it('truncates to integer by default', () => {
    expect(formatNumber(1234.789)).toBe('1,234')
  })

  it('honors fixed decimals when requested', () => {
    expect(formatNumber(1234.5, { decimals: 2 })).toBe('1,234.50')
    expect(formatNumber(1234, { decimals: 2 })).toBe('1,234.00')
  })

  it('returns empty string for null / undefined / NaN', () => {
    expect(formatNumber(null)).toBe('')
    expect(formatNumber(undefined)).toBe('')
    expect(formatNumber(NaN)).toBe('')
  })

  it('handles zero correctly (renders "0", not empty)', () => {
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(0, { decimals: 2 })).toBe('0.00')
  })
})

describe('formatCurrencyUSD', () => {
  it('formats as $X,XXX.XX USD with en-US separators', () => {
    expect(formatCurrencyUSD(1234.5)).toBe('$1,234.50 USD')
    expect(formatCurrencyUSD(276603.31)).toBe('$276,603.31 USD')
  })

  it('always uses 2 decimals', () => {
    expect(formatCurrencyUSD(1000)).toBe('$1,000.00 USD')
  })

  it('returns empty string for null / undefined / NaN', () => {
    expect(formatCurrencyUSD(null)).toBe('')
    expect(formatCurrencyUSD(undefined)).toBe('')
    expect(formatCurrencyUSD(NaN)).toBe('')
  })

  it('handles zero', () => {
    expect(formatCurrencyUSD(0)).toBe('$0.00 USD')
  })

  it('handles large numbers with comma grouping', () => {
    expect(formatCurrencyUSD(1234567.89)).toBe('$1,234,567.89 USD')
  })
})
