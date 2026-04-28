import { describe, it, expect } from 'vitest'
import { expedienteStatusLabel } from '../status'

describe('expedienteStatusLabel', () => {
  const allDocs = [] as const

  it('returns "Sin pedimento" when no pedimento exists, regardless of docs', () => {
    expect(expedienteStatusLabel(allDocs, false))
      .toEqual({ label: 'Sin pedimento', tone: 'silver' })
    // Even with everything missing, no pedimento dominates
    expect(expedienteStatusLabel(['factura_comercial', 'cove'], false))
      .toEqual({ label: 'Sin pedimento', tone: 'silver' })
  })

  it('returns "Completo" when pedimento exists and nothing is missing', () => {
    expect(expedienteStatusLabel([], true))
      .toEqual({ label: 'Completo', tone: 'green' })
  })

  it('returns "Falta factura" when factura_comercial missing', () => {
    expect(expedienteStatusLabel(['factura_comercial'], true))
      .toEqual({ label: 'Falta factura', tone: 'amber' })
    // Factura takes precedence over downstream docs
    expect(expedienteStatusLabel(['factura_comercial', 'cove', 'doda'], true))
      .toEqual({ label: 'Falta factura', tone: 'amber' })
  })

  it('returns "Falta CFDI" when cove or acuse_cove missing', () => {
    expect(expedienteStatusLabel(['cove'], true))
      .toEqual({ label: 'Falta CFDI', tone: 'amber' })
    expect(expedienteStatusLabel(['acuse_cove'], true))
      .toEqual({ label: 'Falta CFDI', tone: 'amber' })
  })

  it('returns "Falta evidencia" when packing/doda/pedimento_detallado missing', () => {
    expect(expedienteStatusLabel(['packing_list'], true))
      .toEqual({ label: 'Falta evidencia', tone: 'amber' })
    expect(expedienteStatusLabel(['doda'], true))
      .toEqual({ label: 'Falta evidencia', tone: 'amber' })
    expect(expedienteStatusLabel(['pedimento_detallado'], true))
      .toEqual({ label: 'Falta evidencia', tone: 'amber' })
  })

  it('priority order: factura > CFDI > evidencia', () => {
    // factura wins over CFDI
    expect(expedienteStatusLabel(['factura_comercial', 'cove'], true).label)
      .toBe('Falta factura')
    // CFDI wins over evidencia
    expect(expedienteStatusLabel(['cove', 'doda'], true).label)
      .toBe('Falta CFDI')
  })
})
