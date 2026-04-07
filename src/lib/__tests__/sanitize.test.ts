import { describe, it, expect } from 'vitest'
import { sanitizeFilter, sanitizeIlike, isValidColumn } from '../sanitize'

describe('sanitizeFilter', () => {
  it('removes PostgREST injection characters', () => {
    expect(sanitizeFilter('normal text')).toBe('normal text')
    expect(sanitizeFilter('value,or(evil)')).toBe('valueorevil')
    expect(sanitizeFilter('test.*')).toBe('test')
    expect(sanitizeFilter('hello\\world')).toBe('helloworld')
    expect(sanitizeFilter('50%')).toBe('50')
  })

  it('trims whitespace', () => {
    expect(sanitizeFilter('  hello  ')).toBe('hello')
  })

  it('handles empty string', () => {
    expect(sanitizeFilter('')).toBe('')
  })

  it('preserves safe characters', () => {
    expect(sanitizeFilter('EVCO-123 test')).toBe('EVCO-123 test')
    expect(sanitizeFilter('26 24 3596 6500441')).toBe('26 24 3596 6500441')
  })
})

describe('sanitizeIlike', () => {
  it('escapes SQL wildcards', () => {
    expect(sanitizeIlike('test%')).toBe('test\\%')
    expect(sanitizeIlike('test_value')).toBe('test\\_value')
  })

  it('removes PostgREST operators', () => {
    expect(sanitizeIlike('value,or(evil)')).toBe('valueorevil')
  })

  it('escapes backslashes', () => {
    expect(sanitizeIlike('test\\path')).toBe('test\\\\path')
  })

  it('trims whitespace', () => {
    expect(sanitizeIlike('  hello  ')).toBe('hello')
  })

  it('preserves safe characters', () => {
    expect(sanitizeIlike('resina polietileno')).toBe('resina polietileno')
    expect(sanitizeIlike('3901.20.01')).toBe('3901.20.01')
  })
})

describe('isValidColumn', () => {
  const ALLOWED = ['trafico', 'pedimento', 'fecha_llegada', 'company_id', 'estatus'] as const

  it('returns true for allowed columns', () => {
    expect(isValidColumn('trafico', ALLOWED)).toBe(true)
    expect(isValidColumn('company_id', ALLOWED)).toBe(true)
  })

  it('returns false for disallowed columns', () => {
    expect(isValidColumn('password', ALLOWED)).toBe(false)
    expect(isValidColumn('DROP TABLE', ALLOWED)).toBe(false)
    expect(isValidColumn('', ALLOWED)).toBe(false)
  })

  it('rejects SQL injection attempts', () => {
    expect(isValidColumn('trafico; DROP TABLE traficos', ALLOWED)).toBe(false)
    expect(isValidColumn("trafico' OR '1'='1", ALLOWED)).toBe(false)
  })
})
