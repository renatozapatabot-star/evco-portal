/**
 * Unit tests for resolve-parts.ts — the auto-resolver.
 * Covers verdict logic, tenant isolation, and the four ground-truth
 * tables that feed resolution.
 */
import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  decideVerdict,
  resolveInvoiceParts,
  type ResolveSourceRef,
  type ResolveContext,
} from '../resolve-parts'

// ── decideVerdict: pure logic ─────────────────────────────────

describe('decideVerdict', () => {
  const anexo24Src: ResolveSourceRef = {
    table: 'anexo24',
    fraccion: '9603.90.99',
    nico: null,
    descripcion: null,
    confidence: 1.0,
    cross_tenant: false,
    detail: null,
  }

  const globalpcSrc: ResolveSourceRef = {
    table: 'globalpc_productos',
    fraccion: '9603.90.99',
    nico: null,
    descripcion: null,
    confidence: 0.7,
    cross_tenant: false,
    detail: null,
  }

  it('returns needs_classification when no sources', () => {
    expect(decideVerdict([])).toEqual({
      verdict: 'needs_classification',
      fraccion: null,
      nico: null,
      confidence: 0,
    })
  })

  it('returns resolved with best-confidence winner when all sources agree', () => {
    const result = decideVerdict([globalpcSrc, anexo24Src])
    expect(result.verdict).toBe('resolved')
    expect(result.fraccion).toBe('9603.90.99')
    expect(result.confidence).toBe(1.0) // anexo24 wins
  })

  it('returns disputed when sources disagree on fracción', () => {
    const result = decideVerdict([
      anexo24Src,
      { ...globalpcSrc, fraccion: '9603.90.10' }, // different fracción
    ])
    expect(result.verdict).toBe('disputed')
  })

  it('ignores sources with null fracción', () => {
    const result = decideVerdict([
      { ...anexo24Src, fraccion: null },
      globalpcSrc,
    ])
    expect(result.verdict).toBe('resolved')
    expect(result.fraccion).toBe('9603.90.99')
  })
})

// ── resolveInvoiceParts: integration with mocked Supabase ─────

type MockResult<T> = { data: T[] | null; error: null | { message: string } }

function makeMockSupabase(
  tables: Record<string, unknown[]>,
): { client: SupabaseClient; calls: { table: string; filters: Record<string, unknown> }[] } {
  const calls: { table: string; filters: Record<string, unknown> }[] = []

  const client = {
    from(tableName: string) {
      const filters: Record<string, unknown> = {}
      calls.push({ table: tableName, filters })
      const chain: Record<string, unknown> = {}

      const finish = async <T>(): Promise<MockResult<T>> => {
        let rows = (tables[tableName] ?? []) as T[]
        // naive filter engine: apply filters collected on the chain
        for (const [key, value] of Object.entries(filters)) {
          if (key === 'eq') {
            const pairs = value as [string, unknown][]
            for (const [col, val] of pairs) {
              rows = rows.filter((r) => (r as Record<string, unknown>)[col] === val)
            }
          } else if (key === 'in') {
            const [col, vals] = value as [string, unknown[]]
            rows = rows.filter((r) =>
              (vals as unknown[]).includes((r as Record<string, unknown>)[col]),
            )
          } else if (key === 'not_null') {
            const col = value as string
            rows = rows.filter((r) => (r as Record<string, unknown>)[col] != null)
          }
        }
        return { data: rows, error: null }
      }

      chain.select = () => chain
      chain.in = (col: string, vals: unknown[]) => {
        filters.in = [col, vals]
        return chain
      }
      chain.eq = (col: string, val: unknown) => {
        const pairs = (filters.eq as [string, unknown][] | undefined) ?? []
        pairs.push([col, val])
        filters.eq = pairs
        return chain
      }
      chain.not = (col: string, _op: string, _val: unknown) => {
        filters.not_null = col
        return chain
      }
      chain.order = () => chain
      chain.limit = () => chain
      chain.then = (resolve: (v: MockResult<unknown>) => void) => finish().then(resolve)
      return chain
    },
  } as unknown as SupabaseClient

  return { client, calls }
}

const EVCO = 'evco-company-id'
const MAFESA = 'mafesa-company-id'
const CLIENT_CTX: ResolveContext = { companyId: EVCO, role: 'client' }
const ADMIN_CTX: ResolveContext = { companyId: 'admin', role: 'admin' }

