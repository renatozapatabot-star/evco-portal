/**
 * Unit tests for `fetchAnexo24Rows` — the single source of truth for
 * the /anexo-24 surface and every Anexo 24 export.
 *
 * Scope: the join semantics + tenant isolation + T-MEC derivation +
 * embarque construction + truncation flag. Active-parts filter is
 * mocked to a no-op (returns full set) so we test the row pipeline
 * without re-testing the helper.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

/* eslint-disable @typescript-eslint/no-explicit-any -- mocks intentionally
   loose; faithful typing would duplicate PostgrestQueryBuilder. */

vi.mock('@/lib/anexo24/active-parts', () => ({
  // Empty set means "no filter applied" — fetchRows treats that as a
  // brand-new tenant, NOT as "exclude everything". That's the contract.
  getActiveCveProductos: async () => ({ cves: new Set<string>(), partidaCount: 0 }),
  activeCvesArray: (s: Set<string>) => Array.from(s),
}))

import { fetchAnexo24Rows } from '../fetchRows'

interface QueryStep {
  table: string
  filters: Array<{ op: string; col: string; value: unknown }>
  data: unknown[]
}

interface MockState {
  steps: QueryStep[]
  data: Record<string, unknown[]>
}

function makeSupabase(data: Record<string, unknown[]>): { client: any; observed: QueryStep[] } {
  const observed: QueryStep[] = []
  const client = {
    from: (table: string) => {
      const step: QueryStep = { table, filters: [], data: [] }
      const chain: any = {
        select: () => chain,
        eq: (col: string, value: unknown) => { step.filters.push({ op: 'eq', col, value }); return chain },
        gte: (col: string, value: unknown) => { step.filters.push({ op: 'gte', col, value }); return chain },
        lte: (col: string, value: unknown) => { step.filters.push({ op: 'lte', col, value }); return chain },
        in: (col: string, value: unknown) => { step.filters.push({ op: 'in', col, value }); return chain },
        not: (col: string, op: string, value: unknown) => { step.filters.push({ op: `not_${op}`, col, value }); return chain },
        order: () => chain,
        limit: () => chain,
        // Promise-then for awaited queries
        then: (resolve: any) => {
          step.data = data[table] ?? []
          observed.push(step)
          resolve({ data: step.data, error: null })
        },
        // For .maybeSingle() callers
        maybeSingle: () => {
          step.data = data[table] ?? []
          observed.push(step)
          return Promise.resolve({ data: step.data[0] ?? null, error: null })
        },
      }
      return chain
    },
  }
  return { client, observed }
}

const evcoTraficos = [
  {
    trafico: 'Y4333',
    pedimento: '262435966500064',
    fecha_pago: '2026-01-20',
    regimen: 'ITE',
    aduana: '240',
    pais_procedencia: 'USA',
    proveedores: null,
  },
  {
    trafico: 'Y4339',
    pedimento: '262435966500072',
    fecha_pago: '2026-01-12',
    regimen: 'IMD',
    aduana: '240',
    pais_procedencia: 'MEX',
    proveedores: null,
  },
  {
    trafico: 'Y4399',
    pedimento: '262435966500099',
    fecha_pago: '2026-02-15',
    regimen: 'A1',  // not T-MEC eligible
    aduana: '240',
    pais_procedencia: 'CHN',
    proveedores: null,
  },
]

const evcoFacturas = [
  { folio: 100, cve_trafico: 'Y4333', numero: '2603W007', cve_proveedor: 'P1' },
  { folio: 200, cve_trafico: 'Y4339', numero: '4496417', cve_proveedor: 'P2' },
  { folio: 300, cve_trafico: 'Y4399', numero: '0216860', cve_proveedor: 'P3' },
]

const evcoPartidas = [
  { id: 1, folio: 100, cve_producto: 'PROD-A', cantidad: 1600, precio_unitario: 1.46, pais_origen: 'USA', numero_item: 1 },
  { id: 2, folio: 200, cve_producto: 'PROD-B', cantidad: 275, precio_unitario: 18.21, pais_origen: 'MEX', numero_item: 1 },
  { id: 3, folio: 300, cve_producto: 'PROD-C', cantidad: 100, precio_unitario: 5.00, pais_origen: 'CHN', numero_item: 1 },
]

