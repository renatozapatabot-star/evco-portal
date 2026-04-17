import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import {
  resolveMerchName,
  resolveFraction,
  resolvePartNumber,
  computeDrift,
  isAnexo24CanonicalEnabled,
} from '../reference/anexo24'

/**
 * Canonical reference helpers — verify the feature-flag contract:
 * when the flag is off, canonical fields are ignored and legacy
 * descripcion/fraccion win. When the flag is on, canonical wins with
 * a graceful fallback.
 */

describe('resolveMerchName', () => {
  const original = process.env.USE_ANEXO24_CANONICAL

  afterEach(() => {
    if (original === undefined) delete process.env.USE_ANEXO24_CANONICAL
    else process.env.USE_ANEXO24_CANONICAL = original
  })

  it('returns legacy descripcion when flag is off', () => {
    process.env.USE_ANEXO24_CANONICAL = 'false'
    const name = resolveMerchName({
      cve_producto: 'EVC-001',
      anexo24_merchandise_name: 'POLYPROPYLENE BEADS — OFFICIAL',
      descripcion: 'PP BEADS',
    })
    expect(name).toBe('PP BEADS')
  })

  it('returns canonical name when flag is on and value present', () => {
    process.env.USE_ANEXO24_CANONICAL = 'true'
    const name = resolveMerchName({
      cve_producto: 'EVC-001',
      anexo24_merchandise_name: 'POLYPROPYLENE BEADS — OFFICIAL',
      descripcion: 'PP BEADS',
    })
    expect(name).toBe('POLYPROPYLENE BEADS — OFFICIAL')
  })

  it('falls back to descripcion when canonical missing', () => {
    process.env.USE_ANEXO24_CANONICAL = 'true'
    const name = resolveMerchName({
      cve_producto: 'EVC-001',
      anexo24_merchandise_name: null,
      descripcion: 'PP BEADS',
    })
    expect(name).toBe('PP BEADS')
  })

  it('falls back to cve_producto when both names missing', () => {
    const name = resolveMerchName({ cve_producto: 'EVC-999' })
    expect(name).toBe('EVC-999')
  })

  it('returns "Sin descripción" when no source has data', () => {
    const name = resolveMerchName({})
    expect(name).toBe('Sin descripción')
  })

  it('trims whitespace from canonical name', () => {
    process.env.USE_ANEXO24_CANONICAL = 'true'
    const name = resolveMerchName({
      anexo24_merchandise_name: '  POLYPROPYLENE BEADS  ',
      descripcion: 'PP BEADS',
    })
    expect(name).toBe('POLYPROPYLENE BEADS')
  })
})

describe('resolveFraction', () => {
  const original = process.env.USE_ANEXO24_CANONICAL
  afterEach(() => {
    if (original === undefined) delete process.env.USE_ANEXO24_CANONICAL
    else process.env.USE_ANEXO24_CANONICAL = original
  })

  it('returns formatted fraction when canonical is present and flag on', () => {
    process.env.USE_ANEXO24_CANONICAL = 'true'
    expect(resolveFraction({ anexo24_fraccion: '3901.20.01', fraccion: '3901.20.00' })).toBe('3901.20.01')
  })

  it('falls back to legacy fraccion when flag off', () => {
    process.env.USE_ANEXO24_CANONICAL = 'false'
    expect(resolveFraction({ anexo24_fraccion: '3901.20.01', fraccion: '3901.20.00' })).toBe('3901.20.00')
  })

  it('tries fraccion_arancelaria (partida field) when fraccion absent', () => {
    expect(resolveFraction({ fraccion_arancelaria: '39012000' })).toBe('3901.20.00')
  })

  it('returns null when no source has fraction', () => {
    expect(resolveFraction({})).toBeNull()
  })
})

describe('resolvePartNumber', () => {
  it('returns trimmed cve_producto', () => {
    expect(resolvePartNumber({ cve_producto: '  EVC-001  ' })).toBe('EVC-001')
  })

  it('returns null for empty string', () => {
    expect(resolvePartNumber({ cve_producto: '' })).toBeNull()
  })

  it('returns null for whitespace-only', () => {
    expect(resolvePartNumber({ cve_producto: '   ' })).toBeNull()
  })

  it('returns null when missing', () => {
    expect(resolvePartNumber({})).toBeNull()
  })
})

describe('computeDrift', () => {
  it('returns no drift when strings match exactly', () => {
    expect(computeDrift('POLYPROPYLENE BEADS', 'POLYPROPYLENE BEADS')).toEqual({ is_drift: false, severity: 'none' })
  })

  it('returns no drift when case differs (compared case-insensitively)', () => {
    expect(computeDrift('Polypropylene Beads', 'POLYPROPYLENE BEADS')).toEqual({ is_drift: false, severity: 'none' })
  })

  it('returns no drift when one side is empty', () => {
    expect(computeDrift('', 'POLYPROPYLENE')).toEqual({ is_drift: false, severity: 'none' })
    expect(computeDrift('POLYPROPYLENE', null)).toEqual({ is_drift: false, severity: 'none' })
  })

  it('returns minor drift when only punctuation differs', () => {
    expect(computeDrift('PP BEADS - GRADE A', 'PP BEADS, GRADE A')).toEqual({ is_drift: true, severity: 'minor' })
  })

  it('returns major drift when genuinely different strings', () => {
    expect(computeDrift('POLYPROPYLENE BEADS', 'POLYETHYLENE PELLETS')).toEqual({ is_drift: true, severity: 'major' })
  })
})

describe('isAnexo24CanonicalEnabled', () => {
  const original = process.env.USE_ANEXO24_CANONICAL
  beforeEach(() => {
    delete process.env.USE_ANEXO24_CANONICAL
  })
  afterEach(() => {
    if (original === undefined) delete process.env.USE_ANEXO24_CANONICAL
    else process.env.USE_ANEXO24_CANONICAL = original
  })

  it('defaults to false when env unset', () => {
    expect(isAnexo24CanonicalEnabled()).toBe(false)
  })

  it('returns true only for exact "true" string', () => {
    process.env.USE_ANEXO24_CANONICAL = 'true'
    expect(isAnexo24CanonicalEnabled()).toBe(true)
  })

  it('returns false for other truthy strings', () => {
    process.env.USE_ANEXO24_CANONICAL = '1'
    expect(isAnexo24CanonicalEnabled()).toBe(false)
    process.env.USE_ANEXO24_CANONICAL = 'TRUE'
    expect(isAnexo24CanonicalEnabled()).toBe(false)
  })
})