describe('resolveInvoiceParts', () => {
  it('resolves a part with an Anexo 24 match at confidence 1.0', async () => {
    const { client } = makeMockSupabase({
      anexo24_numeros_parte: [
        { company_id: EVCO, numero_parte: '18MB', fraccion: '9603.90.99', descripcion: 'CEPILLOS' },
      ],
      oca_database: [],
      classification_log: [],
      globalpc_productos: [],
    })

    const result = await resolveInvoiceParts(
      client,
      [{ item_no: '18MB', description: 'CLEANING BRUSHES' }],
      CLIENT_CTX,
    )
    expect(result).toHaveLength(1)
    expect(result[0].verdict).toBe('resolved')
    expect(result[0].fraccion).toBe('9603.90.99')
    expect(result[0].confidence).toBe(1.0)
    expect(result[0].sources[0].table).toBe('anexo24')
  })

  it('marks a part needs_classification when no source matches', async () => {
    const { client } = makeMockSupabase({
      anexo24_numeros_parte: [],
      oca_database: [],
      classification_log: [],
      globalpc_productos: [],
    })

    const result = await resolveInvoiceParts(
      client,
      [{ item_no: 'NEWPART', description: 'Something new' }],
      CLIENT_CTX,
    )
    expect(result[0].verdict).toBe('needs_classification')
    expect(result[0].sources).toEqual([])
  })

  it('promotes supertito_agreed classification_log matches to 0.9 confidence', async () => {
    const { client } = makeMockSupabase({
      anexo24_numeros_parte: [],
      oca_database: [],
      classification_log: [
        { client_id: EVCO, numero_parte: '28MB', fraccion_assigned: '9603.90.99', supertito_agreed: true, ts: '2026-03-15' },
      ],
      globalpc_productos: [],
    })
    const result = await resolveInvoiceParts(client, [{ item_no: '28MB', description: null }], CLIENT_CTX)
    expect(result[0].verdict).toBe('resolved')
    expect(result[0].confidence).toBe(0.9)
    expect(result[0].sources[0].detail).toBe('Revisado por Tito')
  })

  it('tenant isolation — client role NEVER sees cross-tenant matches', async () => {
    const { client, calls } = makeMockSupabase({
      anexo24_numeros_parte: [
        { company_id: MAFESA, numero_parte: '18MB', fraccion: '9603.90.99', descripcion: 'OTRA' },
      ],
      oca_database: [],
      classification_log: [],
      globalpc_productos: [],
    })
    const result = await resolveInvoiceParts(client, [{ item_no: '18MB', description: null }], CLIENT_CTX)

    // Verdict is needs_classification because the MAFESA row is filtered out for client role
    expect(result[0].verdict).toBe('needs_classification')

    // Sanity: an eq filter on company_id was applied to every query
    const tableCalls = calls.filter((c) => c.table !== '_fake')
    for (const call of tableCalls) {
      const eqPairs = (call.filters.eq as [string, unknown][] | undefined) ?? []
      const hasTenantFilter = eqPairs.some(
        ([col, val]) => (col === 'company_id' || col === 'client_id') && val === EVCO,
      )
      expect(hasTenantFilter).toBe(true)
    }
  })

  it('admin role sees cross-tenant matches marked cross_tenant=true', async () => {
    const { client } = makeMockSupabase({
      anexo24_numeros_parte: [
        { company_id: MAFESA, numero_parte: '18MB', fraccion: '9603.90.99', descripcion: 'MAFESA desc' },
      ],
      oca_database: [],
      classification_log: [],
      globalpc_productos: [],
    })
    const result = await resolveInvoiceParts(client, [{ item_no: '18MB', description: null }], ADMIN_CTX)
    expect(result[0].verdict).toBe('resolved')
    expect(result[0].sources[0].cross_tenant).toBe(true)
  })

  it('flags disputed when Anexo 24 and globalpc disagree on fracción', async () => {
    const { client } = makeMockSupabase({
      anexo24_numeros_parte: [
        { company_id: EVCO, numero_parte: 'TS66', fraccion: '7318.15.99', descripcion: null },
      ],
      oca_database: [],
      classification_log: [],
      globalpc_productos: [
        {
          company_id: EVCO, cve_producto: 'TS66',
          fraccion: '7318.16.06',  // DIFFERENT
          nico: null,
          fraccion_classified_at: '2026-01-01',
          descripcion: null,
        },
      ],
    })
    const result = await resolveInvoiceParts(client, [{ item_no: 'TS66', description: null }], CLIENT_CTX)
    expect(result[0].verdict).toBe('disputed')
    // Winner is anexo24 (higher confidence)
    expect(result[0].fraccion).toBe('7318.15.99')
    expect(result[0].sources).toHaveLength(2)
  })

  it('ignores globalpc rows where fraccion_classified_at is null (not yet classified)', async () => {
    const { client } = makeMockSupabase({
      anexo24_numeros_parte: [],
      oca_database: [],
      classification_log: [],
      globalpc_productos: [
        {
          company_id: EVCO, cve_producto: 'W-5',
          fraccion: '7318.15.99', nico: '99',
          fraccion_classified_at: null, // not yet classified
          descripcion: null,
        },
      ],
    })
    const result = await resolveInvoiceParts(client, [{ item_no: 'W-5', description: null }], CLIENT_CTX)
    expect(result[0].verdict).toBe('needs_classification')
  })

  it('handles empty item_no gracefully (needs_classification, no queries)', async () => {
    const { client } = makeMockSupabase({
      anexo24_numeros_parte: [],
      oca_database: [],
      classification_log: [],
      globalpc_productos: [],
    })
    const result = await resolveInvoiceParts(client, [{ item_no: null, description: 'phantom' }], CLIENT_CTX)
    expect(result[0].verdict).toBe('needs_classification')
    expect(result[0].item_no).toBe('')
  })

  it('degrades gracefully when a table query throws (returns [])', async () => {
    const client = {
      from: vi.fn(() => {
        throw new Error('connection refused')
      }),
    } as unknown as SupabaseClient
    const result = await resolveInvoiceParts(client, [{ item_no: '18MB', description: null }], CLIENT_CTX)
    expect(result[0].verdict).toBe('needs_classification')
  })
})
