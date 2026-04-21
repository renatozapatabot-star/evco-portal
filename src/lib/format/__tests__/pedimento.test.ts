import { describe, it, expect } from 'vitest'
import {
  formatPedimento, formatPedimentoCompact, isValidPedimento, parsePedimento,
} from '../pedimento'

describe('pedimento formatter', () => {
  it('formats a bare 15-digit string into SAT form', () => {
    expect(formatPedimento('262435966500275')).toBe('26 24 3596 6500275')
  })

  it('preserves a correctly-spaced pedimento', () => {
    expect(formatPedimento('26 24 3596 6500275')).toBe('26 24 3596 6500275')
  })

  it('recovers from inconsistent whitespace', () => {
    expect(formatPedimento('26  24   3596 6500275')).toBe('26 24 3596 6500275')
  })

  it('returns fallback for invalid input', () => {
    expect(formatPedimento('abc')).toBe('—')
    expect(formatPedimento('')).toBe('—')
    expect(formatPedimento(null)).toBe('—')
    expect(formatPedimento(undefined)).toBe('—')
  })

  it('accepts a custom fallback', () => {
    expect(formatPedimento(null, 'Sin pedimento')).toBe('Sin pedimento')
  })

  it('compact form shows patente-consecutivo', () => {
    expect(formatPedimentoCompact('262435966500275')).toBe('3596-6500275')
  })

  it('validator recognizes valid + invalid input', () => {
    expect(isValidPedimento('26 24 3596 6500275')).toBe(true)
    expect(isValidPedimento('262435966500275')).toBe(true)
    expect(isValidPedimento('abc')).toBe(false)
    expect(isValidPedimento(null)).toBe(false)
  })

  it('parsePedimento returns segments', () => {
    expect(parsePedimento('26 24 3596 6500275')).toEqual({
      dd: '26', ad: '24', pppp: '3596', sssssss: '6500275',
    })
  })
})
