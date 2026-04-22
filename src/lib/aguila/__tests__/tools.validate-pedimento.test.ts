import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rates', () => ({
  getIVARate: vi.fn(async () => 0.16),
  getDTARates: vi.fn(async () => ({
    A1: { type: 'fixed', amount: 408 },
    IN: { type: 'fixed', amount: 200 },
    IT: { type: 'fixed', amount: 100 },
  })),
}))

import { validatePedimento } from '../tool-helpers/validate-pedimento'
import { getIVARate, getDTARates } from '@/lib/rates'

beforeEach(() => {
  vi.mocked(getIVARate).mockResolvedValue(0.16)
  vi.mocked(getDTARates).mockResolvedValue({
    A1: { type: 'fixed', amount: 408 },
    IN: { type: 'fixed', amount: 200 },
    IT: { type: 'fixed', amount: 100 },
  })
})

describe('validatePedimento', () => {
  it('refuses empty pedimento number', async () => {
    const r = await validatePedimento({ pedimentoNumber: '' })
    expect(r.success).toBe(false)
    expect(r.error).toBe('invalid_pedimentoNumber')
  })

  it('passes format check for canonical SAT pedimento with spaces', async () => {
    const r = await validatePedimento({ pedimentoNumber: '26 24 3596 6500441' })
    expect(r.success).toBe(true)
    expect(r.data?.overall_pass).toBe(true)
    const fmt = r.data?.checks.find(c => c.id === 'format_spaces')
    expect(fmt?.passed).toBe(true)
  })

  it('fails format check when spaces are stripped', async () => {
    const r = await validatePedimento({ pedimentoNumber: '26243596650441' })
    expect(r.data?.overall_pass).toBe(false)
    const fmt = r.data?.checks.find(c => c.id === 'format_spaces')
    expect(fmt?.passed).toBe(false)
    expect(fmt?.detail_es).toContain('DD AD PPPP SSSSSSS')
  })

  it('fails fraccion check when dots are stripped', async () => {
    const r = await validatePedimento({ pedimentoNumber: '26 24 3596 6500441', fraccion: '39012001' })
    const frac = r.data?.checks.find(c => c.id === 'fraccion_dots')
    expect(frac?.passed).toBe(false)
    expect(frac?.detail_es).toContain('XXXX.XX.XX')
  })

  it('computes IVA cascade base = valor_aduana + DTA + IGI', async () => {
    // valor_aduana=100000, DTA(A1)=408, IGI=5000 → base=105408
    // IVA = 105408 × 0.16 = 16865.28
    const r = await validatePedimento({
      pedimentoNumber: '26 24 3596 6500441',
      valorAduanaMxn: 100000,
      igiMxn: 5000,
      providedIvaMxn: 16865.28,
      dtaKey: 'A1',
    })
    expect(r.success).toBe(true)
    expect(r.data?.overall_pass).toBe(true)
    expect(r.data?.computed_iva_mxn).toBeCloseTo(16865.28, 2)
    expect(r.data?.iva_rate_used).toBe(0.16)
  })

  it('fails IVA check when provided amount uses flat × 0.16 on invoice (the common wrong calc)', async () => {
    // Wrong calc: 100000 × 0.16 = 16000 — skips DTA and IGI
    const r = await validatePedimento({
      pedimentoNumber: '26 24 3596 6500441',
      valorAduanaMxn: 100000,
      igiMxn: 5000,
      providedIvaMxn: 16000,
    })
    const iva = r.data?.checks.find(c => c.id === 'iva_cascade_base')
    expect(iva?.passed).toBe(false)
    expect(iva?.detail_es).toContain('fuera de tolerancia')
  })

  it('currency check rejects non-MXN/USD labels', async () => {
    const r = await validatePedimento({
      pedimentoNumber: '26 24 3596 6500441',
      currency: 'EUR' as unknown as 'MXN',
    })
    const cur = r.data?.checks.find(c => c.id === 'currency_label')
    expect(cur?.passed).toBe(false)
  })

  it('propagates rates-expired error instead of silently computing', async () => {
    vi.mocked(getIVARate).mockRejectedValueOnce(new Error('IVA rate expired — update system_config'))
    const r = await validatePedimento({
      pedimentoNumber: '26 24 3596 6500441',
      valorAduanaMxn: 100000,
      igiMxn: 5000,
      providedIvaMxn: 16865.28,
    })
    expect(r.success).toBe(false)
    expect(r.error).toContain('expired')
  })
})
