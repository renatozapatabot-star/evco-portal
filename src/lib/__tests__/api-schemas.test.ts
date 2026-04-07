import { describe, it, expect } from 'vitest'
import { authSchema, dataQuerySchema, searchSchema, pedimentoPackageSchema } from '../api-schemas'

describe('authSchema', () => {
  it('accepts valid password', () => {
    const result = authSchema.safeParse({ password: 'evco2026' })
    expect(result.success).toBe(true)
  })

  it('rejects empty password', () => {
    const result = authSchema.safeParse({ password: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing password', () => {
    const result = authSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects overly long password', () => {
    const result = authSchema.safeParse({ password: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })
})

describe('dataQuerySchema', () => {
  it('accepts valid traficos query', () => {
    const result = dataQuerySchema.safeParse({
      table: 'traficos',
      limit: '50',
      company_id: 'evco',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.table).toBe('traficos')
      expect(result.data.limit).toBe(50)
      expect(result.data.company_id).toBe('evco')
    }
  })

  it('rejects invalid table name', () => {
    const result = dataQuerySchema.safeParse({ table: 'users' })
    expect(result.success).toBe(false)
  })

  it('rejects SQL injection in table name', () => {
    const result = dataQuerySchema.safeParse({ table: "traficos; DROP TABLE traficos" })
    expect(result.success).toBe(false)
  })

  it('coerces string limit to number', () => {
    const result = dataQuerySchema.safeParse({ table: 'traficos', limit: '100' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(100)
  })

  it('rejects limit over 5000', () => {
    const result = dataQuerySchema.safeParse({ table: 'traficos', limit: '10000' })
    expect(result.success).toBe(false)
  })

  it('rejects limit of 0', () => {
    const result = dataQuerySchema.safeParse({ table: 'traficos', limit: '0' })
    expect(result.success).toBe(false)
  })

  it('defaults limit to 50', () => {
    const result = dataQuerySchema.safeParse({ table: 'traficos' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.limit).toBe(50)
  })

  it('accepts all allowed tables', () => {
    const tables = ['traficos', 'entradas', 'aduanet_facturas', 'expediente_documentos', 'pipeline_overview']
    for (const table of tables) {
      const result = dataQuerySchema.safeParse({ table })
      expect(result.success).toBe(true)
    }
  })

  it('accepts order parameters', () => {
    const result = dataQuerySchema.safeParse({
      table: 'traficos',
      order_by: 'fecha_llegada',
      order_dir: 'desc',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid order_dir', () => {
    const result = dataQuerySchema.safeParse({
      table: 'traficos',
      order_dir: 'invalid',
    })
    expect(result.success).toBe(false)
  })

  it('accepts filter parameters', () => {
    const result = dataQuerySchema.safeParse({
      table: 'traficos',
      gte_field: 'fecha_llegada',
      gte_value: '2024-01-01',
      not_null: 'pedimento',
    })
    expect(result.success).toBe(true)
  })

  it('accepts MAFESA company_id', () => {
    const result = dataQuerySchema.safeParse({
      table: 'traficos',
      company_id: 'mafesa',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.company_id).toBe('mafesa')
  })
})

describe('searchSchema', () => {
  it('accepts valid search query', () => {
    const result = searchSchema.safeParse({ q: '26 24 3596 6500441' })
    expect(result.success).toBe(true)
  })

  it('rejects too short query', () => {
    const result = searchSchema.safeParse({ q: 'a' })
    expect(result.success).toBe(false)
  })

  it('rejects too long query', () => {
    const result = searchSchema.safeParse({ q: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('rejects missing query', () => {
    const result = searchSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('pedimentoPackageSchema', () => {
  it('accepts valid trafico reference', () => {
    const result = pedimentoPackageSchema.safeParse({ trafico: 'TRF-2026-001' })
    expect(result.success).toBe(true)
  })

  it('rejects special characters in trafico', () => {
    const result = pedimentoPackageSchema.safeParse({ trafico: "TRF'; DROP TABLE" })
    expect(result.success).toBe(false)
  })

  it('rejects empty trafico', () => {
    const result = pedimentoPackageSchema.safeParse({ trafico: '' })
    expect(result.success).toBe(false)
  })
})
