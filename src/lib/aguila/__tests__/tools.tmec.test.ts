import { describe, it, expect, beforeEach, vi } from 'vitest'
import { checkTmecEligibility } from '../tool-helpers/check-tmec'

let tariffResponse: { data: unknown; error: unknown } = { data: null, error: null }

function makeSupabase() {
  const chain: Record<string, unknown> = {}
  chain.select = vi.fn(() => chain)
  chain.eq = vi.fn(() => chain)
  chain.maybeSingle = vi.fn(() => Promise.resolve(tariffResponse))
  return { from: vi.fn(() => chain) } as unknown as Parameters<typeof checkTmecEligibility>[0]
}

beforeEach(() => {
  tariffResponse = { data: null, error: null }
})

describe('checkTmecEligibility', () => {
  it('refuses malformed fraccion (no dots)', async () => {
    const r = await checkTmecEligibility(makeSupabase(), { fraccion: '39012001', origin: 'USA' })
    expect(r.success).toBe(true)
    expect(r.data?.verdict_es).toBe('fraccion_invalida')
  })

  it('non-USMCA origin → no_elegible_por_origen (no savings computed)', async () => {
    tariffResponse = { data: { fraccion: '3901.20.01', igi_rate: 0.05, sample_count: 10, source: 'tigie' }, error: null }
    const r = await checkTmecEligibility(makeSupabase(), { fraccion: '3901.20.01', origin: 'CHN', valorAduanaMxn: 100000 })
    expect(r.data?.verdict_es).toBe('no_elegible_por_origen')
    expect(r.data?.estimated_savings_mxn).toBeNull()
  })

  it('USMCA origin + tariff absent → requiere_verificacion (never fabricates a rate)', async () => {
    tariffResponse = { data: null, error: null }
    const r = await checkTmecEligibility(makeSupabase(), { fraccion: '3901.20.01', origin: 'USA' })
    expect(r.data?.verdict_es).toBe('requiere_verificacion')
    expect(r.data?.igi_rate).toBeNull()
  })

  it('USMCA origin + tariff present + valor_aduana → elegible + estimated savings', async () => {
    tariffResponse = { data: { fraccion: '3901.20.01', igi_rate: 0.05, sample_count: 12, source: 'tigie' }, error: null }
    const r = await checkTmecEligibility(makeSupabase(), {
      fraccion: '3901.20.01',
      origin: 'Estados Unidos',
      valorAduanaMxn: 100000,
    })
    expect(r.data?.verdict_es).toBe('elegible_con_certificado')
    expect(r.data?.igi_rate).toBe(0.05)
    expect(r.data?.estimated_savings_mxn).toBe(5000)
    expect(r.data?.rationale_es).toContain('5000')
  })

  it('USMCA origin + tariff present without valor_aduana → elegible with null savings', async () => {
    tariffResponse = { data: { fraccion: '3901.20.01', igi_rate: 0.05, sample_count: 12, source: 'tigie' }, error: null }
    const r = await checkTmecEligibility(makeSupabase(), { fraccion: '3901.20.01', origin: 'MEX' })
    expect(r.data?.verdict_es).toBe('elegible_con_certificado')
    expect(r.data?.estimated_savings_mxn).toBeNull()
  })

  it('origin normalization handles accents + case', async () => {
    tariffResponse = { data: { fraccion: '3901.20.01', igi_rate: 0.05, sample_count: 1, source: 'tigie' }, error: null }
    const r = await checkTmecEligibility(makeSupabase(), { fraccion: '3901.20.01', origin: 'méxico' })
    expect(r.data?.usmca_origin).toBe(true)
    expect(r.data?.origin_normalized).toBe('MEXICO')
  })
})
