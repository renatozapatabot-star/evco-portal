/**
 * AGUILA · Block 16 — DODA generator tests.
 */
import { describe, it, expect } from 'vitest'
import { generateDODA, DodaValidationError, type DodaInput } from '@/lib/doc-generators/doda'

function makeInput(over: Partial<DodaInput> = {}): DodaInput {
  return {
    pedimento_number: '26 24 3596 6500441',
    trafico_id: 'TRF-DODA-001',
    company_id: 'TEST',
    rfc_importador: 'XAXX010101000',
    rfc_agente: 'RZY850101ABC',
    patente: '3596',
    aduana: '240',
    fecha_pago: '2026-04-01',
    valor_aduana_mxn: 123456.78,
    valor_comercial_usd: 7200,
    peso_bruto_kg: 1500,
    tipo_operacion: 'IMP',
    transporte: {
      placas: 'ABC-123-NL',
      caja: 'CAJA-9876',
      transportista: 'Transportes Castores',
    },
    ...over,
  }
}

describe('generateDODA', () => {
  it('produces a PDF Buffer with %PDF- signature and non-trivial size', async () => {
    const { pdf } = await generateDODA(makeInput())
    expect(Buffer.isBuffer(pdf)).toBe(true)
    expect(pdf.length).toBeGreaterThan(1000)
    expect(pdf.slice(0, 5).toString('utf8')).toBe('%PDF-')
  })

  it('produces well-formed XML with PLACEHOLDER comment and required tags', async () => {
    const { xml } = await generateDODA(makeInput())
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
    expect(xml).toContain('<!-- PLACEHOLDER:')
    expect(xml).toContain('<DODA')
    expect(xml).toContain('<Pedimento')
    expect(xml).toContain('<Emisor')
    expect(xml).toContain('<Receptor')
    expect(xml).toContain('26 24 3596 6500441')
    expect(xml).toContain('</DODA>')
  })

  it('rejects input with missing required fields', async () => {
    await expect(generateDODA(makeInput({ pedimento_number: '' }))).rejects.toBeInstanceOf(DodaValidationError)
    await expect(generateDODA(makeInput({ rfc_importador: '' }))).rejects.toBeInstanceOf(DodaValidationError)
    // Invalid pedimento format
    await expect(generateDODA(makeInput({ pedimento_number: '26243596650' }))).rejects.toBeInstanceOf(DodaValidationError)
  })
})
