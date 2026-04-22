import { describe, it, expect } from 'vitest'
import {
  suggestClientePatterns,
  mode,
  clampLimit,
  MAX_LIMIT,
} from '../suggest'

// ---- minimal chainable fake supabase client ----

type Row = Record<string, unknown>
type Fixture = Record<string, Row[]>

interface Filter {
  eq?: Record<string, unknown>
  inCol?: { col: string; values: unknown[] }
  orRaw?: string
  limit?: number
}

function makeFrom(fixture: Fixture) {
  return function from(table: string) {
    const rows = fixture[table] ?? []
    const filter: Filter = {}

    const api = {
      select() {
        return api
      },
      eq(col: string, val: unknown) {
        filter.eq = { ...(filter.eq ?? {}), [col]: val }
        return api
      },
      in(col: string, values: unknown[]) {
        filter.inCol = { col, values }
        return api
      },
      or(raw: string) {
        filter.orRaw = raw
        return api
      },
      order() {
        return api
      },
      limit(n: number) {
        filter.limit = n
        return api
      },
      then(resolve: (r: { data: Row[]; error: null }) => unknown) {
        let out = rows.slice()
        if (filter.eq) {
          for (const [k, v] of Object.entries(filter.eq)) {
            out = out.filter((r) => r[k] === v)
          }
        }
        if (filter.inCol) {
          const { col, values } = filter.inCol
          const set = new Set(values)
          out = out.filter((r) => set.has(r[col]))
        }
        if (filter.orRaw) {
          // crude ilike-prefix handling for "col.ilike.PREFIX%,col2.ilike..."
          const clauses = filter.orRaw.split(',')
          out = out.filter((r) =>
            clauses.some((c) => {
              const m = c.match(/^(\w+)\.ilike\.(.+)%$/)
              if (!m) return false
              const [, col, pfx] = m
              const val = r[col]
              return typeof val === 'string' && val.toLowerCase().startsWith(pfx.toLowerCase())
            }),
          )
        }
        if (filter.limit != null) out = out.slice(0, filter.limit)
        return Promise.resolve(resolve({ data: out, error: null }))
      },
    }
    return api
  }
}

describe('V1.5 F15 · suggestClientePatterns — pure helpers', () => {
  it('mode: returns most frequent non-null string, null on empty', () => {
    expect(mode(['a', 'b', 'a', 'c', 'a'])).toBe('a')
    expect(mode([null, undefined, ''])).toBeNull()
    expect(mode<string>([])).toBeNull()
  })

  it('clampLimit: clamps into [1, MAX_LIMIT], defaults to 5', () => {
    expect(clampLimit(undefined)).toBe(5)
    expect(clampLimit(0)).toBe(1)
    expect(clampLimit(3)).toBe(3)
    expect(clampLimit(99)).toBe(MAX_LIMIT)
    expect(clampLimit(Number.NaN)).toBe(5)
  })
})

