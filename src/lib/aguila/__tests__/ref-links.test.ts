import { describe, it, expect } from 'vitest'
import {
  traficoHref,
  fraccionHref,
  pedimentoHref,
  supplierHref,
} from '../ref-links'

describe('ref-links', () => {
  describe('traficoHref', () => {
    it('routes a canonical Y-id to /embarques/[id]', () => {
      expect(traficoHref('Y-1234')).toBe('/embarques/Y-1234')
    })

    it('escapes reserved URL chars in the id', () => {
      expect(traficoHref('Y 1234')).toBe('/embarques/Y%201234')
    })
  })

  describe('fraccionHref', () => {
    it('routes a canonical fracción to /catalogo/fraccion/[code]', () => {
      expect(fraccionHref('3901.20.01')).toBe('/catalogo/fraccion/3901.20.01')
    })

    it('dots and digits survive the round-trip (invariant #8)', () => {
      const href = fraccionHref('8411.12.99')
      expect(href).toContain('8411.12.99')
      expect(href).not.toContain('%2E') // dots must not be percent-encoded
    })
  })

  describe('pedimentoHref', () => {
    it('routes a spaced pedimento to /pedimentos?q=<encoded>', () => {
      expect(pedimentoHref('26 24 3596 6500441')).toBe(
        '/pedimentos?q=26%2024%203596%206500441',
      )
    })

    it('preserves the space-preserving format (invariant #7 round-trips)', () => {
      const href = pedimentoHref('26 24 3596 6500441')
      const q = new URLSearchParams(href.split('?')[1]).get('q')
      expect(q).toBe('26 24 3596 6500441')
    })
  })

  describe('supplierHref', () => {
    it('routes an RFC to /catalogo?q=<rfc>', () => {
      expect(supplierHref('MELA850512H21')).toBe('/catalogo?q=MELA850512H21')
    })

    it('routes a PRV_ code to /catalogo?q=<code>', () => {
      expect(supplierHref('PRV_1234')).toBe('/catalogo?q=PRV_1234')
    })

    it('escapes reserved characters in the term', () => {
      expect(supplierHref('A & B S.A.')).toBe('/catalogo?q=A%20%26%20B%20S.A.')
    })
  })
})
