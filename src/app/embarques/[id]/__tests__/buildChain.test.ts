import { describe, it, expect } from 'vitest'
import { buildChain } from '../buildChain'

const baseInput = {
  traficoId: '26 24 3596 6500441',
  fechaCruce: null,
  facturas: [],
  entradas: [],
  pedimento: null,
  docCount: 0,
  requiredDocsCount: 7,
  uploadedRequiredCount: 0,
}

describe('buildChain', () => {
  it('returns nodes in the fixed 5-step order', () => {
    const nodes = buildChain(baseInput)
    expect(nodes.map(n => n.kind)).toEqual([
      'factura', 'entrada', 'pedimento', 'trafico', 'expediente',
    ])
  })

  it('marks factura missing when no rows, linked when paid, pending when unpaid', () => {
    expect(buildChain(baseInput).find(n => n.kind === 'factura')!.status).toBe('missing')

    const withPaid = buildChain({
      ...baseInput,
      facturas: [{ folio: 1, fecha_pago: '2026-04-01' }],
    })
    expect(withPaid.find(n => n.kind === 'factura')!.status).toBe('linked')

    const withUnpaid = buildChain({
      ...baseInput,
      facturas: [{ folio: 1, fecha_pago: null }],
    })
    expect(withUnpaid.find(n => n.kind === 'factura')!.status).toBe('pending')
  })

  it('maps pedimento status across the 6 check-constraint values', () => {
    const cases: Array<[string, 'linked' | 'pending' | 'error']> = [
      ['borrador', 'pending'],
      ['validado', 'pending'],
      ['firmado', 'linked'],
      ['pagado', 'linked'],
      ['cruzado', 'linked'],
      ['cancelado', 'error'],
    ]
    for (const [status, expected] of cases) {
      const nodes = buildChain({
        ...baseInput,
        pedimento: { id: 'x', pedimento_number: '26 24 3596 6500441', status, updated_at: null },
      })
      expect(nodes.find(n => n.kind === 'pedimento')!.status).toBe(expected)
    }
  })

  it('expediente tiers by completeness % and doc count', () => {
    const missing = buildChain({ ...baseInput, docCount: 0, uploadedRequiredCount: 0 })
    expect(missing.find(n => n.kind === 'expediente')!.status).toBe('missing')

    const poor = buildChain({ ...baseInput, docCount: 2, uploadedRequiredCount: 1, requiredDocsCount: 7 })
    expect(poor.find(n => n.kind === 'expediente')!.status).toBe('error')

    const partial = buildChain({ ...baseInput, docCount: 3, uploadedRequiredCount: 3, requiredDocsCount: 7 })
    expect(partial.find(n => n.kind === 'expediente')!.status).toBe('pending')

    const done = buildChain({ ...baseInput, docCount: 6, uploadedRequiredCount: 6, requiredDocsCount: 7 })
    expect(done.find(n => n.kind === 'expediente')!.status).toBe('linked')
  })

  it('entrada prefers fecha_ingreso, falls back to fecha_llegada_mercancia', () => {
    const nodes = buildChain({
      ...baseInput,
      entradas: [{ id: 12, fecha_ingreso: null, fecha_llegada_mercancia: '2026-03-15' }],
    })
    const entrada = nodes.find(n => n.kind === 'entrada')!
    expect(entrada.status).toBe('pending')
    expect(entrada.date).toBe('2026-03-15')
    expect(entrada.href).toBe('/entradas/12')
  })

  it('trafico node is linked only when fechaCruce present', () => {
    expect(buildChain(baseInput).find(n => n.kind === 'trafico')!.status).toBe('pending')
    expect(
      buildChain({ ...baseInput, fechaCruce: '2026-04-10' }).find(n => n.kind === 'trafico')!.status,
    ).toBe('linked')
  })
})
