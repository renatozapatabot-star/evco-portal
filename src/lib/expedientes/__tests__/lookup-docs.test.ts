import { describe, it, expect } from 'vitest'
import { lookupDocsForTrafico, type DocFile } from '../lookup-docs'

function doc(id: string, type: string | null = 'pedimento_detallado'): DocFile {
  return {
    id,
    doc_type: type,
    file_name: `${id}.pdf`,
    file_url: `https://example.com/${id}.pdf`,
    uploaded_at: '2026-04-20T10:00:00Z',
  }
}

describe('lookupDocsForTrafico', () => {
  it('returns docs filed under the trafico slug (primary key)', () => {
    const map = new Map<string, DocFile[]>([
      ['9254-Y4568', [doc('a'), doc('b')]],
    ])
    const result = lookupDocsForTrafico(map, { trafico: '9254-Y4568', pedimento: '6500313' })
    expect(result.map((d) => d.id)).toEqual(['a', 'b'])
  })

  it('returns docs filed under the pedimento number when trafico-shape misses', () => {
    // Regression: the SEV-2 the audit caught — list page rendered 0/6
    // for traficos whose docs were filed under the numeric pedimento.
    const map = new Map<string, DocFile[]>([
      ['6500313', [doc('a'), doc('b')]],
    ])
    const result = lookupDocsForTrafico(map, { trafico: '9254-Y4568', pedimento: '6500313' })
    expect(result.map((d) => d.id)).toEqual(['a', 'b'])
  })

  it('unions docs under both keys, deduped by id', () => {
    const map = new Map<string, DocFile[]>([
      ['9254-Y4568', [doc('a'), doc('shared')]],
      ['6500313', [doc('shared'), doc('c')]],
    ])
    const result = lookupDocsForTrafico(map, { trafico: '9254-Y4568', pedimento: '6500313' })
    // 'shared' appears once; 'a' first (slug), then 'c' (pedimento)
    expect(result.map((d) => d.id)).toEqual(['a', 'shared', 'c'])
  })

  it('returns empty array when neither key has docs', () => {
    const map = new Map<string, DocFile[]>()
    const result = lookupDocsForTrafico(map, { trafico: '9254-Y4568', pedimento: '6500313' })
    expect(result).toEqual([])
  })

  it('skips fallback when pedimento is null', () => {
    const map = new Map<string, DocFile[]>([
      ['', [doc('would-collide-on-empty-key')]],
    ])
    const result = lookupDocsForTrafico(map, { trafico: '9254-Y4568', pedimento: null })
    // Should NOT match the empty-key bucket — null pedimento skips fallback.
    expect(result).toEqual([])
  })

  it('skips fallback when pedimento is undefined', () => {
    const map = new Map<string, DocFile[]>([
      ['', [doc('would-collide-on-empty-key')]],
    ])
    const result = lookupDocsForTrafico(map, { trafico: '9254-Y4568', pedimento: undefined })
    expect(result).toEqual([])
  })

  it('skips fallback when pedimento is empty string', () => {
    const map = new Map<string, DocFile[]>([
      ['', [doc('would-collide-on-empty-key')]],
    ])
    const result = lookupDocsForTrafico(map, { trafico: '9254-Y4568', pedimento: '' })
    expect(result).toEqual([])
  })

  it('skips fallback when pedimento is whitespace', () => {
    const map = new Map<string, DocFile[]>([
      ['   ', [doc('would-collide-on-whitespace')]],
    ])
    const result = lookupDocsForTrafico(map, { trafico: '9254-Y4568', pedimento: '   ' })
    expect(result).toEqual([])
  })

  it('does not double-fetch when pedimento equals trafico slug', () => {
    const map = new Map<string, DocFile[]>([
      ['9254-Y4568', [doc('a')]],
    ])
    // Pedimento and slug match — fallback should be skipped.
    const result = lookupDocsForTrafico(map, { trafico: '9254-Y4568', pedimento: '9254-Y4568' })
    expect(result.map((d) => d.id)).toEqual(['a'])
  })

  it('trims whitespace from pedimento before matching', () => {
    const map = new Map<string, DocFile[]>([
      ['6500313', [doc('a')]],
    ])
    const result = lookupDocsForTrafico(map, { trafico: '9254-Y4568', pedimento: '  6500313  ' })
    expect(result.map((d) => d.id)).toEqual(['a'])
  })

  it('skips docs without an id (defensive)', () => {
    const map = new Map<string, DocFile[]>([
      ['9254-Y4568', [
        { id: '', doc_type: null, file_name: null, file_url: null, uploaded_at: null },
        doc('a'),
      ]],
    ])
    const result = lookupDocsForTrafico(map, { trafico: '9254-Y4568', pedimento: null })
    expect(result.map((d) => d.id)).toEqual(['a'])
  })

  it('regression: 9254-Y4568 example from the audit returns docs from numeric shape', () => {
    // The audit identified expediente_documentos as dual-keyed: 98.4%
    // trafico shape, 0.024% numeric. For records like Y4568 whose docs
    // happen to be filed under the numeric pedimento '6500313', the
    // list page used to render 0/6. After this fix, the docs surface.
    const map = new Map<string, DocFile[]>([
      // Note: NO entry for '9254-Y4568' — the trafico-shape lookup misses.
      ['6500313', [
        doc('doc-1', 'pedimento_detallado'),
        doc('doc-2', 'factura_comercial'),
        doc('doc-3', 'packing_list'),
      ]],
    ])
    const result = lookupDocsForTrafico(map, { trafico: '9254-Y4568', pedimento: '6500313' })
    expect(result).toHaveLength(3)
    expect(result.map((d) => d.doc_type)).toEqual([
      'pedimento_detallado',
      'factura_comercial',
      'packing_list',
    ])
  })
})
