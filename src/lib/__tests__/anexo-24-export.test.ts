/**
 * CRUZ · Anexo 24 / Formato 53 export tests.
 *
 * Verifies the 41-column SAT-canonical shape: Excel header matches the
 * reference file order, PDF renders, storage path stays tenant-scoped.
 */
import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import {
  generateAnexo24,
  buildAnexo24StoragePath,
  ANEXO_24_COLUMNS,
  type Anexo24Data,
  type Anexo24Row,
} from '@/lib/anexo-24-export'

function makeRow(over: Partial<Anexo24Row> = {}): Anexo24Row {
  return {
    annio_fecha_pago: '2026',
    aduana: '240',
    clave_pedimento: 'IMD',
    fecha_pago: '15/03/2026',
    proveedor: 'ACME Plastics Co',
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
    valor_aduana: 205432.50,
    valor_comercial: 205432.50,
    tigi: null,
    fp_igi: null,
    fp_iva: null,
    fp_ieps: null,
    tipo_cambio: 17.2,
    iva: null,
    secuencia: 1,
    remesa: null,
    marca: null,
    modelo: null,
    serie: null,
    numero_pedimento: '26 24 3596 6500441',
    cantidad_umt: 1500,
    unidad_umt: 'KGM',
    valor_dolar: 12345.67,
    incoterm: 'EXW',
    factor_conversion: 1,
    fecha_presentacion: '13/03/2026',
    consignatario: null,
    destinatario: null,
    vinculacion: null,
    metodo_valoracion: null,
    peso_bruto: 1520.5,
    pais_origen: 'USA',
    tmec: true,
    ...over,
  }
}

function makeData(rows: Anexo24Row[] = [makeRow()]): Anexo24Data {
  return {
    meta: {
      company_id: 'TEST',
      cliente_nombre: 'Cliente de Prueba',
      date_from: '2026-01-01',
      date_to: '2026-03-31',
      generado_en: '2026-04-17T12:00:00Z',
      generado_por: 'TEST:admin',
      patente: '3596',
      aduana: '240',
    },
    rows,
  }
}

describe('generateAnexo24 (41-column Formato 53)', () => {
  it('Excel header matches the SAT-canonical column order and labels', async () => {
    const { excel } = await generateAnexo24(makeData([makeRow(), makeRow({ numero_parte: 'N2' })]))
    expect(Buffer.isBuffer(excel)).toBe(true)

    const wb = XLSX.read(excel, { type: 'buffer' })
    expect(wb.SheetNames).toContain('Anexo 24')
    const ws = wb.Sheets['Anexo 24']!
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]

    // Sheet starts with two identity rows + spacer + header row.
    expect(String(aoa[0]?.[0] ?? '')).toBe('Anexo 24')
    expect(String(aoa[1]?.[0] ?? '')).toBe('Cliente de Prueba')

    // Header row matches all 41 column labels verbatim.
    const expectedLabels = ANEXO_24_COLUMNS.map(c => c.label)
    const headerRowIdx = aoa.findIndex(r =>
      r.length >= expectedLabels.length && expectedLabels.every((lbl, i) => String(r[i] ?? '') === lbl),
    )
    expect(headerRowIdx).toBeGreaterThanOrEqual(0)

    // Two data rows follow.
    expect(String(aoa[headerRowIdx + 1]?.[0] ?? '')).toBe('2026')
    expect(String(aoa[headerRowIdx + 2]?.[0] ?? '')).toBe('2026')

    // Spot-check: Tratado column reports "SI"
    const tratadoIdx = ANEXO_24_COLUMNS.findIndex(c => c.key === 'tratado')
    expect(String(aoa[headerRowIdx + 1]?.[tratadoIdx] ?? '')).toBe('SI')
  })

  it('PDF buffer starts with %PDF- signature and weighs at least 2KB', async () => {
    const { pdf } = await generateAnexo24(makeData())
    expect(pdf.slice(0, 5).toString('utf8')).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(2000)
  })

  it('ships exactly 41 columns in the Formato 53 canonical order', () => {
    expect(ANEXO_24_COLUMNS.length).toBe(41)
    expect(ANEXO_24_COLUMNS[0].label).toBe('AnnioFechaPago')
    expect(ANEXO_24_COLUMNS[ANEXO_24_COLUMNS.length - 1].label).toBe('País de Origen')
  })

  it('storage path stays tenant-scoped (no cross-tenant bleed)', async () => {
    const data = makeData()
    const pathPdf = buildAnexo24StoragePath({ companyId: data.meta.company_id, timestamp: 1700000000000, kind: 'pdf' })
    const pathXlsx = buildAnexo24StoragePath({ companyId: data.meta.company_id, timestamp: 1700000000000, kind: 'xlsx' })
    expect(pathPdf).toBe('TEST/1700000000000_anexo24.pdf')
    expect(pathXlsx).toBe('TEST/1700000000000_anexo24.xlsx')
  })
})
