import { describe, it, expect } from 'vitest'
import {
  getVerdeProbabilityForSku,
  getVerdeProbabilityForTrafico,
} from '../predict-by-id'

/**
 * predict-by-id — integration-light tests with a fake supabase.
 * Full end-to-end flow exercised against the pure predictor.
 */

type Row = Record<string, unknown>

function fakeSupabase(fixtures: Record<string, Row[]>) {
  function from(table: string) {
    let rows = fixtures[table] ?? []
    const api = {
      select() { return api },
      eq(col: string, val: unknown) {
        rows = rows.filter((r) => r[col] === val)
        return api
      },
      gte(col: string, val: unknown) {
        rows = rows.filter((r) => {
          const v = r[col]
          return typeof v === 'string' && typeof val === 'string' ? v >= val : true
        })
        return api
      },
      in(col: string, vals: unknown[]) {
        const set = new Set(vals)
        rows = rows.filter((r) => set.has(r[col]))
        return api
      },
      order() { return api },
      limit() { return api },
      then(resolve: (r: { data: Row[]; error: null }) => unknown) {
        return Promise.resolve(resolve({ data: rows, error: null }))
      },
      async maybeSingle() {
        return { data: rows[0] ?? null, error: null }
      },
    }
    return api
  }
  return { from } as unknown as Parameters<typeof getVerdeProbabilityForSku>[0]
}

const NOW = Date.UTC(2026, 3, 21)
function ago(days: number) {
  return new Date(NOW - days * 86_400_000).toISOString()
}

describe('getVerdeProbabilityForSku', () => {
  it('returns null when companyId or cveProducto empty', async () => {
    const sb = fakeSupabase({})
    expect(await getVerdeProbabilityForSku(sb, '', 'SKU-A')).toBeNull()
    expect(await getVerdeProbabilityForSku(sb, 'evco', '')).toBeNull()
  })

  it('returns null when no partidas in window', async () => {
    const sb = fakeSupabase({ globalpc_partidas: [] })
    expect(
      await getVerdeProbabilityForSku(sb, 'evco', 'SKU-A', { now: NOW }),
    ).toBeNull()
  })

  it('returns null when the SKU has no partidas (even with tenant data)', async () => {
    const sb = fakeSupabase({
      globalpc_partidas: [
        { company_id: 'evco', cve_producto: 'OTHER-SKU', cve_proveedor: 'PRV_1', folio: 1, created_at: ago(5) },
      ],
    })
    expect(
      await getVerdeProbabilityForSku(sb, 'evco', 'SKU-A', { now: NOW }),
    ).toBeNull()
  })

  it('returns a prediction with Spanish summary on healthy SKU', async () => {
    const sb = fakeSupabase({
      globalpc_partidas: [
        { company_id: 'evco', cve_producto: 'SKU-HOT', cve_proveedor: 'PRV_1', folio: 100, created_at: ago(5) },
        { company_id: 'evco', cve_producto: 'SKU-HOT', cve_proveedor: 'PRV_1', folio: 101, created_at: ago(10) },
        { company_id: 'evco', cve_producto: 'SKU-HOT', cve_proveedor: 'PRV_1', folio: 102, created_at: ago(15) },
      ],
      globalpc_facturas: [
        { company_id: 'evco', folio: 100, cve_trafico: 'T-1', fecha_facturacion: ago(6) },
        { company_id: 'evco', folio: 101, cve_trafico: 'T-2', fecha_facturacion: ago(11) },
        { company_id: 'evco', folio: 102, cve_trafico: 'T-3', fecha_facturacion: ago(16) },
      ],
      traficos: [
        { company_id: 'evco', trafico: 'T-1', pedimento: null, fecha_cruce: ago(4), fecha_llegada: ago(5), semaforo: 0 },
        { company_id: 'evco', trafico: 'T-2', pedimento: null, fecha_cruce: ago(9), fecha_llegada: ago(10), semaforo: 0 },
        { company_id: 'evco', trafico: 'T-3', pedimento: null, fecha_cruce: ago(14), fecha_llegada: ago(15), semaforo: 0 },
      ],
      globalpc_productos: [
        { company_id: 'evco', cve_producto: 'SKU-HOT', fraccion: '3903.20.01' },
      ],
    })
    const pred = await getVerdeProbabilityForSku(sb, 'evco', 'SKU-HOT', { now: NOW })
    expect(pred).not.toBeNull()
    expect(pred!.cve_producto).toBe('SKU-HOT')
    expect(pred!.probability).toBeGreaterThanOrEqual(0.85)
    expect(pred!.summary).toMatch(/cruzar verde/)
    expect(pred!.band).toBeOneOf(['high', 'medium', 'low'])
    // Must include streak factor since current_verde_streak > 0.
    expect(pred!.factors.find((f) => f.factor === 'streak')).toBeDefined()
  })

  it('returns null if facturas chain has no fecha_cruce (no filed crossings)', async () => {
    const sb = fakeSupabase({
      globalpc_partidas: [
        { company_id: 'evco', cve_producto: 'SKU-A', cve_proveedor: 'PRV_1', folio: 100, created_at: ago(5) },
      ],
      globalpc_facturas: [
        { company_id: 'evco', folio: 100, cve_trafico: 'T-1', fecha_facturacion: ago(6) },
      ],
      // trafico exists but fecha_cruce is null → predictor skips
      traficos: [
        { company_id: 'evco', trafico: 'T-1', pedimento: null, fecha_cruce: null, fecha_llegada: null, semaforo: null },
      ],
    })
    const pred = await getVerdeProbabilityForSku(sb, 'evco', 'SKU-A', { now: NOW })
    expect(pred).toBeNull()
  })
})

