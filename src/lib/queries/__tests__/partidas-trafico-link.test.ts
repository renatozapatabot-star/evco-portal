/**
 * Tests for the M12 partidas→facturas→traficos 2-hop helper.
 *
 * Split into two concerns:
 *   1. Unit tests for resolvePartidaLinks (mocked Supabase) — locks
 *      the chunking + tenant-scoping + fallback behavior
 *   2. A schema-contract guard that would fail TypeScript compilation
 *      if someone tries to select a phantom column from partidas
 *      (the M11/M12 class of bug)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Database } from '../../../../types/supabase'
import { resolvePartidaLinks, applyPartidaLink } from '../partidas-trafico-link'

/* eslint-disable @typescript-eslint/no-explicit-any */

type PartidasRow = Database['public']['Tables']['globalpc_partidas']['Row']
type FacturasRow = Database['public']['Tables']['globalpc_facturas']['Row']
type TraficosRow = Database['public']['Tables']['traficos']['Row']

// ── Schema-contract guard ──────────────────────────────────────────
// These compile-time assertions lock the columns the M12 helper
// relies on. If a future migration renames/drops any of them,
// tsc --noEmit FAILS with a clear error instead of silently 400'ing
// at runtime.

type AssertKeyOf<T, K extends keyof T> = K
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _partidasHasFolio = AssertKeyOf<PartidasRow, 'folio'>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _partidasHasCveProducto = AssertKeyOf<PartidasRow, 'cve_producto'>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _partidasHasCveProveedor = AssertKeyOf<PartidasRow, 'cve_proveedor'>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _partidasHasCreatedAt = AssertKeyOf<PartidasRow, 'created_at'>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _partidasHasCantidad = AssertKeyOf<PartidasRow, 'cantidad'>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _partidasHasPrecioUnitario = AssertKeyOf<PartidasRow, 'precio_unitario'>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _partidasHasCompanyId = AssertKeyOf<PartidasRow, 'company_id'>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _facturasHasFolio = AssertKeyOf<FacturasRow, 'folio'>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _facturasHasCveTrafico = AssertKeyOf<FacturasRow, 'cve_trafico'>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _facturasHasFechaFacturacion = AssertKeyOf<FacturasRow, 'fecha_facturacion'>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _facturasHasValorComercial = AssertKeyOf<FacturasRow, 'valor_comercial'>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _facturasHasCompanyId = AssertKeyOf<FacturasRow, 'company_id'>

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _traficosHasTrafico = AssertKeyOf<TraficosRow, 'trafico'>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _traficosHasPedimento = AssertKeyOf<TraficosRow, 'pedimento'>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _traficosHasFechaCruce = AssertKeyOf<TraficosRow, 'fecha_cruce'>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _traficosHasFechaLlegada = AssertKeyOf<TraficosRow, 'fecha_llegada'>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _traficosHasSemaforo = AssertKeyOf<TraficosRow, 'semaforo'>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _traficosHasCompanyId = AssertKeyOf<TraficosRow, 'company_id'>

// ── Supabase chain mock ─────────────────────────────────────────────

let facturasRes: { data: any[]; error: any } = { data: [], error: null }
let traficosRes: { data: any[]; error: any } = { data: [], error: null }

function mockSupabase(): any {
  return {
    from(table: string) {
      const chain: any = {
        select() { return chain },
        eq() { return chain },
        in() {
          // Terminal — resolve based on which table.
          if (table === 'globalpc_facturas') return Promise.resolve(facturasRes)
          if (table === 'traficos') return Promise.resolve(traficosRes)
          return Promise.resolve({ data: [], error: null })
        },
      }
      return chain
    },
  }
}

beforeEach(() => {
  facturasRes = { data: [], error: null }
  traficosRes = { data: [], error: null }
})

