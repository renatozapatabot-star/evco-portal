import { describe, it, expect, beforeEach, vi } from 'vitest'
import { searchSupplierHistory } from '../tool-helpers/supplier-history'

interface Stub { lastTable: string | null; lastEqs: Array<[string, string]>; lastOr: string | null; lastIlike: [string, string] | null }
const stub: Stub = { lastTable: null, lastEqs: [], lastOr: null, lastIlike: null }

const responses: Record<string, { data: unknown; error: unknown }> = {}

function makeSupabase() {
  const from = vi.fn((t: string) => {
    stub.lastTable = t
    stub.lastEqs = []
    stub.lastOr = null
    stub.lastIlike = null
    const chain: Record<string, unknown> = {}
    chain.select = vi.fn(() => chain)
    chain.eq = vi.fn((c: string, v: string) => { stub.lastEqs.push([c, v]); return chain })
    chain.or = vi.fn((expr: string) => { stub.lastOr = expr; return chain })
    chain.ilike = vi.fn((c: string, v: string) => { stub.lastIlike = [c, v]; return chain })
    chain.gte = vi.fn(() => chain)
    chain.order = vi.fn(() => chain)
    chain.limit = vi.fn(() => Promise.resolve(responses[t] ?? { data: [], error: null }))
    return chain
  })
  return { from } as unknown as Parameters<typeof searchSupplierHistory>[0]
}

beforeEach(() => {
  for (const k of Object.keys(responses)) delete responses[k]
})

describe('searchSupplierHistory', () => {
  it('refuses empty term', async () => {
    const r = await searchSupplierHistory(makeSupabase(), 'evco', { searchTerm: '  ' })
    expect(r.success).toBe(false)
    expect(r.error).toBe('invalid_searchTerm')
  })

  it('computes verde_pct from crossed shipments only', async () => {
    responses['globalpc_proveedores'] = {
      data: [{ cve_proveedor: 'PRV_001', nombre: 'Duratech', alias: 'DURA', id_fiscal: 'DUR123', pais: 'USA' }],
      error: null,
    }
    responses['traficos'] = {
      data: [
        { trafico: 'Y-1', aduana: '240', semaforo: 0, fecha_cruce: '2026-04-01', proveedores: 'DURATECH' },
        { trafico: 'Y-2', aduana: '240', semaforo: 0, fecha_cruce: '2026-04-02', proveedores: 'DURATECH' },
        { trafico: 'Y-3', aduana: '240', semaforo: 1, fecha_cruce: '2026-04-03', proveedores: 'DURATECH' },
        // Not yet crossed — excluded from the verde_pct denominator.
        { trafico: 'Y-4', aduana: '240', semaforo: null, fecha_cruce: null, proveedores: 'DURATECH' },
      ],
      error: null,
    }
    const r = await searchSupplierHistory(makeSupabase(), 'evco', { searchTerm: 'duratech' })
    expect(r.success).toBe(true)
    expect(r.data?.crossings_analyzed).toBe(3)
    expect(r.data?.verde_pct).toBeCloseTo(66.7, 1)
    expect(r.data?.risk_band_es).toBe('alta') // <75% → alta
    expect(r.data?.top_aduana).toBe('240')
    expect(r.data?.last_crossing_es?.trafico).toBe('Y-1')
    expect(r.data?.matches[0]?.cve_proveedor).toBe('PRV_001')
  })

  it('zero crossings → sin_datos band', async () => {
    responses['globalpc_proveedores'] = { data: [], error: null }
    responses['traficos'] = { data: [], error: null }
    const r = await searchSupplierHistory(makeSupabase(), 'evco', { searchTerm: 'unknown' })
    expect(r.data?.risk_band_es).toBe('sin_datos')
    expect(r.data?.verde_pct).toBeNull()
    expect(r.data?.rationale_es).toContain('Sin cruces')
  })

  it('scopes traficos query by company_id', async () => {
    responses['globalpc_proveedores'] = { data: [], error: null }
    responses['traficos'] = { data: [], error: null }
    await searchSupplierHistory(makeSupabase(), 'evco', { searchTerm: 'foo' })
    // Last called table was traficos. Confirm company_id filter was applied.
    expect(stub.lastTable).toBe('traficos')
    expect(stub.lastEqs).toContainEqual(['company_id', 'evco'])
  })

  it('high verde_pct → baja risk band', async () => {
    responses['globalpc_proveedores'] = { data: [], error: null }
    responses['traficos'] = {
      data: Array.from({ length: 10 }, (_, i) => ({
        trafico: `Y-${i}`, aduana: '240', semaforo: i < 9 ? 0 : 1, fecha_cruce: '2026-04-01', proveedores: 'ACME',
      })),
      error: null,
    }
    const r = await searchSupplierHistory(makeSupabase(), 'evco', { searchTerm: 'acme' })
    expect(r.data?.verde_pct).toBe(90)
    expect(r.data?.risk_band_es).toBe('baja')
  })
})
