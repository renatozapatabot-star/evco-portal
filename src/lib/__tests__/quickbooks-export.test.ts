import { describe, it, expect } from 'vitest'
import {
  generateIIF,
  generateCSV,
  escapeIIFField,
  countRows,
  type IIFPayload,
} from '@/lib/quickbooks-export'

const sample: IIFPayload = {
  customers: [
    { name: 'EVCO Plastics', taxId: 'EVC950101ABC', companyName: 'EVCO Plastics de México' },
  ],
  vendors: [
    { name: 'ACME Supplier', taxId: 'ACM880101XYZ' },
  ],
  invoices: [
    {
      invoiceNumber: 'FAC-001',
      date: '2026-04-10',
      customerName: 'EVCO Plastics',
      currency: 'MXN',
      memo: 'Pedimento 26 24 3596 6500441',
      lines: [
        { account: 'Ingresos:Servicios aduanales', amount: 15420.00, memo: 'Honorarios', fraccion: '3901.20.01', quantity: 1 },
        { account: 'Ingresos:Gastos reembolsables', amount: 2380.50, memo: 'DTA + IGI', quantity: 1 },
      ],
    },
  ],
  bills: [
    {
      billNumber: 'BILL-01',
      date: '2026-04-09',
      vendorName: 'ACME Supplier',
      currency: 'USD',
      lines: [{ account: 'Gastos:Fletes', amount: 800.00, memo: 'Cargo flete' }],
    },
  ],
}

describe('generateIIF — structure', () => {
  it('emits !CUST header and CUST row for each customer', () => {
    const out = generateIIF(sample)
    expect(out).toContain('!CUST\tNAME\tREFNUM\tTAXID\tCOMPANYNAME')
    expect(out).toContain('CUST\tEVCO Plastics\t1\tEVC950101ABC\tEVCO Plastics de México')
  })

  it('emits !VEND header and VEND row for each vendor', () => {
    const out = generateIIF(sample)
    expect(out).toContain('!VEND\tNAME\tREFNUM\tTAXID')
    expect(out).toMatch(/VEND\tACME Supplier\t1\tACM880101XYZ/)
  })

  it('emits TRNS / SPL / ENDTRNS block per invoice with per-line SPL rows', () => {
    const out = generateIIF(sample)
    const lines = out.split('\r\n')
    const trnsIdx = lines.findIndex(l => l.startsWith('TRNS\t') && l.includes('INVOICE') && l.includes('FAC-001'))
    expect(trnsIdx).toBeGreaterThan(-1)
    // Two SPL rows follow (two line items)
    expect(lines[trnsIdx + 1].startsWith('SPL\t')).toBe(true)
    expect(lines[trnsIdx + 2].startsWith('SPL\t')).toBe(true)
    expect(lines[trnsIdx + 3]).toBe('ENDTRNS')
  })

  it('includes fracción in the SPL memo when present', () => {
    const out = generateIIF(sample)
    expect(out).toContain('3901.20.01')
  })

  it('formats dates as MM/DD/YYYY and amounts with 2 decimals', () => {
    const out = generateIIF(sample)
    expect(out).toContain('04/10/2026')
    expect(out).toContain('17800.50') // 15420 + 2380.50 TRNS total
  })

  it('uses CRLF line endings and terminates with CRLF', () => {
    const out = generateIIF(sample)
    expect(out).toContain('\r\n')
    expect(out.endsWith('\r\n')).toBe(true)
  })
})

describe('escapeIIFField', () => {
  it('replaces embedded tabs, CR, and LF with a space', () => {
    expect(escapeIIFField('foo\tbar')).toBe('foo bar')
    expect(escapeIIFField('line1\nline2')).toBe('line1 line2')
    expect(escapeIIFField('with\r\ncrlf')).toBe('with  crlf')
  })

  it('returns empty string for null/undefined', () => {
    expect(escapeIIFField(null)).toBe('')
    expect(escapeIIFField(undefined)).toBe('')
  })

  it('stringifies numbers', () => {
    expect(escapeIIFField(42)).toBe('42')
  })
})

describe('generateCSV', () => {
  it('emits a header row and one row per entity', () => {
    const csv = generateCSV(sample)
    const lines = csv.split('\r\n').filter(Boolean)
    expect(lines[0]).toBe('entity,name,tax_id,number,date,currency,amount,memo')
    // 1 customer + 1 vendor + 1 invoice + 1 bill
    expect(lines.length).toBe(5)
  })

  it('quotes fields containing commas', () => {
    const csv = generateCSV({
      invoices: [{
        invoiceNumber: 'F-9',
        date: '2026-04-10',
        customerName: 'Acme, Inc.',
        currency: 'USD',
        lines: [{ account: 'x', amount: 1 }],
      }],
    })
    expect(csv).toContain('"Acme, Inc."')
  })
})

describe('countRows', () => {
  it('sums customers + vendors + invoices + bills', () => {
    expect(countRows(sample)).toBe(4)
    expect(countRows({})).toBe(0)
  })
})
