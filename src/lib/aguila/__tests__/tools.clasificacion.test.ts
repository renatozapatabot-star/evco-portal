import { describe, it, expect, vi, beforeEach } from 'vitest'

const mkSet = (cves: string[]) => ({ cves: new Set(cves), partidaCount: cves.length })

vi.mock('@/lib/anexo24/active-parts', () => ({
  getActiveCveProductos: vi.fn(async () => mkSet(['ACTIVE-001', 'ACTIVE-002'])),
  activeCvesArray: (s: { cves: Set<string> }) => Array.from(s.cves).sort(),
}))

import { suggestClasificacion } from '../tool-helpers/suggest-clasificacion'
import { getActiveCveProductos } from '@/lib/anexo24/active-parts'

interface Stub { lastTable: string | null; lastEqs: Array<[string, string]>; lastOr: string | null; lastIn: string[] | null }
const stub: Stub = { lastTable: null, lastEqs: [], lastOr: null, lastIn: null }
let productosResponse: { data: unknown; error: unknown } = { data: [], error: null }

function makeSupabase() {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn((c: string, v: string) => { stub.lastEqs.push([c, v]); return chain })
  chain.in = vi.fn((_c: string, v: string[]) => { stub.lastIn = v; return chain })
  chain.not = vi.fn(() => chain)
  chain.or = vi.fn((expr: string) => { stub.lastOr = expr; return chain })
  chain.limit = vi.fn(() => Promise.resolve(productosResponse))
  return {
    from: vi.fn((t: string) => { stub.lastTable = t; return chain }),
  } as unknown as Parameters<typeof suggestClasificacion>[0]
}

beforeEach(() => {
  stub.lastTable = null; stub.lastEqs = []; stub.lastOr = null; stub.lastIn = null
  productosResponse = { data: [], error: null }
})

describe('suggestClasificacion', () => {
  it('refuses invalid companyId', async () => {
    const r = await suggestClasificacion(makeSupabase(), '', { description: 'tornillo' })
    expect(r.success).toBe(false)
    expect(r.error).toBe('invalid_companyId')
  })

  it('refuses empty description', async () => {
    const r = await suggestClasificacion(makeSupabase(), 'evco', { description: '   ' })
    expect(r.success).toBe(false)
    expect(r.error).toBe('invalid_description')
  })

  it('refuses description with only short / stop-word tokens', async () => {
    const r = await suggestClasificacion(makeSupabase(), 'evco', { description: 'de la el' })
    expect(r.success).toBe(false)
    expect(r.error).toBe('description_too_short')
  })

  it('empty allowlist → calm empty, does not query productos', async () => {
    vi.mocked(getActiveCveProductos).mockResolvedValueOnce(mkSet([]))
    const r = await suggestClasificacion(makeSupabase(), 'evco', { description: 'pellets polipropileno' })
    expect(r.success).toBe(true)
    expect(r.data?.suggestions).toEqual([])
    expect(r.data?.note_es).toContain('anexo 24')
    expect(stub.lastTable).toBeNull() // productos never queried
  })

  it('aggregates by fraccion + ranks by count + skips malformed fracciones', async () => {
    productosResponse = {
      data: [
        { fraccion: '3901.20.01', descripcion: 'Pellets PP virgen' },
        { fraccion: '3901.20.01', descripcion: 'Polipropileno homopolímero' },
        { fraccion: '3902.10.01', descripcion: 'PP copolímero' },
        { fraccion: '39012001', descripcion: 'malformed — must be ignored' }, // no dots
      ],
      error: null,
    }
    const r = await suggestClasificacion(makeSupabase(), 'evco', { description: 'pellets polipropileno', topN: 3 })
    expect(r.success).toBe(true)
    expect(stub.lastIn).toEqual(['ACTIVE-001', 'ACTIVE-002']) // allowlist applied
    expect(stub.lastEqs).toContainEqual(['company_id', 'evco'])
    expect(r.data?.suggestions).toHaveLength(2)
    expect(r.data?.suggestions[0]?.fraccion).toBe('3901.20.01')
    expect(r.data?.suggestions[0]?.sample_count).toBe(2)
    expect(r.data?.suggestions[0]?.confidence_pct).toBe(67) // 2/3 rounded
  })

  it('no matches in historial → returns empty with rationale', async () => {
    productosResponse = { data: [], error: null }
    const r = await suggestClasificacion(makeSupabase(), 'evco', { description: 'parte exotica nueva' })
    expect(r.success).toBe(true)
    expect(r.data?.suggestions).toEqual([])
    expect(r.data?.note_es).toContain('Sin coincidencias')
  })
})