describe('V1.5 F15 · suggestClientePatterns — aggregation', () => {
  it('returns [] for prefix under 3 chars', async () => {
    const sb = { from: makeFrom({}) }
    const out = await suggestClientePatterns(sb, null, 'ev')
    expect(out).toEqual([])
  })

  it('matches cliente by prefix and aggregates fracción, supplier, UMC, avg value', async () => {
    // Fixture reflects REAL schema (post-M15 sweep):
    //   companies: name (not razon_social), no updated_at → created_at
    //   traficos: trafico (not cve_trafico)
    //   globalpc_facturas: folio, cve_trafico, cve_proveedor, valor_comercial,
    //                       moneda + separate globalpc_proveedores join for nombre
    //   globalpc_partidas: folio + cve_producto (no cve_trafico/fraccion/umc)
    //   globalpc_productos: cve_producto → fraccion + umt (the real enrichment)
    const sb = {
      from: makeFrom({
        companies: [
          {
            company_id: 'evco',
            name: 'EVCO Plastics de México',
            clave_cliente: '9254',
            rfc: 'EVC010101AAA',
            created_at: '2026-04-10T00:00:00Z',
          },
        ],
        traficos: [
          {
            id: 't1',
            trafico: 'T-1',
            created_at: '2026-04-08T00:00:00Z',
            assigned_to_operator_id: 'op-eduardo',
            company_id: 'evco',
          },
          {
            id: 't2',
            trafico: 'T-2',
            created_at: '2026-04-01T00:00:00Z',
            assigned_to_operator_id: 'op-eduardo',
            company_id: 'evco',
          },
          {
            id: 't3',
            trafico: 'T-3',
            created_at: '2026-03-25T00:00:00Z',
            assigned_to_operator_id: 'op-claudia',
            company_id: 'evco',
          },
        ],
        globalpc_facturas: [
          { folio: 101, cve_trafico: 'T-1', cve_proveedor: 'PRV_1', valor_comercial: 40000, moneda: 'USD', company_id: 'evco' },
          { folio: 102, cve_trafico: 'T-2', cve_proveedor: 'PRV_1', valor_comercial: 44000, moneda: 'USD', company_id: 'evco' },
          { folio: 103, cve_trafico: 'T-3', cve_proveedor: 'PRV_2', valor_comercial: 42000, moneda: 'MXN', company_id: 'evco' },
        ],
        globalpc_partidas: [
          { folio: 101, cve_producto: 'SKU_A', company_id: 'evco' },
          { folio: 102, cve_producto: 'SKU_A', company_id: 'evco' },
          { folio: 103, cve_producto: 'SKU_B', company_id: 'evco' },
        ],
        globalpc_productos: [
          { cve_producto: 'SKU_A', fraccion: '3902.10.01', umt: 'KG', company_id: 'evco' },
          { cve_producto: 'SKU_B', fraccion: '3901.20.01', umt: 'KG', company_id: 'evco' },
        ],
        globalpc_proveedores: [
          { cve_proveedor: 'PRV_1', nombre: 'Celanese', company_id: 'evco' },
          { cve_proveedor: 'PRV_2', nombre: 'Dow', company_id: 'evco' },
        ],
        operators: [{ id: 'op-eduardo', full_name: 'Eduardo Méndez' }],
      }),
    }

    const out = await suggestClientePatterns(sb, null, 'EVC', 5)
    expect(out).toHaveLength(1)
    const s = out[0]
    expect(s.clienteId).toBe('evco')
    expect(s.nombre).toBe('EVCO Plastics de México')
    expect(s.rfc).toBe('EVC010101AAA')
    expect(s.lastTraficoAt).toBe('2026-04-08T00:00:00Z')
    expect(s.diasDesdeUltimo).toBeGreaterThanOrEqual(0)
    expect(s.avgValue).toBe(42000) // (40000+44000+42000)/3
    expect(s.currency).toBe('USD') // mode — 2× USD vs 1× MXN
    expect(s.typicalFraccion).toBe('3902.10.01')
    expect(s.typicalOperator).toEqual({ id: 'op-eduardo', name: 'Eduardo Méndez' })
    expect(s.typicalSupplier).toBe('Celanese')
    expect(s.typicalUmc).toBe('KG')
    expect(s.traficoCountTotal).toBe(3)
  })

  it('returns null fields gracefully when cliente has zero history', async () => {
    const sb = {
      from: makeFrom({
        companies: [
          {
            company_id: 'mafesa',
            name: 'MAFESA',
            clave_cliente: '4598',
            rfc: 'MAF010101BBB',
            created_at: '2026-04-01T00:00:00Z',
          },
        ],
        traficos: [],
        globalpc_facturas: [],
        globalpc_partidas: [],
        operators: [],
      }),
    }

    const out = await suggestClientePatterns(sb, null, 'MAF')
    expect(out).toHaveLength(1)
    const s = out[0]
    expect(s.clienteId).toBe('mafesa')
    expect(s.lastTraficoAt).toBeNull()
    expect(s.diasDesdeUltimo).toBeNull()
    expect(s.avgValue).toBeNull()
    expect(s.currency).toBeNull()
    expect(s.typicalFraccion).toBeNull()
    expect(s.typicalOperator).toBeNull()
    expect(s.typicalSupplier).toBeNull()
    expect(s.typicalUmc).toBeNull()
    expect(s.traficoCountTotal).toBe(0)
  })

  it('scopes by companyId when provided (cliente-role portal)', async () => {
    const fixture: Fixture = {
      companies: [
        {
          company_id: 'evco',
          name: 'EVCO Plastics',
          clave_cliente: '9254',
          rfc: 'EVC010101AAA',
          created_at: '2026-04-10T00:00:00Z',
        },
        {
          company_id: 'evolent',
          name: 'Evolent SA',
          clave_cliente: '1000',
          rfc: 'EVO010101CCC',
          created_at: '2026-04-09T00:00:00Z',
        },
      ],
      traficos: [],
      globalpc_facturas: [],
      globalpc_partidas: [],
      operators: [],
    }
    const sb = { from: makeFrom(fixture) }
    const out = await suggestClientePatterns(sb, 'evco', 'EV', 5)
    // Even though prefix matches both, companyId scope pins to evco.
    // prefix < 3 guard short-circuits; use 3-char prefix instead.
    expect(out).toEqual([])

    const out2 = await suggestClientePatterns(sb, 'evco', 'EVC', 5)
    expect(out2).toHaveLength(1)
    expect(out2[0].clienteId).toBe('evco')
  })
})
