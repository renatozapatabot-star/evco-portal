/* eslint-disable @typescript-eslint/no-explicit-any -- this test stubs
   the Supabase chainable query-builder; typing the mock faithfully
   would duplicate PostgrestQueryBuilder and add no test value. */

/**
 * Tenant-isolation contract test for computeARAging — the primitive
 * that powers /mi-cuenta. Per .claude/rules/client-accounting-ethics.md,
 * cross-tenant leakage here is a SEV-2; this suite is that regression
 * fence.
 *
 * The `isolation` path:
 *   companyId='evco'
 *     → companies lookup resolves clave_cliente='9254'
 *     → econta_cartera filtered by cve_cliente='9254'
 *     → only EVCO rows returned
 *
 * Null companyId is the broker-aggregate path (no clave filter).
 */

import { describe, it, expect } from 'vitest'
import { computeARAging } from '../aging'

type CarteraRow = {
  id: string | number
  consecutivo: string | null
  referencia: string | null
  fecha: string | null
  fecha_vencimiento: string | null
  importe: number | null
  saldo: number | null
  moneda: string | null
  cve_cliente: string | null
  tipo: string | null
}

function stubSupabase(opts: {
  companyLookups?: Record<string, string | null> // company_id → clave_cliente
  cartera?: CarteraRow[]
  carteraByClave?: Record<string, CarteraRow[]>
  carteraError?: Error | null
}) {
  const lookups = opts.companyLookups ?? {}
  const byClave = opts.carteraByClave ?? null
  const defaultCartera = opts.cartera ?? []

  let capturedClaveFilter: string | null = null
  let capturedSaldoFilter = false

  const builder: any = {
    _table: null as string | null,
    _eqFilters: {} as Record<string, unknown>,
    from(table: string) {
      const b = { ...builder, _table: table, _eqFilters: {} }
      return b
    },
    select() { return this },
    gt(col: string) {
      if (col === 'saldo') capturedSaldoFilter = true
      return this
    },
    limit() { return this },
    eq(col: string, val: unknown) {
      this._eqFilters[col] = val
      if (this._table === 'econta_cartera' && col === 'cve_cliente') {
        capturedClaveFilter = String(val)
      }
      return this
    },
    maybeSingle() {
      if (this._table === 'companies') {
        const companyId = this._eqFilters.company_id as string | undefined
        const clave = companyId ? lookups[companyId] ?? null : null
        return Promise.resolve({ data: clave === null ? null : { clave_cliente: clave }, error: null })
      }
      return Promise.resolve({ data: null, error: null })
    },
    then(onF: any, onR: any) {
      if (this._table === 'econta_cartera') {
        if (opts.carteraError) {
          return Promise.resolve({ data: null, error: opts.carteraError }).then(onF, onR)
        }
        const data = byClave
          ? (capturedClaveFilter ? byClave[capturedClaveFilter] ?? [] : Object.values(byClave).flat())
          : defaultCartera
        return Promise.resolve({ data, error: null }).then(onF, onR)
      }
      return Promise.resolve({ data: null, error: null }).then(onF, onR)
    },
  }
  return {
    client: { from: builder.from.bind(builder) } as any,
    getCapturedClaveFilter: () => capturedClaveFilter,
    getCapturedSaldoFilter: () => capturedSaldoFilter,
  }
}

const makeRow = (overrides: Partial<CarteraRow>): CarteraRow => ({
  id: overrides.id ?? 'row-1',
  consecutivo: overrides.consecutivo ?? null,
  referencia: overrides.referencia ?? null,
  fecha: overrides.fecha ?? null,
  fecha_vencimiento: overrides.fecha_vencimiento ?? null,
  importe: overrides.importe ?? null,
  saldo: overrides.saldo ?? null,
  moneda: overrides.moneda ?? null,
  cve_cliente: overrides.cve_cliente ?? null,
  tipo: overrides.tipo ?? null,
})

