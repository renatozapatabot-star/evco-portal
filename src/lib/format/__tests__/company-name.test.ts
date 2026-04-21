import { describe, it, expect } from 'vitest'
import { cleanCompanyDisplayName } from '../company-name'

describe('cleanCompanyDisplayName', () => {
  it('strips the EVCO full legal suffix with comma + no space', () => {
    expect(cleanCompanyDisplayName('EVCO PLASTICS DE MEXICO,S.DE R.L.DE C.V.'))
      .toBe('EVCO Plastics de México')
  })

  it('strips the EVCO full legal suffix with comma + space', () => {
    expect(cleanCompanyDisplayName('EVCO PLASTICS DE MEXICO, S.DE R.L.DE C.V.'))
      .toBe('EVCO Plastics de México')
  })

  it('strips S.A. DE C.V.', () => {
    expect(cleanCompanyDisplayName('Faurecia Interior Systems, S.A. DE C.V.'))
      .toBe('Faurecia Interior Systems')
  })

  it('strips S.A.P.I. DE C.V.', () => {
    expect(cleanCompanyDisplayName('Tech Company, S.A.P.I. DE C.V.'))
      .toBe('Tech Company')
  })

  it('strips S. DE R.L. alone (no C.V.)', () => {
    expect(cleanCompanyDisplayName('Acme Industries, S. DE R.L.'))
      .toBe('Acme Industries')
  })

  it('strips S.C. (sociedad civil)', () => {
    expect(cleanCompanyDisplayName('Consultores ABC, S.C.'))
      .toBe('Consultores ABC')
  })

  it('keeps clean names unchanged', () => {
    expect(cleanCompanyDisplayName('Duratech Industries'))
      .toBe('Duratech Industries')
  })

  it('lowercases connectors (de, del, la, y)', () => {
    expect(cleanCompanyDisplayName('GRUPO REQUENA DE MEXICO'))
      .toBe('Grupo Requena de México')
  })

  it('keeps short acronyms uppercase (EVCO, RFC, SAT)', () => {
    expect(cleanCompanyDisplayName('EVCO SAT COMPLIANT, S.A. DE C.V.'))
      .toBe('EVCO SAT Compliant')
  })

  it('handles lowercase/mixed-case legal suffixes', () => {
    expect(cleanCompanyDisplayName('Foo Bar s.a. de c.v.'))
      .toBe('Foo Bar')
  })

  it('handles null + empty input', () => {
    expect(cleanCompanyDisplayName(null)).toBe('')
    expect(cleanCompanyDisplayName('')).toBe('')
    expect(cleanCompanyDisplayName(undefined)).toBe('')
  })

  it('trims stray trailing whitespace after stripping', () => {
    expect(cleanCompanyDisplayName('Acme   ,   S.A. DE C.V.   '))
      .toBe('Acme')
  })

  it('does not destroy short company names without suffix', () => {
    expect(cleanCompanyDisplayName('MAFESA')).toBe('MAFESA')
  })
})
