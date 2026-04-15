/**
 * ZAPATA AI · Block 16 — Carta Porte generator tests.
 */
import { describe, it, expect } from 'vitest'
import {
  generateCartaPorte,
  CartaPorteValidationError,
  type CartaPorteInput,
} from '@/lib/doc-generators/carta-porte'

function makeInput(over: Partial<CartaPorteInput> = {}): CartaPorteInput {
  return {
    trafico_id: 'TRF-CP-001',
    pedimento_number: '26 24 3596 6500441',
    company_id: 'TEST',
    rfc_emisor: 'RZY850101ABC',
    rfc_receptor: 'XAXX010101000',
    fecha_emision: '2026-04-01T10:30:00-06:00',
    origen: {
      rfc: 'USA-ORIGIN-01',
      domicilio: '100 Industrial Blvd, Houston',
      pais: 'USA',
    },
    destino: {
      rfc: 'XAXX010101000',
      domicilio: 'Av. Industria 250, Nuevo Laredo',
      pais: 'MEX',
    },
    transporte: {
      tipo: 'autotransporte',
      placas: 'NL-ABC-123',
      configuracion_vehicular: 'T3S2',
    },
    mercancia: {
      descripcion: 'Polietileno alta densidad',
      peso_kg: 1500,
      valor_mxn: 250000,
      fraccion_arancelaria: '3901.20.01',
    },
    ...over,
  }
}

describe('generateCartaPorte', () => {
  it('produces a PDF Buffer with %PDF- signature and non-trivial size', async () => {
    const { pdf } = await generateCartaPorte(makeInput())
    expect(Buffer.isBuffer(pdf)).toBe(true)
    expect(pdf.length).toBeGreaterThan(1000)
    expect(pdf.slice(0, 5).toString('utf8')).toBe('%PDF-')
  })

  it('produces well-formed CFDI 4.0 XML with Carta Porte complement', async () => {
    const { xml } = await generateCartaPorte(makeInput())
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
    expect(xml).toContain('<!-- PLACEHOLDER:')
    expect(xml).toContain('<cfdi:Comprobante')
    expect(xml).toContain('xmlns:cartaporte30')
    expect(xml).toContain('<cartaporte30:CartaPorte')
    expect(xml).toContain('<cartaporte30:Ubicacion')
    expect(xml).toContain('<cartaporte30:Mercancia')
    expect(xml).toContain('3901.20.01')
    expect(xml).toContain('</cfdi:Comprobante>')
  })

  it('rejects input with missing required fields', async () => {
    await expect(generateCartaPorte(makeInput({ rfc_emisor: '' }))).rejects.toBeInstanceOf(CartaPorteValidationError)
    await expect(generateCartaPorte(makeInput({ fecha_emision: '' }))).rejects.toBeInstanceOf(CartaPorteValidationError)
    await expect(
      generateCartaPorte(
        makeInput({ mercancia: { descripcion: '', peso_kg: 100, valor_mxn: 1000 } }),
      ),
    ).rejects.toBeInstanceOf(CartaPorteValidationError)
  })
})
