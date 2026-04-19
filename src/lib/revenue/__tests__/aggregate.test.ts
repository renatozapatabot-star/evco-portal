import { describe, it, expect, vi } from 'vitest'
import {
  getRevenueDashboard,
  lastNMonths,
  ymMinusMonth,
  ymMinusYear,
  pedimentoMonth,
  bannerMode,
} from '../aggregate'

describe('lastNMonths', () => {
  it('returns 12 ascending months ending at the reference month', () => {
    const ref = new Date(Date.UTC(2026, 3, 19)) // April 2026
    const months = lastNMonths(12, ref)
    expect(months).toHaveLength(12)
    expect(months[months.length - 1]).toBe('2026-04')
    expect(months[0]).toBe('2025-05')
  })

  it('handles year rollover correctly', () => {
    const ref = new Date(Date.UTC(2026, 0, 15)) // January 2026
    const months = lastNMonths(12, ref)
    expect(months[months.length - 1]).toBe('2026-01')
    expect(months[0]).toBe('2025-02')
  })
})

describe('ymMinusMonth / ymMinusYear', () => {
  it('subtracts a month with year rollover', () => {
    expect(ymMinusMonth('2026-01')).toBe('2025-12')
    expect(ymMinusMonth('2026-04')).toBe('2026-03')
  })
  it('subtracts a year', () => {
    expect(ymMinusYear('2026-04')).toBe('2025-04')
  })
})

describe('pedimentoMonth', () => {
  it('prefers fecha_pago, then fecha_entrada, then updated_at', () => {
    expect(
      pedimentoMonth({
        rfc_importador: null,
        clave_pedimento: null,
        fecha_pago: '2026-03-12T00:00:00Z',
        fecha_entrada: '2026-02-01T00:00:00Z',
        updated_at: '2026-04-19T00:00:00Z',
      } as any),
    ).toBe('2026-03')

    expect(
      pedimentoMonth({
        rfc_importador: null,
        clave_pedimento: null,
        fecha_pago: null,
        fecha_entrada: '2026-02-15T00:00:00Z',
        updated_at: '2026-04-19T00:00:00Z',
      } as any),
    ).toBe('2026-02')

    expect(
      pedimentoMonth({
        rfc_importador: null,
        clave_pedimento: null,
        fecha_pago: null,
        fecha_entrada: null,
        updated_at: '2026-04-19T12:00:00Z',
      } as any),
    ).toBe('2026-04')
  })

  it('returns null when no usable date', () => {
    expect(
      pedimentoMonth({
        rfc_importador: null,
        clave_pedimento: null,
        fecha_pago: null,
        fecha_entrada: null,
        updated_at: null,
      } as any),
    ).toBeNull()
  })
})

describe('bannerMode', () => {
  it('returns loud when no real-fee data exists', () => {
    expect(bannerMode(0, null, '2026-04')).toBe('loud')
  })
  it('returns loud when real-fee data is older than 3 months', () => {
    expect(bannerMode(50, '2025-12', '2026-04')).toBe('loud') // 4 months old
  })
  it('returns inform when real data is recent but coverage thin', () => {
    expect(bannerMode(20, '2026-03', '2026-04')).toBe('inform')
  })
  it('returns hide when coverage ≥ 50% and recent', () => {
    expect(bannerMode(75, '2026-03', '2026-04')).toBe('hide')
  })
})

