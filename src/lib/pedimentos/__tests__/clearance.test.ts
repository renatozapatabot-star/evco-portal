import { describe, it, expect } from 'vitest'
import { isCleared, clearanceLabel } from '../clearance'

describe('isCleared', () => {
  it('returns true when fecha_cruce is set', () => {
    expect(isCleared({ fecha_cruce: '2026-04-20T14:30:00Z' })).toBe(true)
  })

  it('returns true for each cleared estatus value', () => {
    expect(isCleared({ estatus: 'Cruzado' })).toBe(true)
    expect(isCleared({ estatus: 'Pedimento Pagado' })).toBe(true)
    expect(isCleared({ estatus: 'Completo' })).toBe(true)
    expect(isCleared({ estatus: 'Cerrado' })).toBe(true)
  })

  it('trims whitespace on estatus before matching', () => {
    expect(isCleared({ estatus: ' Cruzado ' })).toBe(true)
  })

  it('returns false for in-process estatus values', () => {
    expect(isCleared({ estatus: 'En Proceso' })).toBe(false)
    expect(isCleared({ estatus: 'Pendiente' })).toBe(false)
    expect(isCleared({ estatus: 'En Clasificación' })).toBe(false)
  })

  it('returns false when both fields are null', () => {
    expect(isCleared({ estatus: null, fecha_cruce: null })).toBe(false)
  })

  it('fecha_cruce wins over an uncleared estatus', () => {
    expect(isCleared({ estatus: 'En Proceso', fecha_cruce: '2026-04-20T14:30:00Z' })).toBe(true)
  })
})

describe('clearanceLabel', () => {
  it('returns "Cleared" for a cleared trafico', () => {
    expect(clearanceLabel({ fecha_cruce: '2026-04-20T14:30:00Z' })).toBe('Cleared')
  })

  it('returns "Not cleared" for everything else', () => {
    expect(clearanceLabel({ estatus: 'En Proceso' })).toBe('Not cleared')
    expect(clearanceLabel({})).toBe('Not cleared')
  })
})
