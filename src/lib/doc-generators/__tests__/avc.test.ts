/**
 * AGUILA · Block 16 — AVC generator tests.
 */
import { describe, it, expect } from 'vitest'
import { generateAVC, AvcValidationError, type AvcInput } from '@/lib/doc-generators/avc'

function makeInput(over: Partial<AvcInput> = {}): AvcInput {
  return {
    warehouse_entry_id: 'WEN-AVC-001',
    trafico_id: 'TRF-AVC-001',
    company_id: 'TEST',
    trailer_number: 'CAJA-9876',
    dock_assigned: '3',
    received_by: 'Vicente',
    received_at: '2026-04-01T09:15:00-06:00',
    photo_count: 4,
    notes: 'Sello intacto',
    rfc_importador: 'XAXX010101000',
    patente: '3596',
    aduana: '240',
    ...over,
  }
}

describe('generateAVC', () => {
  it('produces a PDF Buffer with %PDF- signature and non-trivial size', async () => {
    const { pdf } = await generateAVC(makeInput())
    expect(Buffer.isBuffer(pdf)).toBe(true)
    expect(pdf.length).toBeGreaterThan(1000)
    expect(pdf.slice(0, 5).toString('utf8')).toBe('%PDF-')
  })

  it('produces well-formed XML with PLACEHOLDER comment and required tags', async () => {
    const { xml } = await generateAVC(makeInput())
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
    expect(xml).toContain('<!-- PLACEHOLDER:')
    expect(xml).toContain('<AVC')
    expect(xml).toContain('<EntradaBodega')
    expect(xml).toContain('<Recepcion>')
    expect(xml).toContain('<Patente')
    expect(xml).toContain('CAJA-9876')
    expect(xml).toContain('</AVC>')
  })

  it('rejects input with missing required fields', async () => {
    await expect(generateAVC(makeInput({ warehouse_entry_id: '' }))).rejects.toBeInstanceOf(AvcValidationError)
    await expect(generateAVC(makeInput({ trailer_number: '' }))).rejects.toBeInstanceOf(AvcValidationError)
    await expect(generateAVC(makeInput({ rfc_importador: '' }))).rejects.toBeInstanceOf(AvcValidationError)
  })
})
