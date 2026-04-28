import { describe, it, expect, beforeEach, vi } from 'vitest'
import { findMissingDocuments, REQUIRED_DOC_TYPES } from '../tool-helpers/find-missing-docs'

interface Stub { lastEqs: Array<[string, string]> }
const stub: Stub = { lastEqs: [] }
let expedienteResponse: { data: unknown; error: unknown } = { data: [], error: null }

function makeSupabase() {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn((c: string, v: string) => { stub.lastEqs.push([c, v]); return chain })
  chain.limit = vi.fn(() => Promise.resolve(expedienteResponse))
  return {
    from: vi.fn(() => chain),
  } as unknown as Parameters<typeof findMissingDocuments>[0]
}

beforeEach(() => {
  stub.lastEqs = []
  expedienteResponse = { data: [], error: null }
})

describe('findMissingDocuments', () => {
  it('refuses empty inputs', async () => {
    const r = await findMissingDocuments(makeSupabase(), '', { traficoId: 'Y-1' })
    expect(r.error).toBe('invalid_companyId')

    const r2 = await findMissingDocuments(makeSupabase(), 'evco', { traficoId: '' })
    expect(r2.error).toBe('invalid_traficoId')
  })

  it('scopes query by company_id AND pedimento_id (trafico slug, not phantom trafico_id)', async () => {
    await findMissingDocuments(makeSupabase(), 'evco', { traficoId: 'Y-1234' })
    expect(stub.lastEqs).toContainEqual(['company_id', 'evco'])
    expect(stub.lastEqs).toContainEqual(['pedimento_id', 'Y-1234'])
  })

  it('all required docs present → completeness 100, empty missing list', async () => {
    expedienteResponse = {
      data: [
        { doc_type: 'invoice', file_name: 'inv.pdf', uploaded_at: '2026-04-01' },
        { doc_type: 'cove', file_name: 'cove.pdf', uploaded_at: '2026-04-01' },
        { doc_type: 'packing_list', file_name: 'pl.pdf', uploaded_at: '2026-04-01' },
        { doc_type: 'bl_awb', file_name: 'bl.pdf', uploaded_at: '2026-04-01' },
        { doc_type: 'certificate_of_origin', file_name: 'coo.pdf', uploaded_at: '2026-04-01' },
      ],
      error: null,
    }
    const r = await findMissingDocuments(makeSupabase(), 'evco', { traficoId: 'Y-1' })
    expect(r.data?.completeness_pct).toBe(100)
    expect(r.data?.missing_types_es).toEqual([])
    expect(r.data?.rationale_es).toContain('Expediente completo')
  })

  it('honors doc_type aliases (factura → invoice)', async () => {
    expedienteResponse = {
      data: [
        { doc_type: 'factura', file_name: 'f.pdf', uploaded_at: null },
        { doc_type: 'COVE', file_name: 'c.pdf', uploaded_at: null },
        { doc_type: 'certificado_origen', file_name: 'coo.pdf', uploaded_at: null },
      ],
      error: null,
    }
    const r = await findMissingDocuments(makeSupabase(), 'evco', { traficoId: 'Y-1' })
    const missingKeys = r.data?.missing_types_es.map(m => m.key) ?? []
    expect(missingKeys).not.toContain('invoice')
    expect(missingKeys).not.toContain('cove')
    expect(missingKeys).not.toContain('certificate_of_origin')
    expect(missingKeys).toContain('packing_list')
    expect(missingKeys).toContain('bl_awb')
  })

  it('no docs on file → all missing, completeness 0', async () => {
    expedienteResponse = { data: [], error: null }
    const r = await findMissingDocuments(makeSupabase(), 'evco', { traficoId: 'Y-1' })
    expect(r.data?.completeness_pct).toBe(0)
    expect(r.data?.missing_types_es).toHaveLength(REQUIRED_DOC_TYPES.length)
    expect(r.data?.rationale_es).toContain('Faltan')
  })

  it('surfaces supabase errors without masking', async () => {
    expedienteResponse = { data: null, error: { message: 'column does not exist' } }
    const r = await findMissingDocuments(makeSupabase(), 'evco', { traficoId: 'Y-1' })
    expect(r.success).toBe(false)
    expect(r.error).toContain('expediente:')
  })
})
