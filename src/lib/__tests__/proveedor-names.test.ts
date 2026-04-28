import { describe, it, expect } from 'vitest'
import { resolveProveedorName, isTenantPlaceholderName } from '../proveedor-names'

describe('resolveProveedorName', () => {
  it('returns canonical name when present', () => {
    expect(resolveProveedorName('PRV_526', 'ENTEC POLYMERS LLC'))
      .toBe('ENTEC POLYMERS LLC')
  })

  it('Cluster K: never leaks "PROVEEDOR DE <tenant>" to the UI', () => {
    // GlobalPC stores generic placeholder proveedores with nombre like
    // "PROVEEDOR DE WORLDTECH, S.A. DE C.V." — these must NOT surface
    // to the client. Resolver must coalesce to the calm placeholder.
    expect(resolveProveedorName('PRV_GENERICO', 'PROVEEDOR DE WORLDTECH, S.A. DE C.V.'))
      .toBe('Proveedor pendiente de identificar')
    expect(resolveProveedorName('PRV_GENERICO_PR', 'PROVEEDOR DE PROMOTORA MEXICANA,S.A. DE C.V.'))
      .toBe('Proveedor pendiente de identificar')
    // Case-insensitive
    expect(resolveProveedorName('PRV_X', 'proveedor de algo'))
      .toBe('Proveedor pendiente de identificar')
  })

  it('PRV_ codes without canonical name strip prefix', () => {
    expect(resolveProveedorName('PRV_526', null))
      .toBe('Proveedor 526')
  })

  it('null/empty code returns calm placeholder', () => {
    expect(resolveProveedorName(null, null)).toBe('Proveedor pendiente de identificar')
    expect(resolveProveedorName('', '')).toBe('Proveedor pendiente de identificar')
    expect(resolveProveedorName('   ', '')).toBe('Proveedor pendiente de identificar')
  })

  it('a real-looking string passes through (length > 5, non-numeric, not PRV_)', () => {
    expect(resolveProveedorName('Acme Corp', null)).toBe('Acme Corp')
  })
})

describe('isTenantPlaceholderName', () => {
  it.each([
    'PROVEEDOR DE EVCO PLASTICS DE MEXICO',
    'Proveedor De Worldtech',
    'PROVEEDOR DE   PROMOTORA MEXICANA',
    'proveedor de algo',
  ])('detects placeholder pattern: %s', (input) => {
    expect(isTenantPlaceholderName(input)).toBe(true)
  })

  it.each([
    'ENTEC POLYMERS LLC',
    'Acme Corp',
    'WORLDTECH SA DE CV',
    null,
    undefined,
    '',
  ])('returns false for non-placeholders: %s', (input) => {
    expect(isTenantPlaceholderName(input)).toBe(false)
  })
})