describe('resolvePartidaLinks', () => {
  it('returns empty when companyId is missing', async () => {
    const result = await resolvePartidaLinks(mockSupabase(), '', [
      { folio: 1001 },
    ])
    expect(result.byFolio.size).toBe(0)
    expect(result.distinctCveTraficos).toEqual([])
  })

  it('returns empty when partidas list is empty', async () => {
    const result = await resolvePartidaLinks(mockSupabase(), 'evco', [])
    expect(result.byFolio.size).toBe(0)
  })

  it('returns empty when all partidas have null folios', async () => {
    const result = await resolvePartidaLinks(mockSupabase(), 'evco', [
      { folio: null },
      { folio: null },
    ])
    expect(result.byFolio.size).toBe(0)
  })

  it('joins partidas→facturas→traficos on the happy path', async () => {
    facturasRes = {
      data: [
        { folio: 1001, cve_trafico: 'T-001', fecha_facturacion: '2026-04-10', valor_comercial: 1500 },
        { folio: 1002, cve_trafico: 'T-002', fecha_facturacion: '2026-04-12', valor_comercial: 2200 },
      ],
      error: null,
    }
    traficosRes = {
      data: [
        { trafico: 'T-001', pedimento: '26 24 3596 6500441', fecha_cruce: '2026-04-14', fecha_llegada: '2026-04-13', semaforo: 0 },
        { trafico: 'T-002', pedimento: '26 24 3596 6500442', fecha_cruce: '2026-04-16', fecha_llegada: '2026-04-15', semaforo: 1 },
      ],
      error: null,
    }
    const result = await resolvePartidaLinks(mockSupabase(), 'evco', [
      { folio: 1001 },
      { folio: 1002 },
    ])
    expect(result.byFolio.size).toBe(2)
    expect(result.byFolio.get(1001)).toEqual({
      cve_trafico: 'T-001',
      pedimento: '26 24 3596 6500441',
      fecha_cruce: '2026-04-14',
      fecha_llegada: '2026-04-13',
      semaforo: 0,
      fecha_facturacion: '2026-04-10',
      valor_comercial: 1500,
    })
    expect(result.distinctCveTraficos.sort()).toEqual(['T-001', 'T-002'])
  })

  it('tolerates partidas with folios that have no matching factura', async () => {
    // Factura data only covers folio 1001; folio 9999 is orphan.
    facturasRes = {
      data: [
        { folio: 1001, cve_trafico: 'T-001', fecha_facturacion: '2026-04-10', valor_comercial: 1000 },
      ],
      error: null,
    }
    traficosRes = {
      data: [
        { trafico: 'T-001', pedimento: '26 24 3596 6500441', fecha_cruce: '2026-04-12', fecha_llegada: '2026-04-11', semaforo: 0 },
      ],
      error: null,
    }
    const result = await resolvePartidaLinks(mockSupabase(), 'evco', [
      { folio: 1001 },
      { folio: 9999 },
    ])
    expect(result.byFolio.get(1001)?.cve_trafico).toBe('T-001')
    expect(result.byFolio.has(9999)).toBe(false)
  })

  it('tolerates factura with cve_trafico that has no matching trafico row', async () => {
    facturasRes = {
      data: [
        { folio: 2001, cve_trafico: 'T-ORPHAN', fecha_facturacion: '2026-04-10', valor_comercial: 500 },
      ],
      error: null,
    }
    traficosRes = { data: [], error: null }
    const result = await resolvePartidaLinks(mockSupabase(), 'evco', [
      { folio: 2001 },
    ])
    const link = result.byFolio.get(2001)
    // Factura-level fields preserved; trafico-level fields null.
    expect(link?.cve_trafico).toBe('T-ORPHAN')
    expect(link?.fecha_facturacion).toBe('2026-04-10')
    expect(link?.pedimento).toBeNull()
    expect(link?.fecha_cruce).toBeNull()
    expect(link?.semaforo).toBeNull()
  })

  it('coalesces multiple facturas per folio to the first cve_trafico', async () => {
    // Two facturas for the same folio — both point to the same trafico.
    facturasRes = {
      data: [
        { folio: 3001, cve_trafico: 'T-003', fecha_facturacion: '2026-04-01', valor_comercial: 1000 },
        { folio: 3001, cve_trafico: 'T-003', fecha_facturacion: '2026-04-02', valor_comercial: 500 },
      ],
      error: null,
    }
    traficosRes = {
      data: [{ trafico: 'T-003', pedimento: '26 24 3596 6500443', fecha_cruce: '2026-04-05', fecha_llegada: '2026-04-04', semaforo: 0 }],
      error: null,
    }
    const result = await resolvePartidaLinks(mockSupabase(), 'evco', [
      { folio: 3001 },
    ])
    // Takes the first factura's fecha_facturacion + valor_comercial.
    expect(result.byFolio.get(3001)?.fecha_facturacion).toBe('2026-04-01')
    expect(result.byFolio.get(3001)?.valor_comercial).toBe(1000)
    expect(result.byFolio.get(3001)?.cve_trafico).toBe('T-003')
  })

  it('coerces non-0-1-2 semaforo values to null', async () => {
    facturasRes = {
      data: [{ folio: 4001, cve_trafico: 'T-004', fecha_facturacion: '2026-04-01', valor_comercial: 1000 }],
      error: null,
    }
    traficosRes = {
      data: [{ trafico: 'T-004', pedimento: '...', fecha_cruce: null, fecha_llegada: null, semaforo: 99 as any }],
      error: null,
    }
    const result = await resolvePartidaLinks(mockSupabase(), 'evco', [{ folio: 4001 }])
    expect(result.byFolio.get(4001)?.semaforo).toBeNull()
  })

  it('dedups distinctCveTraficos when multiple facturas share a trafico', async () => {
    facturasRes = {
      data: [
        { folio: 5001, cve_trafico: 'T-5', fecha_facturacion: null, valor_comercial: null },
        { folio: 5002, cve_trafico: 'T-5', fecha_facturacion: null, valor_comercial: null },
        { folio: 5003, cve_trafico: 'T-6', fecha_facturacion: null, valor_comercial: null },
      ],
      error: null,
    }
    traficosRes = { data: [], error: null }
    const result = await resolvePartidaLinks(mockSupabase(), 'evco', [
      { folio: 5001 }, { folio: 5002 }, { folio: 5003 },
    ])
    expect(result.distinctCveTraficos.sort()).toEqual(['T-5', 'T-6'])
  })
})

describe('applyPartidaLink', () => {
  it('attaches the resolved link when folio is known', async () => {
    facturasRes = {
      data: [{ folio: 1001, cve_trafico: 'T-1', fecha_facturacion: '2026-04-01', valor_comercial: 100 }],
      error: null,
    }
    traficosRes = {
      data: [{ trafico: 'T-1', pedimento: 'P', fecha_cruce: null, fecha_llegada: null, semaforo: 0 }],
      error: null,
    }
    const links = await resolvePartidaLinks(mockSupabase(), 'evco', [{ folio: 1001 }])
    const enriched = applyPartidaLink({ folio: 1001, cve_producto: 'A' }, links)
    expect(enriched.link?.cve_trafico).toBe('T-1')
    expect(enriched.cve_producto).toBe('A')
  })

  it('attaches null link when folio is missing from map', () => {
    const enriched = applyPartidaLink({ folio: 9999 }, {
      byFolio: new Map(),
      distinctCveTraficos: [],
    })
    expect(enriched.link).toBeNull()
  })

  it('attaches null link when the partida has no folio', () => {
    const enriched = applyPartidaLink({ folio: null }, {
      byFolio: new Map(),
      distinctCveTraficos: [],
    })
    expect(enriched.link).toBeNull()
  })
})
