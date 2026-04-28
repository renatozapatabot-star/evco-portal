import { describe, it, expect } from 'vitest'
import {
  normalizeInvoiceNumber,
  normalizeSupplierName,
  levenshtein,
  supplierSimilarity,
  scoreCandidate,
  sha256Hex,
  type DedupCandidateRow,
  type DuplicateSearch,
} from '../invoice-dedup'

describe('invoice-dedup · pure helpers', () => {
  it('normalizeInvoiceNumber collapses separators and lowercases', () => {
    expect(normalizeInvoiceNumber('INV-2026/0417')).toBe('inv20260417')
    expect(normalizeInvoiceNumber('  A B 1 ')).toBe('ab1')
    expect(normalizeInvoiceNumber(null)).toBe('')
    expect(normalizeInvoiceNumber('')).toBe('')
  })

  it('normalizeSupplierName strips legal suffixes + diacritics', () => {
    expect(normalizeSupplierName('Acme Industrial de México S.A. de C.V.'))
      .toBe('acme industrial de mexico')
    expect(normalizeSupplierName('FooBar LLC')).toBe('foobar')
    expect(normalizeSupplierName('Duratech, Inc.')).toBe('duratech')
    expect(normalizeSupplierName('')).toBe('')
  })

  it('levenshtein is correct on the classic edge cases', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('', '')).toBe(0)
    expect(levenshtein('abc', 'abc')).toBe(0)
    expect(levenshtein('abc', '')).toBe(3)
  })

  it('supplierSimilarity returns 1 on normalized match + decays with distance', () => {
    expect(
      supplierSimilarity(
        'Acme Industrial de México S.A. de C.V.',
        'acme industrial de mexico',
      ),
    ).toBe(1)
    const partial = supplierSimilarity('Foam Supplies Inc.', 'Foam Suplies Inc.')
    expect(partial).toBeGreaterThan(0.85)
    expect(partial).toBeLessThan(1)
    expect(supplierSimilarity('Foo', 'Xyz')).toBeLessThan(0.5)
    expect(supplierSimilarity('', 'whatever')).toBe(0)
  })

  it('sha256Hex is stable for identical input', () => {
    const a = new TextEncoder().encode('hello')
    const b = new TextEncoder().encode('hello')
    const c = new TextEncoder().encode('world')
    expect(sha256Hex(a)).toBe(sha256Hex(b))
    expect(sha256Hex(a)).not.toBe(sha256Hex(c))
    expect(sha256Hex(a)).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('invoice-dedup · scoreCandidate', () => {
  const baseRow: DedupCandidateRow = {
    id: 'row-1',
    invoice_number: 'INV-2026/0417',
    normalized_invoice_number: 'inv20260417',
    supplier_name: 'Acme Industrial de México S.A. de C.V.',
    supplier_rfc: 'AIM850101ABC',
    amount: 15420.5,
    currency: 'MXN',
    received_at: '2026-04-10T10:00:00Z',
    status: 'unassigned',
    file_url: 'https://x/y.pdf',
    file_hash: 'hash-abc',
  }

  it('exact bucket on identical file_hash — highest score', () => {
    const target: DuplicateSearch = { companyId: 'evco', fileHash: 'hash-abc' }
    const match = scoreCandidate(target, baseRow)
    expect(match).not.toBeNull()
    expect(match!.bucket).toBe('exact')
    expect(match!.score).toBe(1)
    expect(match!.reasons[0]).toContain('archivo idéntico')
  })

  it('exact bucket on matching RFC + normalized invoice number', () => {
    const target: DuplicateSearch = {
      companyId: 'evco',
      invoiceNumber: 'inv-2026-0417',
      supplierRfc: 'AIM850101ABC',
    }
    const match = scoreCandidate(target, baseRow)
    expect(match).not.toBeNull()
    expect(match!.bucket).toBe('exact')
    expect(match!.score).toBeGreaterThan(0.9)
  })

  it('near bucket on same supplier + same amount within 60d', () => {
    const target: DuplicateSearch = {
      companyId: 'evco',
      supplierName: 'Acme Industrial de Mexico',
      amount: 15420.5,
      currency: 'MXN',
      invoiceDate: '2026-04-25T00:00:00Z',
    }
    const match = scoreCandidate(target, baseRow)
    expect(match).not.toBeNull()
    expect(match!.bucket).toBe('near')
    expect(match!.score).toBeGreaterThan(0.7)
  })

  it('fuzzy bucket on invoice-number typo + similar supplier', () => {
    const target: DuplicateSearch = {
      companyId: 'evco',
      // One missing digit → Levenshtein 1 against inv20260417
      invoiceNumber: 'INV-2026-047',
      supplierName: 'Acme Industrial de Mexico',
    }
    const match = scoreCandidate(target, baseRow)
    expect(match).not.toBeNull()
    expect(match!.bucket).toBe('fuzzy')
    expect(match!.reasons[0]).toContain('folio parecido')
  })

  it('no match when nothing lines up', () => {
    const target: DuplicateSearch = {
      companyId: 'evco',
      invoiceNumber: 'ZZZ-999',
      supplierName: 'Totally Different Corp',
      amount: 1,
      currency: 'USD',
    }
    expect(scoreCandidate(target, baseRow)).toBeNull()
  })

  it('excludeId suppresses self-match (used when re-scoring after insert)', () => {
    const target: DuplicateSearch = {
      companyId: 'evco',
      fileHash: 'hash-abc',
      excludeId: 'row-1',
    }
    expect(scoreCandidate(target, baseRow)).toBeNull()
  })

  it('near bucket refuses when amounts differ by more than a cent', () => {
    const target: DuplicateSearch = {
      companyId: 'evco',
      supplierName: 'Acme Industrial de Mexico',
      amount: 15421, // differs from 15420.50 by 0.50
      currency: 'MXN',
      invoiceDate: '2026-04-20T00:00:00Z',
    }
    expect(scoreCandidate(target, baseRow)).toBeNull()
  })

  it('tiny invoice numbers do not fuzzy-match (guards against "1" vs "2")', () => {
    const target: DuplicateSearch = {
      companyId: 'evco',
      invoiceNumber: '1',
      supplierName: 'Acme Industrial de Mexico',
    }
    const row = { ...baseRow, normalized_invoice_number: '2', invoice_number: '2' }
    expect(scoreCandidate(target, row)).toBeNull()
  })
})
