import { describe, it, expect } from 'vitest'
import { translateEstatus } from '../estatus-translator'

describe('translateEstatus', () => {
  it('maps known GlobalPC codes to client Spanish labels', () => {
    expect(translateEstatus('Pedimento Pagado')).toEqual({ label: 'Pagado', tone: 'positive' })
    expect(translateEstatus('Cruzado')).toEqual({ label: 'Cruzó', tone: 'positive' })
    expect(translateEstatus('E1')).toEqual({ label: 'Entregado', tone: 'positive' })
    expect(translateEstatus('En Proceso')).toEqual({ label: 'En proceso', tone: 'in_flight' })
    expect(translateEstatus('En Aduana')).toEqual({ label: 'En aduana', tone: 'in_flight' })
  })

  it('handles both accented and unaccented "Documentacion"', () => {
    expect(translateEstatus('Documentacion').label).toBe('Documentación')
    expect(translateEstatus('Documentación').label).toBe('Documentación')
  })

  it('returns raw code with unknown tone when not mapped', () => {
    expect(translateEstatus('E2')).toEqual({ label: 'E2', tone: 'unknown' })
    expect(translateEstatus('SOMETHING_NEW')).toEqual({ label: 'SOMETHING_NEW', tone: 'unknown' })
  })

  it('handles null and undefined safely', () => {
    expect(translateEstatus(null)).toEqual({ label: 'Sin estado', tone: 'unknown' })
    expect(translateEstatus(undefined)).toEqual({ label: 'Sin estado', tone: 'unknown' })
    expect(translateEstatus('')).toEqual({ label: 'Sin estado', tone: 'unknown' })
  })
})
