import { describe, expect, it } from 'vitest'
import {
  SEARCH_ENTITIES,
  ADVANCED_SEARCH_FIELDS,
  validateAdvancedCriteria,
  OPERATOR_SEARCH_ROLES,
} from '@/lib/search-registry'

describe('SEARCH_ENTITIES registry', () => {
  it('exposes exactly 12 entity groups', () => {
    expect(SEARCH_ENTITIES.length).toBe(12)
  })

  it('entity ids are unique', () => {
    const ids = SEARCH_ENTITIES.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('stub groups have an emptyMessage', () => {
    const stubs = SEARCH_ENTITIES.filter((e) => e.scope === 'stub')
    expect(stubs.length).toBeGreaterThanOrEqual(1)
    for (const s of stubs) expect(s.emptyMessage).toBeTruthy()
  })
})

describe('ADVANCED_SEARCH_FIELDS', () => {
  it('exposes the full advanced field set (13 UI fields, dateFrom+dateTo split = 14 configs)', () => {
    expect(ADVANCED_SEARCH_FIELDS.length).toBe(14)
  })

  it('field ids are unique', () => {
    const ids = ADVANCED_SEARCH_FIELDS.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('validateAdvancedCriteria (blank-submit guard)', () => {
  it('rejects empty object', () => {
    const r = validateAdvancedCriteria({})
    expect(r.valid).toBe(false)
    if (!r.valid) expect(r.message).toMatch(/criterio/)
  })

  it('rejects whitespace-only strings', () => {
    const r = validateAdvancedCriteria({ traficoKey: '   ', pedimentoNumber: '' })
    expect(r.valid).toBe(false)
  })

  it('rejects empty array for statusCategory', () => {
    const r = validateAdvancedCriteria({ statusCategory: [] })
    expect(r.valid).toBe(false)
  })

  it('accepts a single non-empty text field', () => {
    const r = validateAdvancedCriteria({ pedimentoNumber: '26 24 3596 6500441' })
    expect(r.valid).toBe(true)
  })

  it('accepts a date range', () => {
    const r = validateAdvancedCriteria({ dateFrom: '2026-01-01' })
    expect(r.valid).toBe(true)
  })

  it('accepts a non-empty array', () => {
    const r = validateAdvancedCriteria({ statusCategory: ['cruzado'] })
    expect(r.valid).toBe(true)
  })
})

describe('OPERATOR_SEARCH_ROLES', () => {
  it('contains the 5 operator roles from plan', () => {
    expect(OPERATOR_SEARCH_ROLES).toEqual([
      'operator',
      'admin',
      'broker',
      'warehouse',
      'contabilidad',
    ])
  })
})
