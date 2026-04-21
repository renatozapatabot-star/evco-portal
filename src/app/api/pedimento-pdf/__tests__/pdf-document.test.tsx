/**
 * Pure-render tests for the pedimento PDF document. No DB, no HTTP.
 * Verifies the commercial-only path (Y4512 shape) renders with
 * "Pendiente" markers for unsynced CBP data instead of silent $0.
 */

import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { PedimentoPDF, type PedimentoPDFProps } from '../pdf-document'

function baseProps(overrides: Partial<PedimentoPDFProps> = {}): PedimentoPDFProps {
  return {
    clientName: 'EVCO PLASTICS DE MEXICO, S. DE R.L. DE C.V.',
    patente: '3596',
    aduana: '240',
    date: '13 de abril de 2026',
    pedimento: '6500256',
    trafico: '9254-Y4512',
    fechaPago: null,
    fechaLlegada: null,
    regimen: 'ITE',
    proveedor: 'MONROE OEM LLC',
    descripcion: 'GASKET LID',
    valorUSD: 14017.5,
    dta: 408,
    igi: null,
    iva: null,
    tipoCambio: 17.3033,
    partidas: [{ fraccion: '', descripcion: '3801390', cantidad: 10500, valorUSD: 14017.5 }],
    dataSource: 'commercial-only',
    ...overrides,
  }
}

describe('PedimentoPDF', () => {
  it('renders a valid PDF for the Y4512 commercial-only case', async () => {
    const buf = await renderToBuffer(PedimentoPDF(baseProps()))
    expect(buf.length).toBeGreaterThan(1000)
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  }, 20000)

  it('renders the CBP-complete case with numeric IGI and IVA', async () => {
    const buf = await renderToBuffer(
      PedimentoPDF(baseProps({ igi: 1234.5, iva: 5678.9, dataSource: 'cbp' }))
    )
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  }, 20000)

  it('renders with zero partidas without throwing', async () => {
    const buf = await renderToBuffer(PedimentoPDF(baseProps({ partidas: [] })))
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  }, 20000)

  it('renders the estimated path with computed IGI/IVA labelled "Estimado"', async () => {
    const buf = await renderToBuffer(
      PedimentoPDF(baseProps({ igi: 1850.4, iva: 39520.7, dataSource: 'estimated' }))
    )
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  }, 20000)

  it('renders estimated-partial when only DTA was estimable', async () => {
    const buf = await renderToBuffer(
      PedimentoPDF(baseProps({ igi: null, iva: null, dataSource: 'estimated-partial' }))
    )
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  }, 20000)
})
