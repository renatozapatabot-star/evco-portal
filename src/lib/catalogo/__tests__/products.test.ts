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
    expect(rows[0].proveedor_nombre).toBeNull()
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

  it('supplier map miss leaves proveedor_nombre null', () => {
    const rows = mergeCatalogoRows(
      [{ id: 1, cve_producto: null, descripcion: 'X', fraccion: null, fraccion_source: null, fraccion_classified_at: null, cve_proveedor: 'PRV_UNKNOWN', pais_origen: null }],
      new Map([['PRV_1', 'Duratech']]),
      new Map(),
    )
    expect(rows[0].cve_proveedor).toBe('PRV_UNKNOWN')
    expect(rows[0].proveedor_nombre).toBeNull()
  })
})
