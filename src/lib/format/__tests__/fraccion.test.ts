import { describe, expect, it } from 'vitest'

import { formatFraccion } from '../fraccion'

describe('formatFraccion', () => {
  describe('canonical form', () => {
    it('returns already-dotted 8-digit fracción unchanged', () => {
      expect(formatFraccion('3901.20.01')).toBe('3901.20.01')
    })

    it('returns already-dotted 10-digit NICO fracción unchanged', () => {
      expect(formatFraccion('3901.20.01.99')).toBe('3901.20.01.99')
    })

    it('formats bare 8-digit into SAT form', () => {
      expect(formatFraccion('39012001')).toBe('3901.20.01')
    })

    it('formats bare 10-digit NICO into SAT form', () => {
      expect(formatFraccion('3901200199')).toBe('3901.20.01.99')
    })

    it('trims whitespace before parsing', () => {
      expect(formatFraccion('  3901.20.01  ')).toBe('3901.20.01')
      expect(formatFraccion('\t39012001\n')).toBe('3901.20.01')
    })
  })

  describe('null-safe inputs', () => {
    it('returns null for null', () => {
      expect(formatFraccion(null)).toBeNull()
    })

    it('returns null for undefined', () => {
      expect(formatFraccion(undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(formatFraccion('')).toBeNull()
    })

    it('returns null for whitespace-only string', () => {
      expect(formatFraccion('   ')).toBeNull()
    })
  })

  describe('invalid shapes', () => {
    it('returns null for letters', () => {
      expect(formatFraccion('abc.def.ghi')).toBeNull()
    })

    it('returns null for partially alphabetic input', () => {
      expect(formatFraccion('3901.X0.01')).toBeNull()
    })

    it('returns null for too-short bare digits', () => {
      expect(formatFraccion('3901201')).toBeNull()
    })

    it('returns null for 9-digit input (no valid split)', () => {
      expect(formatFraccion('390120019')).toBeNull()
    })

    it('returns null for 11-digit input', () => {
      expect(formatFraccion('39012001999')).toBeNull()
    })

    it('returns null for mis-placed dots', () => {
      expect(formatFraccion('390.12.00.1')).toBeNull()
      expect(formatFraccion('39.0120.01')).toBeNull()
    })
  })

  describe('core-invariant #8 regression guards', () => {
    it('never strips dots — dotted input round-trips identically', () => {
      const inputs = ['3901.20.01', '3901.20.01.99', '8708.99.01']
      for (const input of inputs) {
        expect(formatFraccion(input)).toBe(input)
      }
    })

    it('NICO preservation — 10-digit form is not truncated to 8', () => {
      expect(formatFraccion('3901.20.01.99')).not.toBe('3901.20.01')
      expect(formatFraccion('3901200199')).not.toBe('3901.20.01')
    })
  })
})
