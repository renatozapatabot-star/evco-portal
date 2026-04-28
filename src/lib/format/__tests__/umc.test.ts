import { describe, it, expect } from 'vitest'
import { formatUmc, SAT_UMC_CATALOG } from '@/lib/format/umc'

describe('formatUmc — SAT Anexo 22 UMC code translation', () => {
  it('translates the EVCO-confirmed codes (1, 6, 8) to canonical names', () => {
    expect(formatUmc('1')).toBe('KILO')
    expect(formatUmc('6')).toBe('PIEZA')
    expect(formatUmc('8')).toBe('LITRO')
  })

  it('accepts numeric input as well as string', () => {
    expect(formatUmc(1)).toBe('KILO')
    expect(formatUmc(6)).toBe('PIEZA')
  })

  it('returns null for null / undefined / empty input', () => {
    expect(formatUmc(null)).toBeNull()
    expect(formatUmc(undefined)).toBeNull()
    expect(formatUmc('')).toBeNull()
    expect(formatUmc('   ')).toBeNull()
  })

  it('passes unknown codes through unchanged (never silently drops data)', () => {
    expect(formatUmc('999')).toBe('999')
    expect(formatUmc('KGM')).toBe('KGM')
  })

  it('catalog covers the standard SAT block (1-21)', () => {
    for (let i = 1; i <= 21; i++) {
      expect(SAT_UMC_CATALOG[String(i)]).toBeDefined()
    }
  })

  it('catalog values are uppercase ASCII names (consistent rendering)', () => {
    for (const [code, name] of Object.entries(SAT_UMC_CATALOG)) {
      expect(name).toBe(name.toUpperCase())
      expect(code).toMatch(/^\d+$/)
    }
  })
})
