/**
 * CRUZ · Anexo 24 export tests — 13-column GlobalPC parity.
 *
 * Verifies the shared `ANEXO24_COLUMNS` contract: Excel header matches
 * the canonical order, no `(placeholder)` / `pendiente verificación`
 * branding, no `CRUZ` user-visible text, storage path stays tenant-scoped.
 */
import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import {
  generateAnexo24,
  buildAnexo24StoragePath,
  ANEXO24_COLUMNS,
  type Anexo24Data,
  type Anexo24Row,
} from '@/lib/anexo-24-export'

function makeRow(over: Partial<Anexo24Row> = {}): Anexo24Row {
  return {
    consecutivo: 1,
    pedimento: '26 24 3596 6500441',
    fecha: '2026-03-15',
    embarque: '9254-Y4333',
    fraccion: '3901.20.01',
    descripcion: 'RESINA DE POLIETILENO',
    cantidad: 1500,
    umc: 'KGM',
    valor_usd: 12345.67,
    proveedor: 'ACME Plastics Co',
    pais: 'USA',
    regimen: 'IMD',
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
      generado_en: '2026-04-28T12:00:00Z',
      generado_por: 'TEST:admin',
      patente: '3596',
      aduana: '240',
    },
    rows,
  }
}

describe('generateAnexo24 (13-column GlobalPC parity)', () => {
  it('Excel header matches the 13-column canonical order verbatim', async () => {
    const { excel } = await generateAnexo24(makeData([makeRow(), makeRow({ consecutivo: 2, embarque: '9254-Y4334' })]))
    expect(Buffer.isBuffer(excel)).toBe(true)

    const wb = XLSX.read(excel, { type: 'buffer' })
    expect(wb.SheetNames).toContain('Anexo 24')
    const ws = wb.Sheets['Anexo 24']!
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]

    // Identity block: line 1 = "Anexo 24 — <client>"; line 2 = patente/aduana/periodo.
    expect(String(aoa[0]?.[0] ?? '')).toBe('Anexo 24 — Cliente de Prueba')
    expect(String(aoa[1]?.[0] ?? '')).toContain('Patente 3596')
    expect(String(aoa[1]?.[0] ?? '')).toContain('Aduana 240')

    const expectedHeaders = ANEXO24_COLUMNS.map((c) => c.header)
    const headerRowIdx = aoa.findIndex((r) =>
      r.length >= expectedHeaders.length && expectedHeaders.every((h, i) => String(r[i] ?? '') === h),
    )
    expect(headerRowIdx).toBeGreaterThanOrEqual(0)
  })

  it('ships exactly 13 columns in GlobalPC-parity order', () => {
    expect(ANEXO24_COLUMNS.length).toBe(13)
    expect(ANEXO24_COLUMNS[0].header).toBe('No.')
    expect(ANEXO24_COLUMNS[1].header).toBe('Pedimento')
    expect(ANEXO24_COLUMNS[ANEXO24_COLUMNS.length - 1].header).toBe('T-MEC')
  })

  it('XLSX contains no "(placeholder)" or "pendiente verificación" branding', async () => {
    const { excel } = await generateAnexo24(makeData())
    const wb = XLSX.read(excel, { type: 'buffer' })
    const ws = wb.Sheets['Anexo 24']!
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]
    const flatText = aoa.flat().map((v) => String(v ?? '')).join(' ')
    expect(flatText.toLowerCase()).not.toContain('placeholder')
    expect(flatText.toLowerCase()).not.toContain('pendiente verificación')
    expect(flatText).not.toMatch(/\bCRUZ\b/)
  })

  it('PDF buffer starts with %PDF- signature and weighs at least 2KB', async () => {
    const { pdf } = await generateAnexo24(makeData())
    expect(pdf.slice(0, 5).toString('utf8')).toBe('%PDF-')
    expect(pdf.length).toBeGreaterThan(2000)
  })

  it('renders T-MEC as Sí / No based on the boolean field', async () => {
    const { excel } = await generateAnexo24(makeData([
      makeRow({ tmec: true, consecutivo: 1 }),
      makeRow({ tmec: false, consecutivo: 2, regimen: 'A1' }),
    ]))
    const wb = XLSX.read(excel, { type: 'buffer' })
    const ws = wb.Sheets['Anexo 24']!
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][]
    const tmecIdx = ANEXO24_COLUMNS.findIndex((c) => c.key === 'tmec')
    const headerRowIdx = aoa.findIndex((r) => String(r[0] ?? '') === 'No.')
    expect(String(aoa[headerRowIdx + 1]?.[tmecIdx] ?? '')).toBe('Sí')
    expect(String(aoa[headerRowIdx + 2]?.[tmecIdx] ?? '')).toBe('No')
  })

  it('storage path stays tenant-scoped (no cross-tenant bleed)', () => {
    const data = makeData()
    const pathPdf = buildAnexo24StoragePath({ companyId: data.meta.company_id, timestamp: 1700000000000, kind: 'pdf' })
    const pathXlsx = buildAnexo24StoragePath({ companyId: data.meta.company_id, timestamp: 1700000000000, kind: 'xlsx' })
    expect(pathPdf).toBe('TEST/1700000000000_anexo24.pdf')
    expect(pathXlsx).toBe('TEST/1700000000000_anexo24.xlsx')
  })
})