describe('computeARAging · tenant isolation contract', () => {
  it('resolves companyId slug → clave_cliente and filters cartera by that clave', async () => {
    const stub = stubSupabase({
      companyLookups: { evco: '9254', mafesa: '9999' },
      carteraByClave: {
        '9254': [
          makeRow({ id: 1, saldo: 1000, fecha_vencimiento: '2026-04-01', cve_cliente: '9254' }),
        ],
        '9999': [
          makeRow({ id: 2, saldo: 5000, fecha_vencimiento: '2026-04-01', cve_cliente: '9999' }),
        ],
      },
    })

    const result = await computeARAging(stub.client, 'evco')
    expect(stub.getCapturedClaveFilter()).toBe('9254')
    expect(result.count).toBe(1)
    expect(result.total).toBe(1000)
  })

  it('returns empty when company has no clave_cliente (prevents cross-tenant fallback)', async () => {
    const stub = stubSupabase({
      companyLookups: { newclient: null }, // company row exists but no clave
      carteraByClave: { '9254': [makeRow({ id: 1, saldo: 99999, cve_cliente: '9254' })] },
    })
    const result = await computeARAging(stub.client, 'newclient')
    expect(result.count).toBe(0)
    expect(result.total).toBe(0)
    // The econta_cartera query must NOT have fired since no clave was resolved.
    expect(stub.getCapturedClaveFilter()).toBeNull()
  })

  it('returns empty when company_id does not resolve at all', async () => {
    const stub = stubSupabase({
      companyLookups: {}, // unknown company
      carteraByClave: { '9254': [makeRow({ id: 1, saldo: 99999, cve_cliente: '9254' })] },
    })
    const result = await computeARAging(stub.client, 'unknown-tenant')
    expect(result.count).toBe(0)
    expect(stub.getCapturedClaveFilter()).toBeNull()
  })

  it('null companyId → broker aggregate without clave filter', async () => {
    const stub = stubSupabase({
      cartera: [
        makeRow({ id: 1, saldo: 1000, fecha_vencimiento: '2026-04-01', cve_cliente: '9254' }),
        makeRow({ id: 2, saldo: 5000, fecha_vencimiento: '2026-04-01', cve_cliente: '9999' }),
      ],
    })
    const result = await computeARAging(stub.client, null)
    expect(stub.getCapturedClaveFilter()).toBeNull()
    expect(result.count).toBe(2)
    expect(result.total).toBe(6000)
  })

  it('classifies days into 0-30 / 31-60 / 61-90 / 90+ buckets correctly', async () => {
    const today = new Date()
    const daysAgo = (n: number) => new Date(today.getTime() - n * 86_400_000).toISOString().slice(0, 10)
    const stub = stubSupabase({
      companyLookups: { evco: '9254' },
      carteraByClave: {
        '9254': [
          makeRow({ id: 1, saldo: 100, fecha_vencimiento: daysAgo(10), cve_cliente: '9254' }),  // 0-30
          makeRow({ id: 2, saldo: 200, fecha_vencimiento: daysAgo(45), cve_cliente: '9254' }),  // 31-60
          makeRow({ id: 3, saldo: 300, fecha_vencimiento: daysAgo(75), cve_cliente: '9254' }),  // 61-90
          makeRow({ id: 4, saldo: 400, fecha_vencimiento: daysAgo(120), cve_cliente: '9254' }), // 90+
        ],
      },
    })
    const result = await computeARAging(stub.client, 'evco')
    expect(result.count).toBe(4)
    expect(result.total).toBe(1000)
    const bucketMap = Object.fromEntries(result.byBucket.map(b => [b.bucket, { count: b.count, amount: b.amount }]))
    expect(bucketMap['0-30']).toEqual({ count: 1, amount: 100 })
    expect(bucketMap['31-60']).toEqual({ count: 1, amount: 200 })
    expect(bucketMap['61-90']).toEqual({ count: 1, amount: 300 })
    expect(bucketMap['90+']).toEqual({ count: 1, amount: 400 })
  })

  it('uses fecha + 30 days as aging anchor when fecha_vencimiento is null', async () => {
    const today = new Date()
    const fecha = new Date(today.getTime() - 100 * 86_400_000).toISOString().slice(0, 10)
    // fecha = 100 days ago → anchor = fecha + 30 = 70 days ago → 61-90 bucket
    const stub = stubSupabase({
      companyLookups: { evco: '9254' },
      carteraByClave: {
        '9254': [
          makeRow({ id: 1, saldo: 500, fecha, fecha_vencimiento: null, cve_cliente: '9254' }),
        ],
      },
    })
    const result = await computeARAging(stub.client, 'evco')
    const b = result.byBucket.find(x => x.bucket === '61-90')!
    expect(b.count).toBe(1)
    expect(b.amount).toBe(500)
  })

  it('handles cartera query error by returning empty result (no throw)', async () => {
    const stub = stubSupabase({
      companyLookups: { evco: '9254' },
      carteraError: new Error('connection reset'),
    })
    const result = await computeARAging(stub.client, 'evco')
    expect(result.count).toBe(0)
    expect(result.total).toBe(0)
  })

  it('computes topDebtors sorted by amount descending, max 5', async () => {
    const stub = stubSupabase({
      companyLookups: { evco: '9254' },
      carteraByClave: {
        '9254': [
          makeRow({ id: 1, saldo: 100, referencia: 'R1', fecha_vencimiento: '2026-04-01', cve_cliente: '9254' }),
          makeRow({ id: 2, saldo: 500, referencia: 'R2', fecha_vencimiento: '2026-04-01', cve_cliente: '9254' }),
          makeRow({ id: 3, saldo: 300, referencia: 'R3', fecha_vencimiento: '2026-04-01', cve_cliente: '9254' }),
          makeRow({ id: 4, saldo: 200, referencia: 'R4', fecha_vencimiento: '2026-04-01', cve_cliente: '9254' }),
          makeRow({ id: 5, saldo: 50, referencia: 'R5', fecha_vencimiento: '2026-04-01', cve_cliente: '9254' }),
          makeRow({ id: 6, saldo: 400, referencia: 'R6', fecha_vencimiento: '2026-04-01', cve_cliente: '9254' }),
        ],
      },
    })
    const result = await computeARAging(stub.client, 'evco')
    expect(result.topDebtors).toHaveLength(5)
    expect(result.topDebtors.map(d => d.amount)).toEqual([500, 400, 300, 200, 100])
    expect(result.topDebtors[0].label).toBe('R2')
  })
})
