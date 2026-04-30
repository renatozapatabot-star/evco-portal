import { describe, it, expect } from 'vitest'
import { buildFullCrossingInsight } from '../full-insight'

/**
 * full-insight — exercises the composer end-to-end with a fake supabase.
 * Public contract: given a target + tenant, produce a complete insight
 * bundle, or null when there's nothing to compose.
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
  return { from } as unknown as Parameters<typeof buildFullCrossingInsight>[0]
}

const NOW = Date.UTC(2026, 3, 21)
function ago(days: number) {
  return new Date(NOW - days * 86_400_000).toISOString()
}

function healthySkuFixtures() {
  return {
    globalpc_partidas: [
      { company_id: 'evco', cve_producto: 'SKU-HOT', cve_proveedor: 'PRV_1', folio: 100, created_at: ago(5) },
      { company_id: 'evco', cve_producto: 'SKU-HOT', cve_proveedor: 'PRV_1', folio: 101, created_at: ago(10) },
      { company_id: 'evco', cve_producto: 'SKU-HOT', cve_proveedor: 'PRV_1', folio: 102, created_at: ago(15) },
      { company_id: 'evco', cve_producto: 'SKU-HOT', cve_proveedor: 'PRV_1', folio: 103, created_at: ago(20) },
    ],
    globalpc_facturas: [
      { company_id: 'evco', folio: 100, cve_trafico: 'T-1', fecha_facturacion: ago(6) },
      { company_id: 'evco', folio: 101, cve_trafico: 'T-2', fecha_facturacion: ago(11) },
      { company_id: 'evco', folio: 102, cve_trafico: 'T-3', fecha_facturacion: ago(16) },
      { company_id: 'evco', folio: 103, cve_trafico: 'T-4', fecha_facturacion: ago(21) },
    ],
    traficos: [
      { company_id: 'evco', trafico: 'T-1', pedimento: null, fecha_cruce: ago(4), fecha_llegada: ago(5), semaforo: 0 },
      { company_id: 'evco', trafico: 'T-2', pedimento: null, fecha_cruce: ago(9), fecha_llegada: ago(10), semaforo: 0 },
      { company_id: 'evco', trafico: 'T-3', pedimento: null, fecha_cruce: ago(14), fecha_llegada: ago(15), semaforo: 0 },
      { company_id: 'evco', trafico: 'T-4', pedimento: null, fecha_cruce: ago(19), fecha_llegada: ago(20), semaforo: 0 },
    ],
    globalpc_productos: [
      { company_id: 'evco', cve_producto: 'SKU-HOT', fraccion: '3903.20.01' },
    ],
  }
}

describe('buildFullCrossingInsight — SKU target', () => {
  it('returns null for empty companyId', async () => {
    const sb = fakeSupabase({})
    const result = await buildFullCrossingInsight(sb, '', { type: 'sku', cveProducto: 'SKU-A' })
    expect(result).toBeNull()
  })

  it('returns null when SKU has no crossings', async () => {
    const sb = fakeSupabase({})
    const result = await buildFullCrossingInsight(sb, 'evco', {
      type: 'sku',
      cveProducto: 'SKU-MISSING',
    }, { now: NOW })
    expect(result).toBeNull()
  })

  it('returns null for blank cveProducto', async () => {
    const sb = fakeSupabase(healthySkuFixtures())
    const result = await buildFullCrossingInsight(sb, 'evco', {
      type: 'sku',
      cveProducto: '   ',
    }, { now: NOW })
    expect(result).toBeNull()
  })

  it('composes a full insight for a healthy SKU', async () => {
    const sb = fakeSupabase(healthySkuFixtures())
    const insight = await buildFullCrossingInsight(sb, 'evco', {
      type: 'sku',
      cveProducto: 'SKU-HOT',
    }, { now: NOW })
    expect(insight).not.toBeNull()
    expect(insight!.cve_producto).toBe('SKU-HOT')
    expect(insight!.target).toEqual({ type: 'sku', cveProducto: 'SKU-HOT' })
    expect(insight!.company_id).toBe('evco')
    expect(typeof insight!.generated_at).toBe('string')

    // Signals present
    expect(insight!.signals.prediction.cve_producto).toBe('SKU-HOT')
    expect(insight!.signals.streak.cve_producto).toBe('SKU-HOT')
    expect(insight!.signals.fraccion).toBe('3903.20.01')
    expect(insight!.signals.baselinePct).toBeGreaterThan(0)

    // Explanations present
    expect(insight!.explanation.probability_pct).toBeGreaterThan(0)
    expect(insight!.one_line).toMatch(/verde/)
    expect(insight!.plain_text.split('\n').length).toBeGreaterThan(1)

    // Recommendations present (celebrate or no_action, etc.)
    expect(insight!.recommendations.length).toBeGreaterThan(0)

    // Summary includes the SKU + probability
    expect(insight!.summary_es).toContain('SKU-HOT')
    expect(insight!.summary_es).toMatch(/verde/)
  })

  it('healthy SKU with streak ≥ 6 triggers celebrate_streak rec', async () => {
    const fixtures = healthySkuFixtures()
    // Add more verdes to push streak >= 6
    for (let i = 104; i < 110; i++) {
      const daysAgo = 25 + (i - 104) * 5
      fixtures.globalpc_partidas.push({
        company_id: 'evco', cve_producto: 'SKU-HOT', cve_proveedor: 'PRV_1',
        folio: i, created_at: ago(daysAgo),
      })
      fixtures.globalpc_facturas.push({
        company_id: 'evco', folio: i, cve_trafico: `T-${i}`, fecha_facturacion: ago(daysAgo + 1),
      })
      fixtures.traficos.push({
        company_id: 'evco', trafico: `T-${i}`, pedimento: null,
        fecha_cruce: ago(daysAgo - 1), fecha_llegada: ago(daysAgo), semaforo: 0,
      })
    }
    const sb = fakeSupabase(fixtures)
    const insight = await buildFullCrossingInsight(sb, 'evco', {
      type: 'sku',
      cveProducto: 'SKU-HOT',
    }, { now: NOW })
    expect(insight!.signals.streak.current_verde_streak).toBeGreaterThanOrEqual(6)
    expect(
      insight!.recommendations.some((r) => r.kind === 'celebrate_streak'),
    ).toBe(true)
  })
})

describe('buildFullCrossingInsight — trafico target', () => {
  it('returns null when trafico has no facturas', async () => {
    const sb = fakeSupabase({})
    const result = await buildFullCrossingInsight(sb, 'evco', {
      type: 'trafico',
      traficoId: 'T-ZERO',
    }, { now: NOW })
    expect(result).toBeNull()
  })

  it('returns null for blank traficoId', async () => {
    const sb = fakeSupabase({})
    const result = await buildFullCrossingInsight(sb, 'evco', {
      type: 'trafico',
      traficoId: '',
    }, { now: NOW })
    expect(result).toBeNull()
  })

  it('picks the dominant SKU from a trafico and builds the full bundle', async () => {
    const fixtures = healthySkuFixtures()
    // Give T-1 two partidas of SKU-HOT and one partida of SKU-SIDE —
    // SKU-HOT should be picked as dominant.
    fixtures.globalpc_partidas.push({
      company_id: 'evco', cve_producto: 'SKU-SIDE', cve_proveedor: 'PRV_9',
      folio: 100, created_at: ago(5),
    })
    const sb = fakeSupabase(fixtures)
    const insight = await buildFullCrossingInsight(sb, 'evco', {
      type: 'trafico',
      traficoId: 'T-1',
    }, { now: NOW })
    expect(insight).not.toBeNull()
    expect(insight!.cve_producto).toBe('SKU-HOT')
    expect(insight!.target).toEqual({ type: 'trafico', traficoId: 'T-1' })
    expect(insight!.summary_es).toContain('Tráfico T-1')
  })
})
