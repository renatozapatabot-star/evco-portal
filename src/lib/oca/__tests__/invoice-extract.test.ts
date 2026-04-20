/**
 * Unit tests for invoice-extract.ts — parser + cost + not-configured path.
 * No live Anthropic call. The real-network extraction of the #4526219
 * fixture lives in invoice-4526219.test.ts, gated by an env var.
 */
import { describe, it, expect } from 'vitest'
import {
  parseInvoiceResponse,
  invoiceExtractCostUsd,
  extractInvoice,
  INVOICE_VISION_MODEL,
} from '../invoice-extract'

describe('parseInvoiceResponse', () => {
  it('parses a minimal invoice with one line and normalizes country', () => {
    const raw = JSON.stringify({
      invoice_number: '4526219',
      supplier: 'Plastic Process Equipment, Inc',
      invoice_date: '2026-04-13',
      total_invoice_amount_usd: 651.53,
      currency: 'usd',
      incoterm: 'exw',
      parts: [
        {
          line: 1,
          item_no: '18MB',
          description: '18MM CLEANING BRUSHES — BRUSH WIRE SIZE .010',
          qty: 8,
          uom: 'EA',
          country_raw: 'MADE IN USA',
          unit_price_usd: 7.45,
          extended_price_usd: 59.6,
          pre_classified_fraccion: '9603.90',
        },
      ],
    })
    const out = parseInvoiceResponse(raw)
    expect(out.invoice_number).toBe('4526219')
    expect(out.currency).toBe('USD')
    expect(out.incoterm).toBe('EXW')
    expect(out.parts).toHaveLength(1)
    expect(out.parts[0].item_no).toBe('18MB') // preserved exactly — no lowercase
    expect(out.parts[0].country_iso).toBe('US') // normalized from "MADE IN USA"
    expect(out.parts[0].country_raw).toBe('MADE IN USA') // raw preserved
    expect(out.parts[0].pre_classified_fraccion).toBe('9603.90') // dots preserved
  })

  it('strips ```json fences gracefully', () => {
    const raw = '```json\n{"invoice_number":"X1","parts":[]}\n```'
    const out = parseInvoiceResponse(raw)
    expect(out.invoice_number).toBe('X1')
    expect(out.parts).toEqual([])
  })

  it('truncates over 100 parts (safety rail)', () => {
    const parts = Array.from({ length: 150 }, (_, i) => ({
      line: i + 1,
      item_no: `P${i}`,
      description: `part ${i}`,
    }))
    const raw = JSON.stringify({ invoice_number: 'BIG', parts })
    const out = parseInvoiceResponse(raw)
    expect(out.parts).toHaveLength(100)
    expect(out.parts[99].item_no).toBe('P99')
  })

  it('normalizes common country shorthands', () => {
    const parts = [
      { item_no: 'A', country_raw: 'CHINA' },
      { item_no: 'B', country_raw: 'JAPAN' },
      { item_no: 'C', country_raw: 'Germany' },
      { item_no: 'D', country_raw: 'Argentina' },
      { item_no: 'E', country_raw: null },
    ]
    const out = parseInvoiceResponse(JSON.stringify({ parts }))
    expect(out.parts.map((p) => p.country_iso)).toEqual([
      'CN', 'JP', 'DE', 'OTHER', null,
    ])
  })

  it('throws on non-object JSON', () => {
    expect(() => parseInvoiceResponse('"hello"')).toThrow(/non-object/)
    expect(() => parseInvoiceResponse('[1,2,3]')).toThrow(/non-object/)
  })

  it('coerces string numbers with currency symbols', () => {
    const raw = JSON.stringify({
      invoice_number: 'X',
      total_invoice_amount_usd: '$1,234.56',
      parts: [
        { item_no: 'A', unit_price_usd: '7.45', extended_price_usd: 'USD 59.60' },
      ],
    })
    const out = parseInvoiceResponse(raw)
    expect(out.total_invoice_amount_usd).toBe(1234.56)
    expect(out.parts[0].unit_price_usd).toBe(7.45)
    expect(out.parts[0].extended_price_usd).toBe(59.60)
  })

  it('defaults parts to [] when missing', () => {
    const out = parseInvoiceResponse('{"invoice_number":"X"}')
    expect(out.parts).toEqual([])
  })
})

describe('invoiceExtractCostUsd', () => {
  it('computes Sonnet-4.6 cost per Anthropic pricing ($3 / $15 per M tokens)', () => {
    // 1000 input tokens = $0.003; 1000 output tokens = $0.015; total $0.018
    expect(invoiceExtractCostUsd(1000, 1000)).toBeCloseTo(0.018, 4)
    // 0 tokens = 0 cost (short-circuit correctness)
    expect(invoiceExtractCostUsd(0, 0)).toBe(0)
  })
})

describe('extractInvoice — not configured', () => {
  it('returns notConfigured=true with zero cost when no API key is present', async () => {
    const previous = process.env.ANTHROPIC_API_KEY
    delete process.env.ANTHROPIC_API_KEY
    try {
      const bytes = new Uint8Array([0])
      const res = await extractInvoice({ bytes, mediaType: 'application/pdf' })
      expect(res.notConfigured).toBe(true)
      expect(res.extraction).toBeNull()
      expect(res.error).toBe('vision_not_configured')
      expect(res.inputTokens).toBe(0)
      expect(res.outputTokens).toBe(0)
      expect(res.model).toBe(INVOICE_VISION_MODEL)
    } finally {
      if (previous !== undefined) process.env.ANTHROPIC_API_KEY = previous
    }
  })
})
