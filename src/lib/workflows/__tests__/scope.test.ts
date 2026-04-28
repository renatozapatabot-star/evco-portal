import { describe, it, expect } from 'vitest'
import { SHADOW_MODE_COMPANIES, isShadowModeCompany } from '../scope'

describe('shadow-mode scope', () => {
  it('allows EVCO and MAFESA only', () => {
    expect(SHADOW_MODE_COMPANIES).toEqual(['evco', 'mafesa'])
  })

  it('is case-insensitive', () => {
    expect(isShadowModeCompany('EVCO')).toBe(true)
    expect(isShadowModeCompany('MaFeSa')).toBe(true)
  })

  it('rejects unknown tenants + falsy values', () => {
    expect(isShadowModeCompany('duratech')).toBe(false)
    expect(isShadowModeCompany('')).toBe(false)
    expect(isShadowModeCompany(null)).toBe(false)
    expect(isShadowModeCompany(undefined)).toBe(false)
  })
})