describe('getVerdeProbabilityForTrafico', () => {
  it('returns null on empty id', async () => {
    const sb = fakeSupabase({})
    expect(await getVerdeProbabilityForTrafico(sb, '', 'T-1')).toBeNull()
    expect(await getVerdeProbabilityForTrafico(sb, 'evco', '')).toBeNull()
  })

  it('returns null when trafico has no facturas', async () => {
    const sb = fakeSupabase({ globalpc_facturas: [] })
    expect(
      await getVerdeProbabilityForTrafico(sb, 'evco', 'T-EMPTY', { now: NOW }),
    ).toBeNull()
  })

  it('delegates to getVerdeProbabilityForSku for the dominant SKU', async () => {
    const sb = fakeSupabase({
      globalpc_facturas: [
        { company_id: 'evco', folio: 100, cve_trafico: 'T-1', fecha_facturacion: ago(6) },
        { company_id: 'evco', folio: 101, cve_trafico: 'T-1', fecha_facturacion: ago(6) },
      ],
      globalpc_partidas: [
        // SKU-DOMINANT has 2 partidas; SKU-SIDE has 1 → dominant picked
        { company_id: 'evco', cve_producto: 'SKU-DOMINANT', cve_proveedor: 'PRV_1', folio: 100, created_at: ago(5) },
        { company_id: 'evco', cve_producto: 'SKU-DOMINANT', cve_proveedor: 'PRV_1', folio: 101, created_at: ago(5) },
        { company_id: 'evco', cve_producto: 'SKU-SIDE', cve_proveedor: 'PRV_1', folio: 100, created_at: ago(5) },
      ],
      traficos: [
        { company_id: 'evco', trafico: 'T-1', pedimento: null, fecha_cruce: ago(4), fecha_llegada: ago(5), semaforo: 0 },
      ],
      globalpc_productos: [
        { company_id: 'evco', cve_producto: 'SKU-DOMINANT', fraccion: '3903.20.01' },
      ],
    })
    const pred = await getVerdeProbabilityForTrafico(sb, 'evco', 'T-1', { now: NOW })
    expect(pred).not.toBeNull()
    expect(pred!.cve_producto).toBe('SKU-DOMINANT')
  })
})