describe('getRevenueDashboard (integration with mocked supabase)', () => {
  function makeMockSupabase(opts: {
    pedimentos: Array<{
      rfc_importador: string | null
      clave_pedimento: string | null
      updated_at: string | null
      fecha_pago?: string | null
      fecha_entrada?: string | null
    }>
    facturas: Array<{
      cve_cliente: string | null
      total: number | null
      moneda: string | null
      fecha: string | null
      tipo_factura: string | null
    }>
    companies: Array<{
      company_id: string | null
      rfc: string | null
      clave_cliente: string | null
      name: string | null
    }>
  }) {
    return {
      from(table: string) {
        const data =
          table === 'pedimentos'
            ? opts.pedimentos
            : table === 'econta_facturas'
              ? opts.facturas
              : opts.companies
        const builder: any = { _data: data }
        const passthrough = (..._args: any[]) => builder
        builder.select = passthrough
        builder.gte = passthrough
        builder.eq = passthrough
        builder.order = passthrough
        builder.limit = () => Promise.resolve({ data: builder._data, error: null })
        return builder
      },
    } as any
  }

  it('counts pedimentos by month and applies the estimator', async () => {
    const ref = new Date(Date.UTC(2026, 3, 19))
    const sb = makeMockSupabase({
      pedimentos: [
        // Current month (2026-04): 2 IMMEX + 1 standard
        { rfc_importador: 'EVCO001', clave_pedimento: 'IN', updated_at: '2026-04-10T00:00:00Z' },
        { rfc_importador: 'EVCO001', clave_pedimento: 'ITE', updated_at: '2026-04-12T00:00:00Z' },
        { rfc_importador: 'EVCO001', clave_pedimento: 'A1', updated_at: '2026-04-15T00:00:00Z' },
        // Last month: 1 IMMEX, 1 standard
        { rfc_importador: 'EVCO001', clave_pedimento: 'IN', updated_at: '2026-03-10T00:00:00Z' },
        { rfc_importador: 'EVCO001', clave_pedimento: 'A1', updated_at: '2026-03-15T00:00:00Z' },
        // Same month last year for YoY: 1 IMMEX
        { rfc_importador: 'EVCO001', clave_pedimento: 'IN', updated_at: '2025-04-10T00:00:00Z' },
      ],
      facturas: [],
      companies: [
        { company_id: 'evco', rfc: 'EVCO001', clave_cliente: '9254', name: 'EVCO Plastics' },
      ],
    })

    const data = await getRevenueDashboard(sb, 20, ref)

    const aprilBucket = data.months.find((m) => m.month === '2026-04')!
    expect(aprilBucket.pedimentoCount).toBe(3)
    expect(aprilBucket.pedimentoCountImmex).toBe(2)
    expect(aprilBucket.pedimentoCountStandard).toBe(1)
    expect(aprilBucket.estimatedFeeUSD).toBe(2 * 400 + 1 * 125) // 925
    expect(aprilBucket.estimatedFeeMXN).toBe(925 * 20) // 18500

    const marchBucket = data.months.find((m) => m.month === '2026-03')!
    expect(marchBucket.pedimentoCount).toBe(2)

    // Top client
    expect(data.topByRevenueThisMonth).toHaveLength(1)
    expect(data.topByRevenueThisMonth[0].name).toBe('EVCO Plastics')
    expect(data.topByRevenueThisMonth[0].pedimentoCountThisMonth).toBe(3)
    expect(data.topByRevenueThisMonth[0].estimatedFeeMXNThisMonth).toBe(925 * 20)

    // YoY: 3 vs 1 = +200%
    expect(data.topByRevenueThisMonth[0].yoyGrowthPct).toBe(200)
    expect(data.topByRevenueThisMonth[0].momGrowthPct).toBeCloseTo(50, 1)
  })

  it('prefers real fee data when present (overlay, not replace)', async () => {
    const ref = new Date(Date.UTC(2026, 3, 19))
    const sb = makeMockSupabase({
      pedimentos: [
        { rfc_importador: 'EVCO001', clave_pedimento: 'A1', updated_at: '2026-04-10T00:00:00Z' },
      ],
      facturas: [
        // Real billed fee for current month — MXN
        {
          cve_cliente: '9254',
          total: 5000,
          moneda: 'MXN',
          fecha: '2026-04-15T00:00:00Z',
          tipo_factura: 'I',
        },
        // USD invoice — should convert
        {
          cve_cliente: '9254',
          total: 100,
          moneda: 'USD',
          fecha: '2026-04-16T00:00:00Z',
          tipo_factura: 'I',
        },
      ],
      companies: [
        { company_id: 'evco', rfc: 'EVCO001', clave_cliente: '9254', name: 'EVCO Plastics' },
      ],
    })

    const data = await getRevenueDashboard(sb, 20, ref)
    const aprilBucket = data.months.find((m) => m.month === '2026-04')!

    // Estimated still computed
    expect(aprilBucket.estimatedFeeMXN).toBe(125 * 20) // 2500

    // Real overlay: 5000 MXN + 100 USD * 20 = 7000 MXN
    expect(aprilBucket.realFeeMXN).toBe(7000)
    expect(aprilBucket.realFeeMXNFromMXN).toBe(5000)
    expect(aprilBucket.realFeeMXNFromUSD).toBe(2000)

    expect(data.topByRevenueThisMonth[0].realFeeMXNThisMonth).toBe(7000)
  })

  it('flags banner=loud when no real fee data in last 12 months', async () => {
    const ref = new Date(Date.UTC(2026, 3, 19))
    const sb = makeMockSupabase({
      pedimentos: [
        { rfc_importador: 'EVCO001', clave_pedimento: 'A1', updated_at: '2026-04-10T00:00:00Z' },
      ],
      facturas: [], // no real data
      companies: [
        { company_id: 'evco', rfc: 'EVCO001', clave_cliente: '9254', name: 'EVCO Plastics' },
      ],
    })

    const data = await getRevenueDashboard(sb, 20, ref)
    expect(data.estimatorBannerMode).toBe('loud')
    expect(data.realFeeCoveragePct).toBe(0)
    expect(data.mostRecentRealFeeMonth).toBeNull()
  })

  it('drops YoY growth entries below the minimum signal floor (3 pedimentos)', async () => {
    const ref = new Date(Date.UTC(2026, 3, 19))
    const sb = makeMockSupabase({
      pedimentos: [
        // 0 → 2 = infinite growth, but floor of 3 drops it
        { rfc_importador: 'TINY', clave_pedimento: 'A1', updated_at: '2026-04-10T00:00:00Z' },
        { rfc_importador: 'TINY', clave_pedimento: 'A1', updated_at: '2026-04-11T00:00:00Z' },
      ],
      facturas: [],
      companies: [{ company_id: 'tiny', rfc: 'TINY', clave_cliente: '0001', name: 'Tiny Co' }],
    })

    const data = await getRevenueDashboard(sb, 20, ref)
    expect(data.topByYoYGrowth).toHaveLength(0) // 2 pedimentos < 3-floor
  })

  it('handles pedimentos without a matching company gracefully', async () => {
    const ref = new Date(Date.UTC(2026, 3, 19))
    const sb = makeMockSupabase({
      pedimentos: [
        { rfc_importador: 'UNKNOWN-RFC', clave_pedimento: 'IN', updated_at: '2026-04-10T00:00:00Z' },
      ],
      facturas: [],
      companies: [],
    })

    const data = await getRevenueDashboard(sb, 20, ref)
    expect(data.months.find((m) => m.month === '2026-04')!.pedimentoCount).toBe(1)
    expect(data.topByRevenueThisMonth[0].name).toBe('UNKNOWN-RFC')
    expect(data.topByRevenueThisMonth[0].companyId).toBeNull()
  })
})
