import { describe, it, expect } from 'vitest'
import { extractDataRefs, EMPTY_DATA_REFS, DATA_REFS_CONSTANTS } from '../data-refs'

describe('extractDataRefs', () => {
  it('empty input → empty refs', () => {
    expect(extractDataRefs([])).toEqual(EMPTY_DATA_REFS)
    expect(extractDataRefs([null, undefined, ''])).toEqual(EMPTY_DATA_REFS)
  })

  it('extracts canonical SAT pedimento numbers with spaces preserved', () => {
    const r = extractDataRefs([
      'Tu pedimento 26 24 3596 6500441 cruzó ayer. También el 26 24 3596 6500442 está listo.',
    ])
    expect(r.pedimentos).toEqual(['26 24 3596 6500441', '26 24 3596 6500442'])
  })

  it('extracts fracciones with dots preserved', () => {
    const r = extractDataRefs(['Fracción 3901.20.01 — polipropileno. También 3902.10.01.'])
    expect(r.fracciones).toEqual(['3901.20.01', '3902.10.01'])
  })

  it('normalizes Y1234 → Y-1234 for tráfico IDs', () => {
    const r = extractDataRefs(['Embarque Y1234 y Y-5678 en ruta.'])
    expect(r.traficos).toEqual(['Y-1234', 'Y-5678'])
  })

  it('deduplicates across multiple mentions of the same reference', () => {
    const r = extractDataRefs([
      'El pedimento 26 24 3596 6500441 con fracción 3901.20.01.',
      'El pedimento 26 24 3596 6500441 se liberó.',
    ])
    expect(r.pedimentos).toEqual(['26 24 3596 6500441'])
  })

  it('extracts amounts with explicit MXN/USD currency labels', () => {
    const r = extractDataRefs([
      'Ahorro estimado 5,000.00 MXN. IGI de $12,345 USD. IVA total 8,000 MXN.',
    ])
    expect(r.amounts).toHaveLength(3)
    expect(r.amounts[0]).toMatchObject({ value: 5000, currency: 'MXN' })
    expect(r.amounts[1]).toMatchObject({ value: 12345, currency: 'USD' })
    expect(r.amounts[2]).toMatchObject({ value: 8000, currency: 'MXN' })
  })

  it('ignores unlabeled monetary numbers (currency is mandatory per invariant #10)', () => {
    const r = extractDataRefs(['El total es 5000.'])
    expect(r.amounts).toEqual([])
  })

  it('ignores stripped-space pedimentos (format invariant protects downstream)', () => {
    const r = extractDataRefs(['Pedimento 26243596650441 no válido.'])
    expect(r.pedimentos).toEqual([])
  })

  it('ignores stripped-dot fracciones', () => {
    const r = extractDataRefs(['Fracción 39012001 (sin puntos).'])
    expect(r.fracciones).toEqual([])
  })

  it('caps each kind at MAX_REFS_PER_KIND', () => {
    const many = Array.from({ length: 20 }, (_, i) => {
      const n = String(i).padStart(7, '0')
      return `26 24 3596 ${n}`
    }).join(' ')
    const r = extractDataRefs([many])
    expect(r.pedimentos.length).toBe(DATA_REFS_CONSTANTS.MAX_REFS_PER_KIND)
  })

  it('merges refs across multiple input texts', () => {
    const r = extractDataRefs([
      'Tu tráfico Y-1234 lleva el pedimento 26 24 3596 6500441.',
      '{"fraccion":"3901.20.01","amount":"5,000 MXN"}',
    ])
    expect(r.traficos).toEqual(['Y-1234'])
    expect(r.pedimentos).toEqual(['26 24 3596 6500441'])
    expect(r.fracciones).toEqual(['3901.20.01'])
    expect(r.amounts[0]).toMatchObject({ currency: 'MXN', value: 5000 })
  })

  it('extracts 13-character natural-person RFCs', () => {
    const r = extractDataRefs(['Proveedor con RFC MELA850512H21 ya registrado.'])
    expect(r.suppliers).toEqual(['MELA850512H21'])
  })

  it('extracts 12-character moral-person RFCs', () => {
    const r = extractDataRefs(['Factura de EVP920101XYZ por 5,000 MXN.'])
    expect(r.suppliers).toEqual(['EVP920101XYZ'])
  })

  it('extracts PRV_ supplier codes', () => {
    const r = extractDataRefs(['Proveedor PRV_1234 aún sin nombre resuelto; ver PRV_56.'])
    expect(r.suppliers).toEqual(['PRV_1234', 'PRV_56'])
  })

  it('deduplicates repeated supplier references', () => {
    const r = extractDataRefs([
      'PRV_1234 — primera mención.',
      'PRV_1234 — segunda mención.',
    ])
    expect(r.suppliers).toEqual(['PRV_1234'])
  })

  it('ignores short sequences that look RFC-ish but are not', () => {
    const r = extractDataRefs(['Codigo ABC12 no es RFC.'])
    expect(r.suppliers).toEqual([])
  })

  it('caps supplier list at MAX_REFS_PER_KIND', () => {
    const many = Array.from({ length: 20 }, (_, i) => `PRV_${i + 1000}`).join(' ')
    const r = extractDataRefs([many])
    expect(r.suppliers.length).toBe(DATA_REFS_CONSTANTS.MAX_REFS_PER_KIND)
  })
})
