import { describe, it, expect } from 'vitest'
import { translateEstatus } from '../estatus-translator'

describe('translateEstatus', () => {
  it('maps known upstream codes to client Spanish labels', () => {
    expect(translateEstatus('Pedimento Pagado')).toEqual({ label: 'Pagado', tone: 'positive' })
    // All three terminal states collapse to "Cruzado" — CRUZ's scope
    // ends at the border crossing, not final delivery.
    expect(translateEstatus('Cruzado')).toEqual({ label: 'Cruzado', tone: 'positive' })
    expect(translateEstatus('E1')).toEqual({ label: 'Cruzado', tone: 'positive' })
    expect(translateEstatus('Entregado')).toEqual({ label: 'Cruzado', tone: 'positive' })
    expect(translateEstatus('En Proceso')).toEqual({ label: 'En proceso', tone: 'in_flight' })
    expect(translateEstatus('En Aduana')).toEqual({ label: 'En aduana', tone: 'in_flight' })
  })

  it('handles both accented and unaccented "Documentacion"', () => {
    expect(translateEstatus('Documentacion').label).toBe('Documentación')
    expect(translateEstatus('Documentación').label).toBe('Documentación')
  })

  it('returns raw code with unknown tone when not mapped', () => {
    // 2026-05-05: E2/E3 added to MAP defensively (drift fence with the
    // script-side translator's RAW_DESPACHO_CODES). Use a genuinely
    // unmapped code to assert fall-through behavior.
    expect(translateEstatus('SOMETHING_NEW')).toEqual({ label: 'SOMETHING_NEW', tone: 'unknown' })
    expect(translateEstatus('Z9')).toEqual({ label: 'Z9', tone: 'unknown' })
  })

  it('maps E2/E3 defensively (RAW_DESPACHO_CODES safety net)', () => {
    expect(translateEstatus('E2')).toEqual({ label: 'En proceso', tone: 'in_flight' })
    expect(translateEstatus('E3')).toEqual({ label: 'En proceso', tone: 'in_flight' })
  })

  it('handles null and undefined safely', () => {
    expect(translateEstatus(null)).toEqual({ label: 'Sin estado', tone: 'unknown' })
    expect(translateEstatus(undefined)).toEqual({ label: 'Sin estado', tone: 'unknown' })
    expect(translateEstatus('')).toEqual({ label: 'Sin estado', tone: 'unknown' })
  })
})
