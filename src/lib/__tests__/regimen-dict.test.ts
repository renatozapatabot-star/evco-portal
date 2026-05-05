import { describe, it, expect } from 'vitest'
import { formatRegimen, getRegimenLabel } from '../regimen-dict'

describe('regimen-dict', () => {
  it('returns null label for empty input', () => {
    expect(getRegimenLabel(null)).toBeNull()
    expect(getRegimenLabel(undefined)).toBeNull()
    expect(getRegimenLabel('')).toBeNull()
    expect(getRegimenLabel('   ')).toBeNull()
  })

  it('maps known claves (uppercased)', () => {
    expect(getRegimenLabel('ITE')).toBe('Importación Temporal de Empresa')
    expect(getRegimenLabel('IMD')).toBe('Importación Definitiva')
    expect(getRegimenLabel('A1')).toBe('Importación Definitiva')
    expect(getRegimenLabel('C1')).toBe('Exportación Definitiva')
  })

  it('case-insensitive lookup', () => {
    expect(getRegimenLabel('ite')).toBe('Importación Temporal de Empresa')
    expect(getRegimenLabel('a1')).toBe('Importación Definitiva')
  })

  it('returns null for unknown claves', () => {
    expect(getRegimenLabel('XX99')).toBeNull()
  })

  it('formatRegimen returns "{clave} — {label}" for known', () => {
    expect(formatRegimen('ITE')).toBe('ITE — Importación Temporal de Empresa')
    expect(formatRegimen('IMD')).toBe('IMD — Importación Definitiva')
  })

  it('formatRegimen returns raw clave for unknown', () => {
    expect(formatRegimen('XX99')).toBe('XX99')
    expect(formatRegimen('zz')).toBe('ZZ')
  })

  it('formatRegimen returns fallback for empty', () => {
    expect(formatRegimen(null)).toBe('—')
    expect(formatRegimen('')).toBe('—')
    expect(formatRegimen(null, 'Sin régimen')).toBe('Sin régimen')
  })

  it('formatRegimen trims whitespace', () => {
    expect(formatRegimen('  ITE  ')).toBe('ITE — Importación Temporal de Empresa')
  })
})
