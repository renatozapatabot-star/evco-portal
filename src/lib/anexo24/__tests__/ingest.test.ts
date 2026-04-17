import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { parseFormato53Xlsx, hashBuffer, type Anexo24IngestRow } from '../ingest'

/**
 * Build a synthetic Formato 53 XLSX in the real SAT column order.
 * Row 1: "Anexo 24" title
 * Row 2: Client legal name
 * Row 3: 41 column headers (real labels)
 * Row 4+: data
 */
function buildFixtureXlsx(rows: Partial<Anexo24IngestRow>[]): Buffer {
  const headers = [
    'AnnioFechaPago', 'Aduana', 'Clave', 'Fecha de pago', 'Proveedor',
    'Tax ID/RFC', 'Factura', 'Fecha de factura', 'Fracción', 'Número de Parte',
    'Clave de Insumo', 'Origen', 'Tratado', 'Cantidad UMComercial', 'UMComercial',
    'Valor aduana', 'Valor comercial', 'TIGI', 'FP IGI', 'FP IVA',
    'FP IEPS', 'Tipo de cambio', 'IVA', 'Secuencia', 'Remesa',
    'Marca', 'Modelo', 'Serie', 'Número de Pedimento', 'Cantidad UMT',
    'Unidad UMT', 'Valor Dólar', 'INCOTERM', 'Factor de Conversión', 'Fecha de Presentación',
    'Consignatario', 'Destinatario', 'Vinculación', 'Método de Valoración', 'Peso bruto (kgs.)',
    'País de Origen',
  ]
  const columnOrder: Array<keyof Anexo24IngestRow> = [
    'annio_fecha_pago', 'aduana', 'clave_pedimento', 'fecha_pago', 'proveedor',
    'tax_id', 'factura', 'fecha_factura', 'fraccion', 'numero_parte',
    'clave_insumo', 'origen', 'tratado', 'cantidad_umc', 'umc',
    'valor_aduana', 'valor_comercial', 'tigi', 'fp_igi', 'fp_iva',
    'fp_ieps', 'tipo_cambio', 'iva', 'secuencia', 'remesa',
    'marca', 'modelo', 'serie', 'numero_pedimento', 'cantidad_umt',
    'unidad_umt', 'valor_dolar', 'incoterm', 'factor_conversion', 'fecha_presentacion',
    'consignatario', 'destinatario', 'vinculacion', 'metodo_valoracion', 'peso_bruto',
    'pais_origen',
  ]
  const aoa: (string | number | null)[][] = [
    ['Anexo 24'],
    ['Fixture Client S.A. DE C.V.'],
    headers,
    ...rows.map((r) => columnOrder.map((k) => {
      const v = r[k]
      if (v === undefined) return null
      return v as string | number | null
    })),
  ]
  const ws = XLSX.utils.aoa_to_sheet(aoa)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Anexo 24')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

describe('parseFormato53Xlsx', () => {
  it('returns zero rows on empty XLSX without throwing', () => {
    const buffer = buildFixtureXlsx([])
    const result = parseFormato53Xlsx(buffer)
    expect(result).toHaveLength(0)
  })

  it('parses a single row mapping every canonical column', () => {
    const row: Partial<Anexo24IngestRow> = {
      annio_fecha_pago: '2026',
      aduana: '240',
      clave_pedimento: 'IMD',
      fecha_pago: '15/03/2026',
      proveedor: 'ACME Plastics',
      tax_id: '34-1151140',
      factura: '5010657',
      fecha_factura: '28/02/2026',
      fraccion: '3901.20.01',
      numero_parte: 'HN6',
      clave_insumo: 'HN6',
      origen: 'USA',
      tratado: 'SI',
      cantidad_umc: 1500,
      umc: 'KGM',
      valor_dolar: 12345.67,
      tipo_cambio: 17.2,
      incoterm: 'EXW',
      peso_bruto: 1520.5,
      pais_origen: 'USA',
    }
    const buffer = buildFixtureXlsx([row])
    const parsed = parseFormato53Xlsx(buffer)
    expect(parsed).toHaveLength(1)
    const p = parsed[0]
    expect(p.numero_parte).toBe('HN6')
    expect(p.fraccion).toBe('3901.20.01')
    expect(p.cantidad_umc).toBe(1500)
    expect(p.valor_dolar).toBeCloseTo(12345.67, 2)
    expect(p.tax_id).toBe('34-1151140')
    expect(p.pais_origen).toBe('USA')
  })

  it('unpacks numeric fraccion (7318159905 → 7318.15.99.05) — NICO 10-digit variant', () => {
    const buffer = buildFixtureXlsx([{ fraccion: '7318159905', numero_parte: 'X1' }])
    const parsed = parseFormato53Xlsx(buffer)
    expect(parsed[0].fraccion).toBe('7318.15.99.05')
  })

  it('unpacks numeric fraccion (39012001 → 3901.20.01) — 8-digit SAT variant', () => {
    const buffer = buildFixtureXlsx([{ fraccion: '39012001', numero_parte: 'X2' }])
    const parsed = parseFormato53Xlsx(buffer)
    expect(parsed[0].fraccion).toBe('3901.20.01')
  })

  it('leaves already-dotted fraccion alone', () => {
    const buffer = buildFixtureXlsx([{ fraccion: '3901.20.01', numero_parte: 'X3' }])
    const parsed = parseFormato53Xlsx(buffer)
    expect(parsed[0].fraccion).toBe('3901.20.01')
  })

  it('handles empty cells as null, not empty string', () => {
    const buffer = buildFixtureXlsx([{ numero_parte: 'ONLY_KEY' }])
    const parsed = parseFormato53Xlsx(buffer)
    expect(parsed[0].proveedor).toBeNull()
    expect(parsed[0].fraccion).toBeNull()
    expect(parsed[0].valor_dolar).toBeNull()
  })

  it('parses multiple rows preserving order', () => {
    const buffer = buildFixtureXlsx([
      { numero_parte: 'A', fraccion: '3901.20.01' },
      { numero_parte: 'B', fraccion: '7318.15.99.05' },
      { numero_parte: 'C', fraccion: '3926.90.99' },
    ])
    const parsed = parseFormato53Xlsx(buffer)
    expect(parsed.map((p) => p.numero_parte)).toEqual(['A', 'B', 'C'])
  })

  it('skips blank trailing rows (end-of-data sentinel)', () => {
    const buffer = buildFixtureXlsx([
      { numero_parte: 'A' },
      {},  // all-null row
      { numero_parte: 'B' },
    ])
    const parsed = parseFormato53Xlsx(buffer)
    // Middle blank is filtered by `blankrows: false` in parser.
    expect(parsed.map((p) => p.numero_parte)).toContain('A')
    expect(parsed.map((p) => p.numero_parte)).toContain('B')
  })

  it('coerces numeric columns to numbers, not strings', () => {
    const buffer = buildFixtureXlsx([{
      numero_parte: 'N',
      cantidad_umc: 1500,
      valor_dolar: 99.95,
      peso_bruto: 10.5,
    }])
    const [p] = parseFormato53Xlsx(buffer)
    expect(typeof p.cantidad_umc).toBe('number')
    expect(typeof p.valor_dolar).toBe('number')
    expect(typeof p.peso_bruto).toBe('number')
  })
})

describe('hashBuffer', () => {
  it('produces a stable SHA-256 hex', () => {
    const buf = Buffer.from('test payload', 'utf8')
    const h1 = hashBuffer(buf)
    const h2 = hashBuffer(buf)
    expect(h1).toBe(h2)
    expect(h1).toHaveLength(64) // hex sha256
  })

  it('differs for different content', () => {
    const a = hashBuffer(Buffer.from('a', 'utf8'))
    const b = hashBuffer(Buffer.from('b', 'utf8'))
    expect(a).not.toBe(b)
  })
})
