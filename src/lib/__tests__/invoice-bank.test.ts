import { describe, it, expect } from 'vitest'
import {
  parseInvoiceExtraction,
  isValidStatusTransition,
  buildInvoiceAssignedPayload,
  INVOICE_BANK_EVENTS,
} from '../invoice-bank'

describe('Block 8 · Invoice Bank — pure logic', () => {
  it('parseInvoiceExtraction: extracts full invoice payload from Claude-shaped JSON', () => {
    const raw = JSON.stringify({
      invoice_number: 'INV-2026-0417',
      supplier_name: 'Acme Industrial de México S.A. de C.V.',
      amount: 15420.5,
      currency: 'MXN',
      confidence: 0.93,
    })
    const out = parseInvoiceExtraction(raw)
    expect(out.invoice_number).toBe('INV-2026-0417')
    expect(out.supplier_name).toBe('Acme Industrial de México S.A. de C.V.')
    expect(out.amount).toBe(15420.5)
    expect(out.currency).toBe('MXN')
    expect(out.confidence).toBeCloseTo(0.93, 2)
  })

  it('parseInvoiceExtraction: tolerates markdown fences, string amounts, and 0-100 confidence', () => {
    const raw = '```json\n{"invoice_number":"A1","supplier_name":"","amount":"$ 2,300.00","currency":"usd","confidence":87}\n```'
    const out = parseInvoiceExtraction(raw)
    expect(out.invoice_number).toBe('A1')
    // Empty string supplier_name collapses to null
    expect(out.supplier_name).toBeNull()
    expect(out.amount).toBe(2300)
    expect(out.currency).toBe('USD')
    expect(out.confidence).toBeCloseTo(0.87, 2)
  })

  it('parseInvoiceExtraction: returns nulls for missing fields and clamps bad confidence', () => {
    const raw = JSON.stringify({ confidence: 'abc' })
    const out = parseInvoiceExtraction(raw)
    expect(out.invoice_number).toBeNull()
    expect(out.supplier_name).toBeNull()
    expect(out.amount).toBeNull()
    expect(out.currency).toBeNull()
    // Non-numeric confidence falls back to the 0.5 default
    expect(out.confidence).toBe(0.5)
  })

  it('isValidStatusTransition: allows unassigned → assigned and unassigned → archived', () => {
    expect(isValidStatusTransition('unassigned', 'assigned')).toBe(true)
    expect(isValidStatusTransition('unassigned', 'archived')).toBe(true)
    expect(isValidStatusTransition('assigned', 'archived')).toBe(true)
  })

  it('isValidStatusTransition: rejects illegal moves', () => {
    expect(isValidStatusTransition('unassigned', 'unassigned')).toBe(false)
    expect(isValidStatusTransition('assigned', 'unassigned')).toBe(false)
    expect(isValidStatusTransition('archived', 'assigned')).toBe(false)
    expect(isValidStatusTransition('archived', 'unassigned')).toBe(false)
  })

  it('buildInvoiceAssignedPayload: emits workflow=invoice with all fields and catalog event is known', () => {
    const payload = buildInvoiceAssignedPayload({
      invoiceId: 'inv-uuid-1',
      traficoId: 'TRF-9001',
      invoiceNumber: 'INV-7',
      supplierName: 'Proveedor X',
      amount: 500.25,
      currency: 'USD',
      actor: 'evco:operator',
    })
    expect(payload.workflow).toBe('invoice')
    expect(payload.event_type).toBe('invoice_assigned')
    expect(payload.trigger_id).toBe('TRF-9001')
    expect(payload.payload).toMatchObject({
      invoice_id: 'inv-uuid-1',
      invoice_number: 'INV-7',
      supplier_name: 'Proveedor X',
      amount: 500.25,
      currency: 'USD',
      actor: 'evco:operator',
    })
    // Telemetry union includes the six Block 8 event names.
    expect(INVOICE_BANK_EVENTS).toContain('invoice_assigned')
    expect(INVOICE_BANK_EVENTS).toContain('invoice_bank_opened')
    expect(INVOICE_BANK_EVENTS.length).toBe(6)
  })
})
