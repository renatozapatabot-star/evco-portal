import { describe, it, expect } from 'vitest'
import {
  getClienteEventLabel,
  CLIENTE_EVENT_LABELS,
} from '@/lib/cliente/event-labels'

/**
 * Cliente-friendly event label map (V1.5 F11).
 *
 * These tests guard the contract: the top 15 event kinds get bespoke
 * es-MX labels, everything else falls back to a Title-Cased version of
 * the raw kind. Labels must be Spanish — never raw english tech.
 */

describe('getClienteEventLabel', () => {
  it('resolves semaforo_verde to the crossing message', () => {
    const { label, icon } = getClienteEventLabel('semaforo_verde')
    expect(label).toContain('Cruzaste')
    expect(label).toContain('verde')
    expect(icon).toBe('check-circle')
  })

  it('resolves warehouse_received to bodega Laredo', () => {
    const { label } = getClienteEventLabel('warehouse_received')
    expect(label).toContain('bodega')
    expect(label).toContain('Laredo')
  })

  it('falls back to TitleCased for unknown kinds', () => {
    const { label, icon } = getClienteEventLabel('some_unknown_event')
    expect(label).toBe('Some Unknown Event')
    expect(icon).toBe('circle')
  })

  it('returns generic label when event type is null/empty', () => {
    expect(getClienteEventLabel(null).label).toBe('Evento')
    expect(getClienteEventLabel('').label).toBe('Evento')
    expect(getClienteEventLabel(undefined).label).toBe('Evento')
  })

  it('covers at least 15 event kinds with bespoke labels', () => {
    expect(Object.keys(CLIENTE_EVENT_LABELS).length).toBeGreaterThanOrEqual(15)
  })

  it('all bespoke labels are Spanish — no English leak', () => {
    // Fast sanity — no bespoke label contains common English words.
    const banned = [' the ', ' and ', ' from ', 'Error', 'Warning', 'Success']
    for (const [, { label }] of Object.entries(CLIENTE_EVENT_LABELS)) {
      for (const b of banned) {
        expect(label.toLowerCase()).not.toContain(b.toLowerCase())
      }
    }
  })
})
