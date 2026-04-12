/**
 * Block 4 · Supplier Doc Solicitation Polish — catalog unit tests.
 */
import { describe, expect, it } from 'vitest'
import {
  ALL_DOCUMENT_TYPES,
  CATALOG_SIZE,
  DOCUMENT_TYPE_CATEGORIES,
  categoryForDocCode,
  getDocumentTypeByCode,
  getDocumentTypesByCategory,
  getRequiredDocumentTypes,
  labelForDocCode,
  mapLegacyDocType,
} from '@/lib/document-types'
import { getRequiredDocCodesByRegimen } from '@/lib/doc-requirements'

describe('document-types catalog', () => {
  it('exposes exactly 50 entries across 9 categories', () => {
    expect(ALL_DOCUMENT_TYPES).toHaveLength(CATALOG_SIZE)
    expect(Object.keys(DOCUMENT_TYPE_CATEGORIES)).toHaveLength(9)
  })

  it('every entry has unique code', () => {
    const codes = ALL_DOCUMENT_TYPES.map((e) => e.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('maps every legacy DocType to a catalog code', () => {
    const legacy = [
      'factura',
      'packing_list',
      'bill_of_lading',
      'carta_porte',
      'certificado_origen',
      'pedimento',
      'rfc_constancia',
      'encargo_conferido',
      'cove',
      'mve',
    ] as const
    for (const l of legacy) {
      const code = mapLegacyDocType(l)
      const entry = getDocumentTypeByCode(code)
      expect(entry, `catalog missing for legacy ${l}`).toBeDefined()
      expect(entry?.legacyAlias).toBe(l)
    }
  })

  it('getRequiredDocumentTypes returns only required=true entries', () => {
    const req = getRequiredDocumentTypes()
    expect(req.length).toBeGreaterThan(0)
    for (const r of req) expect(r.required).toBe(true)
  })

  it('getDocumentTypesByCategory returns category entries', () => {
    const com = getDocumentTypesByCategory('COMERCIAL')
    expect(com.length).toBeGreaterThan(0)
    for (const e of com) expect(e.category).toBe('COMERCIAL')
  })

  it('labelForDocCode honors custom name for otro', () => {
    expect(labelForDocCode('otro', 'Carta del banco')).toBe('Carta del banco')
    expect(labelForDocCode('factura_comercial')).toBe('Factura comercial')
    expect(labelForDocCode('unknown_code_xyz')).toBeTruthy()
  })

  it('categoryForDocCode falls back to OTROS for unknown codes', () => {
    expect(categoryForDocCode('unknown_xyz')).toBe('OTROS')
    expect(categoryForDocCode('factura_comercial')).toBe('COMERCIAL')
  })

  it('getRequiredDocCodesByRegimen returns catalog codes for A1', () => {
    const codes = getRequiredDocCodesByRegimen('A1')
    expect(codes.length).toBeGreaterThan(0)
    for (const c of codes) expect(getDocumentTypeByCode(c)).toBeDefined()
  })

  it('returns empty for unknown régimen', () => {
    expect(getRequiredDocCodesByRegimen('UNKNOWN_XYZ')).toEqual([])
    expect(getRequiredDocCodesByRegimen(null)).toEqual([])
  })
})
