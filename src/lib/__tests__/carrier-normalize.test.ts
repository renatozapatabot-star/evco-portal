import { describe, it, expect } from 'vitest'
import { fmtCarrier, deriveTransporte } from '../carrier-normalize'

describe('fmtCarrier', () => {
  it('returns empty for null/undefined/blank', () => {
    expect(fmtCarrier(null)).toBe('')
    expect(fmtCarrier(undefined)).toBe('')
    expect(fmtCarrier('   ')).toBe('')
  })

  it('strips junk tokens', () => {
    for (const junk of ['DUMMY', 'UNKNOWN', 'PENDIENTE', 'N/A', 'NULL', '---']) {
      expect(fmtCarrier(junk)).toBe('')
      expect(fmtCarrier(junk.toLowerCase())).toBe('')
    }
  })

  it('title-cases multi-word carrier names', () => {
    expect(fmtCarrier('ESTAFETA EXPRESS')).toBe('Estafeta Express')
  })

  it('keeps short acronyms uppercase', () => {
    expect(fmtCarrier('DHL EXPRESS')).toBe('DHL Express')
    expect(fmtCarrier('UPS SCS')).toBe('UPS SCS')
  })

  it('collapses multiple spaces', () => {
    expect(fmtCarrier('  CRUZ   LOGISTICS  ')).toBe('Cruz Logistics')
  })
})

describe('deriveTransporte', () => {
  it('prioritizes entrada.transportista_americano', () => {
    const out = deriveTransporte({
      entrada: { transportista_americano: 'ESTAFETA EXPRESS', transportista_mexicano: 'TRANS MX' },
      trafico: { transportista_extranjero: 'UPS', transportista_mexicano: 'TRANS MX 2' },
    })
    expect(out.americano).toBe('Estafeta Express')
    expect(out.source).toBe('entrada')
  })

  it('falls back to trafico.transportista_extranjero when entrada is null', () => {
    const out = deriveTransporte({
      entrada: { transportista_americano: null, transportista_mexicano: null },
      trafico: { transportista_extranjero: 'FEDEX FREIGHT', transportista_mexicano: null },
    })
    expect(out.americano).toBe('Fedex Freight')
    expect(out.source).toBe('trafico')
  })

  it('falls back to factura.transportista when both entrada + trafico are empty', () => {
    const out = deriveTransporte({
      entrada: null,
      trafico: null,
      factura: { transportista: 'XPO LOGISTICS' },
    })
    expect(out.americano).toBe('XPO Logistics')
    expect(out.source).toBe('factura')
  })

  it('returns none source when nothing resolves', () => {
    const out = deriveTransporte({ entrada: null, trafico: null, factura: null })
    expect(out.americano).toBe('')
    expect(out.mexicano).toBe('')
    expect(out.source).toBe('none')
  })

  it('treats junk tokens as null (skips to next source)', () => {
    const out = deriveTransporte({
      entrada: { transportista_americano: 'DUMMY', transportista_mexicano: null },
      trafico: { transportista_extranjero: 'LANDSTAR' },
    })
    expect(out.americano).toBe('Landstar')
    expect(out.source).toBe('trafico')
  })

  it('resolves mexicano from entrada first, trafico fallback', () => {
    const out = deriveTransporte({
      entrada: { transportista_americano: null, transportista_mexicano: 'FLETES MX' },
      trafico: { transportista_mexicano: 'OTRO MX' },
    })
    expect(out.mexicano).toBe('Fletes MX')
  })
})
