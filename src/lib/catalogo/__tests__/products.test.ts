import { describe, it, expect } from 'vitest'
import { mergeCatalogoRows } from '../products'

describe('mergeCatalogoRows', () => {
  it('joins producto with supplier name and partida aggregate', () => {
    const productos = [
      { id: 1, cve_producto: 'P-1', descripcion: 'Resina PE', fraccion: '3901.20.01', fraccion_source: 'human_tito', fraccion_classified_at: '2026-01-01', cve_proveedor: 'PRV_1', pais_origen: 'US' },
    ]
    const proveedores = new Map([['PRV_1', 'Duratech LLC']])
    const agg = new Map([['RESINA PE', { count: 4, valor: 12000, lastTrafico: 'T-9', lastFecha: '2026-04-10' }]])
    const rows = mergeCatalogoRows(productos, proveedores, agg)
    expect(rows).toHaveLength(1)
    expect(rows[0].proveedor_nombre).toBe('Duratech LLC')
    expect(rows[0].veces_importado).toBe(4)
    expect(rows[0].valor_ytd_usd).toBe(12000)
    expect(rows[0].ultimo_cve_trafico).toBe('T-9')
    expect(rows[0].fraccion).toBe('3901.20.01')
  })

  it('handles missing fracción (stays null)', () => {
    const rows = mergeCatalogoRows(
      [{ id: 1, cve_producto: null, descripcion: 'Sin frac', fraccion: null, fraccion_source: null, fraccion_classified_at: null, cve_proveedor: null, pais_origen: null }],
      new Map(),
      new Map(),
    )
    expect(rows[0].fraccion).toBeNull()
    // Null cve_proveedor → resolver returns canonical "pendiente" label
    // (never a raw code or bare null — invariant from PRV sweep block BB).
    expect(rows[0].proveedor_nombre).toBe('Proveedor pendiente de identificar')
    expect(rows[0].veces_importado).toBe(0)
  })

  it('drops rows with empty descripcion', () => {
    const rows = mergeCatalogoRows(
      [
        { id: 1, cve_producto: null, descripcion: '', fraccion: null, fraccion_source: null, fraccion_classified_at: null, cve_proveedor: null, pais_origen: null },
        { id: 2, cve_producto: null, descripcion: '  ', fraccion: null, fraccion_source: null, fraccion_classified_at: null, cve_proveedor: null, pais_origen: null },
        { id: 3, cve_producto: null, descripcion: 'OK', fraccion: null, fraccion_source: null, fraccion_classified_at: null, cve_proveedor: null, pais_origen: null },
      ],
      new Map(),
      new Map(),
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].descripcion).toBe('OK')
  })

  it('unresolved PRV_ code surfaces as "Proveedor NNN" (never raw)', () => {
    const rows = mergeCatalogoRows(
      [{ id: 1, cve_producto: null, descripcion: 'X', fraccion: null, fraccion_source: null, fraccion_classified_at: null, cve_proveedor: 'PRV_UNKNOWN', pais_origen: null }],
      new Map([['PRV_1', 'Duratech']]),
      new Map(),
    )
    expect(rows[0].cve_proveedor).toBe('PRV_UNKNOWN')
    // PRV sweep invariant: never leak raw PRV_ codes — strip prefix to
    // a readable display string.
    expect(rows[0].proveedor_nombre).toBe('Proveedor UNKNOWN')
  })

  it('populates source_of_truth = globalpc_productos when no anexo overlay match', () => {
    const rows = mergeCatalogoRows(
      [{ id: 1, cve_producto: 'P-1', descripcion: 'X', fraccion: '3901.20.01', fraccion_source: null, fraccion_classified_at: null, cve_proveedor: null, pais_origen: null }],
      new Map(),
      new Map(),
    )
    expect(rows[0].source_of_truth).toBe('globalpc_productos')
    expect(rows[0].drift).toBe('only_in_globalpc')
  })

  it('populates source_of_truth = anexo24_parts with no drift when overlay matches', () => {
    const rows = mergeCatalogoRows(
      [{ id: 1, cve_producto: 'P-1', descripcion: 'Resina PE', fraccion: '3901.20.01', fraccion_source: null, fraccion_classified_at: null, cve_proveedor: null, pais_origen: 'USA' }],
      new Map(),
      new Map(),
      new Map([['P-1', { merchandise: 'Resina PE', fraccion: '3901.20.01', umt: 'KGM', pais_origen: 'USA' }]]),
    )
    expect(rows[0].source_of_truth).toBe('anexo24_parts')
    expect(rows[0].drift).toBe('none')
    expect(rows[0].merchandise).toBe('Resina PE')
  })

  it('classifies fraccion_mismatch when Formato 53 and GlobalPC disagree', () => {
    const rows = mergeCatalogoRows(
      [{ id: 1, cve_producto: 'P-2', descripcion: 'Acero', fraccion: '7318.15.99', fraccion_source: null, fraccion_classified_at: null, cve_proveedor: null, pais_origen: null }],
      new Map(),
      new Map(),
      new Map([['P-2', { merchandise: 'Acero', fraccion: '7318.16.00', umt: null, pais_origen: null }]]),
    )
    expect(rows[0].drift).toBe('fraccion_mismatch')
    // Canonical fracción wins
    expect(rows[0].fraccion).toBe('7318.16.00')
  })

  it('classifies description_mismatch when merchandise name differs', () => {
    const rows = mergeCatalogoRows(
      [{ id: 1, cve_producto: 'P-3', descripcion: 'POLYPROPYLENE TORNILLOS 3MM', fraccion: '7318.15.99', fraccion_source: null, fraccion_classified_at: null, cve_proveedor: null, pais_origen: null }],
      new Map(),
      new Map(),
      new Map([['P-3', { merchandise: 'TORNILLOS DE ACERO DE 19.05 MM', fraccion: '7318.15.99', umt: null, pais_origen: null }]]),
    )
    expect(rows[0].drift).toBe('description_mismatch')
    expect(rows[0].merchandise).toBe('TORNILLOS DE ACERO DE 19.05 MM')
    expect(rows[0].descripcion).toBe('POLYPROPYLENE TORNILLOS 3MM')  // raw stays
  })
})
