import { describe, it, expect } from 'vitest'
import { isCleared, clearanceLabel, clearanceLabelES } from '../clearance'

describe('isCleared', () => {
  it('returns true when fecha_cruce is set', () => {
    expect(isCleared({ fecha_cruce: '2026-04-20T14:30:00Z' })).toBe(true)
  })

  it('returns true for each cleared estatus value', () => {
    expect(isCleared({ estatus: 'Cruzado' })).toBe(true)
    expect(isCleared({ estatus: 'Entregado' })).toBe(true)
    expect(isCleared({ estatus: 'Pedimento Pagado' })).toBe(true)
    expect(isCleared({ estatus: 'Completo' })).toBe(true)
  })

  it('does NOT count "E1" as cleared on its own (paid, not yet crossed)', () => {
    // E1 means SAT-accepted/pedimento-paid but the cargo may still be
    // staging at the bridge. Without fecha_cruce, treating this as
    // "Liberado" lies to the client. See clearance.ts header for
    // the full reasoning + investigation reference.
    expect(isCleared({ estatus: 'E1' })).toBe(false)
    expect(isCleared({ estatus: 'E1', fecha_cruce: null })).toBe(false)
  })

  it('counts "E1" as cleared ONLY when fecha_cruce is also present', () => {
    // The fecha_cruce branch fires first — physical crossing wins
    // regardless of estatus.
    expect(isCleared({ estatus: 'E1', fecha_cruce: '2026-04-20T14:30:00Z' })).toBe(true)
  })

  it('does NOT count "Cerrado" as cleared (ambiguous in GlobalPC — can mean cancelled)', () => {
    expect(isCleared({ estatus: 'Cerrado' })).toBe(false)
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

describe('clearanceLabelES', () => {
  it('returns "Liberado" for a cleared trafico', () => {
    expect(clearanceLabelES({ fecha_cruce: '2026-04-20T14:30:00Z' })).toBe('Liberado')
    expect(clearanceLabelES({ estatus: 'Cruzado' })).toBe('Liberado')
    expect(clearanceLabelES({ estatus: 'Pedimento Pagado' })).toBe('Liberado')
  })

  it('returns "No liberado" for E1 alone (paid, not yet crossed)', () => {
    // Regression test for the SEV-2 fixed 2026-05-06: 9254-Y4568 had
    // estatus=E1 + fecha_cruce=NULL and was rendering "LIBERADO" while
    // the body said "Pago pendiente" and the timeline said "Pendiente
    // de cruzar". The three signals must agree.
    expect(clearanceLabelES({ estatus: 'E1' })).toBe('No liberado')
    expect(clearanceLabelES({ estatus: 'E1', fecha_cruce: null })).toBe('No liberado')
  })

  it('returns "Liberado" when E1 is paired with a real fecha_cruce', () => {
    // E1 + crossed = legitimately Liberado. fecha_cruce wins.
    expect(clearanceLabelES({ estatus: 'E1', fecha_cruce: '2026-04-20T14:30:00Z' })).toBe('Liberado')
  })

  it('returns "No liberado" for everything else', () => {
    expect(clearanceLabelES({ estatus: 'En Proceso' })).toBe('No liberado')
    expect(clearanceLabelES({})).toBe('No liberado')
    expect(clearanceLabelES({ estatus: 'Cerrado' })).toBe('No liberado')
  })
})
