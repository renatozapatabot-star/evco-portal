import { describe, it, expect } from 'vitest'
import { parseVisionResponse } from '../classify'

describe('parseVisionResponse', () => {
  it('parses a complete invoice extraction', () => {
    const raw = JSON.stringify({
      doc_type: 'invoice',
      supplier: 'ACME Plastics S.A. de C.V.',
      invoice_number: 'F-123456',
      invoice_date: '2026-04-12',
      currency: 'usd',
      amount: 12345.67,
      line_items: [
        {
          description: 'Resina PET',
          quantity: 10,
          unit_price: 100,
          total: 1000,
          fraccion: '3907.61.01',
        },
      ],
    })
    const out = parseVisionResponse(raw)
    expect(out.doc_type).toBe('invoice')
    expect(out.supplier).toBe('ACME Plastics S.A. de C.V.')
    expect(out.invoice_number).toBe('F-123456')
    expect(out.invoice_date).toBe('2026-04-12')
    expect(out.currency).toBe('USD')
    expect(out.amount).toBe(12345.67)
    expect(out.line_items).toHaveLength(1)
    expect(out.line_items[0].fraccion).toBe('3907.61.01')
  })

  it('strips markdown fences before parsing', () => {
    const raw = '```json\n{"doc_type":"bol","line_items":[]}\n```'
    const out = parseVisionResponse(raw)
    expect(out.doc_type).toBe('bol')
    expect(out.line_items).toEqual([])
  })

  it('coerces numeric strings in amount and quantity', () => {
    const raw = JSON.stringify({
      doc_type: 'invoice',
      amount: '1,234.56',
      line_items: [{ description: 'A', quantity: '3', unit_price: '10', total: '30', fraccion: null }],
    })
    const out = parseVisionResponse(raw)
    expect(out.amount).toBe(1234.56)
    expect(out.line_items[0].quantity).toBe(3)
  })

  it('nulls unknown doc_type and bad dates', () => {
    const raw = JSON.stringify({
      doc_type: 'mystery',
      invoice_date: 'no-idea',
      line_items: [],
    })
    const out = parseVisionResponse(raw)
    expect(out.doc_type).toBeNull()
    expect(out.invoice_date).toBeNull()
  })

  it('truncates line_items past 40 entries', () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      description: `item ${i}`,
      quantity: 1,
      unit_price: 1,
      total: 1,
      fraccion: null,
    }))
    const out = parseVisionResponse(JSON.stringify({ doc_type: 'invoice', line_items: items }))
    expect(out.line_items).toHaveLength(40)
  })

  it('defaults line_items to empty array when missing', () => {
    const out = parseVisionResponse(JSON.stringify({ doc_type: 'other' }))
    expect(out.line_items).toEqual([])
  })

  it('throws on non-object JSON', () => {
    expect(() => parseVisionResponse('[1,2,3]')).toThrow()
  })
})