const evcoProductos = [
  { cve_producto: 'PROD-A', descripcion: 'PIEZAS DE CAUCHO', fraccion: '3919100100', umt: 'KGM' },
  { cve_producto: 'PROD-B', descripcion: 'RESINA DE POLICARBONATO', fraccion: '3907400499', umt: 'KGM' },
  { cve_producto: 'PROD-C', descripcion: 'TORNILLOS DE ACERO', fraccion: '7318159000', umt: 'PZA' },
]

const evcoProveedores = [
  { cve_proveedor: 'P1', nombre: 'JSPA' },
  { cve_proveedor: 'P2', nombre: 'BAMB' },
  { cve_proveedor: 'P3', nombre: 'COVESTRO' },
]

describe('fetchAnexo24Rows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the 13-column row shape with consecutivo numbering', async () => {
    const { client } = makeSupabase({
      companies: [{ clave_cliente: '9254' }],
      traficos: evcoTraficos,
      globalpc_facturas: evcoFacturas,
      globalpc_partidas: evcoPartidas,
      globalpc_productos: evcoProductos,
      globalpc_proveedores: evcoProveedores,
    })

    const result = await fetchAnexo24Rows({
      supabase: client,
      companyId: 'evco',
      dateFrom: '2026-01-01',
      dateTo: '2026-04-30',
    })

    expect(result.rows).toHaveLength(3)
    expect(result.truncated).toBe(false)
    expect(result.partidaCount).toBe(3)

    // Consecutivo flows chronologically by fecha (ascending).
    expect(result.rows.map((r) => r.consecutivo)).toEqual([1, 2, 3])

    // Row 1 — earliest date (2026-01-12) → trafico Y4339 → IMD → tmec true
    const first = result.rows[0]
    expect(first.embarque).toBe('9254-Y4339')
    expect(first.regimen).toBe('IMD')
    expect(first.tmec).toBe(true)
    expect(first.proveedor).toBe('BAMB')
    expect(first.descripcion).toBe('RESINA DE POLICARBONATO')
  })

  it('embarque is built as `<clave>-<trafico>` from companies.clave_cliente', async () => {
    const { client } = makeSupabase({
      companies: [{ clave_cliente: '9999' }],
      traficos: [evcoTraficos[0]],
      globalpc_facturas: [evcoFacturas[0]],
      globalpc_partidas: [evcoPartidas[0]],
      globalpc_productos: [evcoProductos[0]],
      globalpc_proveedores: [evcoProveedores[0]],
    })

    const result = await fetchAnexo24Rows({
      supabase: client,
      companyId: 'evco',
      dateFrom: '2026-01-01',
      dateTo: '2026-04-30',
    })

    expect(result.rows[0].embarque).toBe('9999-Y4333')
  })

  it('embarque falls back to the bare trafico when clave_cliente is null', async () => {
    const { client } = makeSupabase({
      companies: [{ clave_cliente: null }],
      traficos: [evcoTraficos[0]],
      globalpc_facturas: [evcoFacturas[0]],
      globalpc_partidas: [evcoPartidas[0]],
      globalpc_productos: [evcoProductos[0]],
      globalpc_proveedores: [evcoProveedores[0]],
    })

    const result = await fetchAnexo24Rows({
      supabase: client,
      companyId: 'evco',
      dateFrom: '2026-01-01',
      dateTo: '2026-04-30',
    })

    expect(result.rows[0].embarque).toBe('Y4333')
  })

  it('T-MEC derivation: ITE/ITR/IMD → true; A1/null → false', async () => {
    const { client } = makeSupabase({
      companies: [{ clave_cliente: '9254' }],
      traficos: evcoTraficos,
      globalpc_facturas: evcoFacturas,
      globalpc_partidas: evcoPartidas,
      globalpc_productos: evcoProductos,
      globalpc_proveedores: evcoProveedores,
    })

    const result = await fetchAnexo24Rows({
      supabase: client,
      companyId: 'evco',
      dateFrom: '2026-01-01',
      dateTo: '2026-04-30',
    })

    const byEmbarque = new Map(result.rows.map((r) => [r.embarque, r]))
    expect(byEmbarque.get('9254-Y4333')?.tmec).toBe(true)   // ITE
    expect(byEmbarque.get('9254-Y4339')?.tmec).toBe(true)   // IMD
    expect(byEmbarque.get('9254-Y4399')?.tmec).toBe(false)  // A1
  })

  it('every supabase step filters by company_id (tenant isolation)', async () => {
    const { client, observed } = makeSupabase({
      companies: [{ clave_cliente: '9254' }],
      traficos: evcoTraficos,
      globalpc_facturas: evcoFacturas,
      globalpc_partidas: evcoPartidas,
      globalpc_productos: evcoProductos,
      globalpc_proveedores: evcoProveedores,
    })

    await fetchAnexo24Rows({
      supabase: client,
      companyId: 'evco',
      dateFrom: '2026-01-01',
      dateTo: '2026-04-30',
    })

    // Companies lookup uses company_id; the five join steps must all
    // apply eq('company_id', 'evco').
    const tenantScoped = ['traficos', 'globalpc_facturas', 'globalpc_partidas', 'globalpc_productos', 'globalpc_proveedores']
    for (const table of tenantScoped) {
      const step = observed.find((s) => s.table === table)
      expect(step, `step for ${table} must be observed`).toBeDefined()
      const companyFilter = step!.filters.find((f) => f.op === 'eq' && f.col === 'company_id')
      expect(companyFilter, `${table} must filter eq('company_id', companyId)`).toBeDefined()
      expect(companyFilter!.value).toBe('evco')
    }
  })

  it('returns empty rows when no traficos in the window', async () => {
    const { client } = makeSupabase({
      companies: [{ clave_cliente: '9254' }],
      traficos: [],
      globalpc_facturas: [],
      globalpc_partidas: [],
      globalpc_productos: [],
      globalpc_proveedores: [],
    })

    const result = await fetchAnexo24Rows({
      supabase: client,
      companyId: 'evco',
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
    })

    expect(result.rows).toEqual([])
    expect(result.truncated).toBe(false)
    expect(result.partidaCount).toBe(0)
  })

  it('returns empty rows + no error when companyId is missing', async () => {
    const { client } = makeSupabase({})

    const result = await fetchAnexo24Rows({
      supabase: client,
      companyId: '',
      dateFrom: '2026-01-01',
      dateTo: '2026-04-30',
    })

    expect(result.rows).toEqual([])
    expect(result.truncated).toBe(false)
    expect(result.partidaCount).toBe(0)
  })

  it('skips rows when the partida points at a missing factura/trafico', async () => {
    const { client } = makeSupabase({
      companies: [{ clave_cliente: '9254' }],
      traficos: [evcoTraficos[0]],
      globalpc_facturas: [evcoFacturas[0]],
      globalpc_partidas: [
        evcoPartidas[0],
        { ...evcoPartidas[1], folio: 999 }, // folio 999 has no matching factura
      ],
      globalpc_productos: evcoProductos,
      globalpc_proveedores: [evcoProveedores[0]],
    })

    const result = await fetchAnexo24Rows({
      supabase: client,
      companyId: 'evco',
      dateFrom: '2026-01-01',
      dateTo: '2026-04-30',
    })

    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].embarque).toBe('9254-Y4333')
  })

  it('valor_usd is computed as cantidad × precio_unitario, rounded to 2dp', async () => {
    const { client } = makeSupabase({
      companies: [{ clave_cliente: '9254' }],
      traficos: [evcoTraficos[0]],
      globalpc_facturas: [evcoFacturas[0]],
      globalpc_partidas: [{ id: 1, folio: 100, cve_producto: 'PROD-A', cantidad: 1500, precio_unitario: 8.2289, pais_origen: 'USA', numero_item: 1 }],
      globalpc_productos: [evcoProductos[0]],
      globalpc_proveedores: [evcoProveedores[0]],
    })

    const result = await fetchAnexo24Rows({
      supabase: client,
      companyId: 'evco',
      dateFrom: '2026-01-01',
      dateTo: '2026-04-30',
    })

    expect(result.rows[0].valor_usd).toBe(12343.35) // 1500 * 8.2289 = 12343.35
  })
})
