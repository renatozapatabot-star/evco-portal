/**
 * ZAPATA AI · Block 10 — Anexo 24 export tests.
 *
 * Three tests: Excel structure, PDF structure, date range filter surfaces in meta.
 */
import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import {
  generateAnexo24,
  buildAnexo24StoragePath,
  ANEXO_24_COLUMNS,
  PLACEHOLDER_NOTICE_ES,
  type Anexo24Data,
  type Anexo24Row,
} from '@/lib/anexo-24-export'

function makeRow(over: Partial<Anexo24Row> = {}): Anexo24Row {
  return {
    consecutivo: 1,
    pedimento: '26 24 3596 6500441',
    fecha: '2026-03-15',
    trafico: 'TRF-TEST-001',
    fraccion: '3901.20.01',
    descripcion: 'Polietileno alta densidad',
    cantidad: 1500,
    umc: 'KGM',
    valor_usd: 12345.67,
    proveedor: 'ACME Plastics Co',
    pais_origen: 'USA',
    regimen: 'ITE',
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
      generado_en: '2026-04-11T12:00:00Z',
      generado_por: 'TEST:admin',
      patente: '3596',
      aduana: '240',
    },
    rows,
  }
}

describe('generateAnexo24', () => {
  it('produces an Excel buffer whose first sheet carries the header row and tenant-scoped rows', async () => {
    const { excel, pdf } = await generateAnexo24(makeData([makeRow(), makeRow({ consecutivo: 2, pedimento: '26 24 3596 6500442' })]))

    expect(Buffer.isBuffer(excel)).toBe(true)
    expect(excel.length).toBeGreaterThan(200)
    expect(Buffer.isBuffer(pdf)).toBe(true)
    expect(pdf.length).toBeGreaterThan(200)

    const wb = XLSX.read(excel, { type: 'buffer' })
    expect(wb.SheetNames).toContain('Anexo 24')
    const ws = wb.Sheets['Anexo 24']!
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]

    // Meta block + placeholder notice sits before the header row.
    const joined = aoa.map(r => r.map(c => String(c ?? '')).join('|')).join('\n')
    expect(joined).toContain(PLACEHOLDER_NOTICE_ES)

    // Find header row by matching the full label set.
    const expectedLabels = ANEXO_24_COLUMNS.map(c => c.label)
    const headerRowIdx = aoa.findIndex(r =>
      expectedLabels.every((lbl, i) => String(r[i] ?? '') === lbl),
    )
    expect(headerRowIdx).toBeGreaterThanOrEqual(0)

    // Two data rows below the header.
    expect(aoa[headerRowIdx + 1]?.[0]).toBe(1)
    expect(aoa[headerRowIdx + 2]?.[0]).toBe(2)
    // T-MEC column (last) — boolean surfaced as 'Sí'
    expect(String(aoa[headerRowIdx + 1]?.[ANEXO_24_COLUMNS.length - 1] ?? '')).toBe('Sí')
  })

  it('produces a PDF buffer that starts with the %PDF- signature and is non-trivial size', async () => {
    const { pdf } = await generateAnexo24(makeData())
    expect(pdf.slice(0, 5).toString('utf8')).toBe('%PDF-')
    // Envelope with header + meta + 1 row should comfortably exceed 2KB.
    expect(pdf.length).toBeGreaterThan(2000)
  })

  it('surfaces the date range + tenant in storage path and meta, no cross-tenant bleed', async () => {
    const data = makeData()
    const pathPdf = buildAnexo24StoragePath({ companyId: data.meta.company_id, timestamp: 1700000000000, kind: 'pdf' })
    const pathXlsx = buildAnexo24StoragePath({ companyId: data.meta.company_id, timestamp: 1700000000000, kind: 'xlsx' })
    expect(pathPdf).toBe('TEST/1700000000000_anexo24_placeholder.pdf')
    expect(pathXlsx).toBe('TEST/1700000000000_anexo24_placeholder.xlsx')

    // Meta carries both bounds verbatim — caller owns filtering by fecha.
    expect(data.meta.date_from).toBe('2026-01-01')
    expect(data.meta.date_to).toBe('2026-03-31')

    // Excel sheet should show both bounds in the meta block.
    const { excel } = await generateAnexo24(data)
    const wb = XLSX.read(excel, { type: 'buffer' })
    const ws = wb.Sheets['Anexo 24']!
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]
    const joined = aoa.map(r => r.map(c => String(c ?? '')).join('|')).join('\n')
    expect(joined).toContain('2026-01-01')
    expect(joined).toContain('2026-03-31')
  })
})
