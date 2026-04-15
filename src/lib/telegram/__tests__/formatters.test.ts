/**
 * ZAPATA AI · V1.5 F12 — Telegram formatter tests.
 */

import { describe, it, expect } from 'vitest'
import {
  formatTraficoCompleted,
  formatFacturaIssued,
  formatPecePaymentConfirmed,
  formatDormantClientDetected,
  formatSemaforoVerde,
  formatMveAlertRaised,
  formatDefault,
  formatForEvent,
  ROUTABLE_EVENT_KINDS,
} from '../formatters'

describe('telegram/formatters', () => {
  it('formats trafico_completed with the canonical demo payload', () => {
    const msg = formatTraficoCompleted({
      trafico_id: 'TR-2284',
      client_name: 'EVCO',
      crossed_at: '2026-04-12T19:32:00.000Z',
      total_amount: 47200,
      currency: 'USD',
      operator_name: 'Eduardo',
      next_action: 'ninguna',
    })
    expect(msg).toContain('✅')
    expect(msg).toContain('TR-2284')
    expect(msg).toContain('EVCO')
    expect(msg).toContain('47,200.00 USD')
    expect(msg).toContain('Eduardo')
    expect(msg).toContain('ninguna')
  })

  it('survives missing fields with dashes, never throws', () => {
    const msg = formatTraficoCompleted({})
    expect(msg).toContain('—')
    expect(typeof msg).toBe('string')
  })

  it('formats factura_issued with currency', () => {
    const msg = formatFacturaIssued({ invoice_number: 'F-9128', amount: 12500, currency: 'MXN' })
    expect(msg).toContain('📄')
    expect(msg).toContain('F-9128')
    expect(msg).toContain('12,500.00 MXN')
  })

  it('formats pece_payment_confirmed with bank and amount', () => {
    const msg = formatPecePaymentConfirmed({
      pedimento_number: '26 24 3596 6500441',
      amount: 98200,
      currency: 'MXN',
      bank_name: 'Banorte',
    })
    expect(msg).toContain('💳')
    expect(msg).toContain('26 24 3596 6500441')
    expect(msg).toContain('Banorte')
  })

  it('formats dormant_client_detected', () => {
    const msg = formatDormantClientDetected({ client_name: 'Hilos Iris', days_dormant: 42 })
    expect(msg).toContain('🔔')
    expect(msg).toContain('Hilos Iris')
    expect(msg).toContain('42')
  })

  it('formats semaforo_verde with lane and bridge', () => {
    const msg = formatSemaforoVerde({ trafico_id: 'TR-1', lane: 'B4', bridge: 'WTB' })
    expect(msg).toContain('🟢')
    expect(msg).toContain('B4')
    expect(msg).toContain('WTB')
  })

  it('formats mve_alert_raised with severity uppercased', () => {
    const msg = formatMveAlertRaised({
      pedimento_number: '26 24 3596 6500441',
      days_remaining: 5,
      severity: 'critical',
    })
    expect(msg).toContain('⚠️')
    expect(msg).toContain('CRITICAL')
    expect(msg).toContain('5')
  })

  it('default formatter includes event kind + trigger', () => {
    const msg = formatDefault('some_other_event', { trafico_id: 'TR-9' })
    expect(msg).toContain('some_other_event')
    expect(msg).toContain('TR-9')
  })

  it('formatForEvent dispatches to the correct formatter for every routable kind', () => {
    for (const kind of ROUTABLE_EVENT_KINDS) {
      const msg = formatForEvent(kind, {})
      expect(typeof msg).toBe('string')
      expect(msg.length).toBeGreaterThan(3)
    }
  })

  it('formatForEvent falls back to default for unknown kinds', () => {
    const msg = formatForEvent('mystery_kind', { trafico_id: 'X' })
    expect(msg).toContain('mystery_kind')
  })
})
