import { describe, it, expect } from 'vitest'
import { clampThreshold, generateFollowUpMessage, type DormantClienteRecord } from '../dormant/detect'

describe('V1.5 F7 · dormant client detection — pure logic', () => {
  it('clampThreshold: coerces out-of-range inputs to [7, 60] and rounds down', () => {
    expect(clampThreshold(14)).toBe(14)
    expect(clampThreshold(6)).toBe(7)
    expect(clampThreshold(99)).toBe(60)
    expect(clampThreshold(14.9)).toBe(14)
    expect(clampThreshold(Number.NaN)).toBe(14)
  })

  it('generateFollowUpMessage: renders a complete Spanish template with cliente name, days, and signature', () => {
    const c: DormantClienteRecord = {
      clienteId: 'duratech',
      clienteName: 'Duratech de México S.A. de C.V.',
      lastActivityAt: '2026-03-20T12:00:00Z',
      diasSinMovimiento: 23,
      lastInvoiceAmount: 47_000,
      lastInvoiceCurrency: 'USD',
      lastInvoiceDate: '2026-03-19T12:00:00Z',
      rfc: 'DME010101ABC',
    }
    const { subject, message } = generateFollowUpMessage(c)
    expect(subject).toBe('Seguimiento — Duratech de México S.A. de C.V.')
    expect(message).toContain('Duratech de México S.A. de C.V.')
    expect(message).toContain('23 días')
    expect(message).toContain('Aduana 240')
    expect(message).toContain('Patente 3596')
    expect(message).toContain('Seguimos disponibles')
    expect(message).toContain('agendar una llamada')
  })

  it('generateFollowUpMessage: tolerates empty cliente name gracefully', () => {
    const c: DormantClienteRecord = {
      clienteId: 'x',
      clienteName: '',
      lastActivityAt: null,
      diasSinMovimiento: 14,
      lastInvoiceAmount: null,
      lastInvoiceCurrency: null,
      lastInvoiceDate: null,
      rfc: null,
    }
    const out = generateFollowUpMessage(c)
    expect(out.message).toContain('estimado cliente')
    expect(out.subject).toContain('Seguimiento')
  })
})
