import { describe, it, expect } from 'vitest'
import {
  buildCrossingStream,
  projectForPartStreaks,
  projectForProveedorHealth,
  projectForFraccionHealth,
  projectForVolumeSummary,
  type CrossingStreamRow,
} from '../crossing-stream'
import type { ResolvedLinks, PartidaTraficoLink } from '@/lib/queries/partidas-trafico-link'

function link(overrides: Partial<PartidaTraficoLink> = {}): PartidaTraficoLink {
  return {
    cve_trafico: 'T-1',
    pedimento: null,
    fecha_cruce: '2026-04-18T00:00:00Z',
    fecha_llegada: '2026-04-17T00:00:00Z',
    semaforo: 0,
    fecha_facturacion: '2026-04-16T00:00:00Z',
    valor_comercial: 1000,
    ...overrides,
  }
}

function resolved(entries: Array<[number, PartidaTraficoLink]>): ResolvedLinks {
  return { byFolio: new Map(entries), distinctCveTraficos: [] }
}

describe('buildCrossingStream', () => {
  it('returns [] on empty input', () => {
    expect(
      buildCrossingStream({ partidas: [], links: resolved([]) }),
    ).toEqual([])
  })

  it('drops partidas without a resolved link', () => {
    const out = buildCrossingStream({
      partidas: [
        { cve_producto: 'A', cve_proveedor: 'P', folio: 1 },
        { cve_producto: 'B', cve_proveedor: 'P', folio: 2 },
      ],
      links: resolved([[1, link()]]), // only folio 1 has a link
    })
    expect(out).toHaveLength(1)
    expect(out[0].cve_producto).toBe('A')
  })

  it('drops rows with null fecha_cruce by default', () => {
    const out = buildCrossingStream({
      partidas: [
        { cve_producto: 'A', cve_proveedor: 'P', folio: 1 },
        { cve_producto: 'B', cve_proveedor: 'P', folio: 2 },
      ],
      links: resolved([
        [1, link({ fecha_cruce: '2026-04-18' })],
        [2, link({ fecha_cruce: null })],
      ]),
    })
    expect(out).toHaveLength(1)
    expect(out[0].cve_producto).toBe('A')
  })

  it('includeUnfiled: keeps both filed + unfiled rows', () => {
    const out = buildCrossingStream({
      partidas: [
        { cve_producto: 'A', cve_proveedor: 'P', folio: 1 },
        { cve_producto: 'B', cve_proveedor: 'P', folio: 2 },
        { cve_producto: 'C', cve_proveedor: 'P', folio: 3 }, // no link
      ],
      links: resolved([
        [1, link({ fecha_cruce: '2026-04-18' })],
        [2, link({ fecha_cruce: null })],
      ]),
      includeUnfiled: true,
    })
    expect(out).toHaveLength(3)
    expect(out.find((r) => r.cve_producto === 'C')?.fecha_cruce).toBeNull()
  })

  it('coerces semaforo to 0/1/2/null only', () => {
    const out = buildCrossingStream({
      partidas: [
        { cve_producto: 'A', cve_proveedor: 'P', folio: 1 },
        { cve_producto: 'B', cve_proveedor: 'P', folio: 2 },
        { cve_producto: 'C', cve_proveedor: 'P', folio: 3 },
      ],
      links: resolved([
        [1, link({ semaforo: 0 })],
        [2, link({ semaforo: 5 as 0 })], // invalid → null
        [3, link({ semaforo: null })],
      ]),
    })
    expect(out.find((r) => r.cve_producto === 'A')?.semaforo).toBe(0)
    expect(out.find((r) => r.cve_producto === 'B')?.semaforo).toBeNull()
    expect(out.find((r) => r.cve_producto === 'C')?.semaforo).toBeNull()
  })

  it('attaches fraccion when fraccionByCve provided', () => {
    const out = buildCrossingStream({
      partidas: [
        { cve_producto: 'SKU-A', cve_proveedor: 'P', folio: 1 },
        { cve_producto: 'SKU-B', cve_proveedor: 'P', folio: 2 },
        { cve_producto: null, cve_proveedor: 'P', folio: 3 },
      ],
      links: resolved([
        [1, link()],
        [2, link()],
        [3, link()],
      ]),
      fraccionByCve: new Map([
        ['SKU-A', '3903.20.01'],
        // SKU-B missing from map — should be null
      ]),
    })
    expect(out.find((r) => r.cve_producto === 'SKU-A')?.fraccion).toBe('3903.20.01')
    expect(out.find((r) => r.cve_producto === 'SKU-B')?.fraccion).toBeNull()
    expect(out.find((r) => r.cve_producto === null)?.fraccion).toBeNull()
  })

  it('fraccion is always null when fraccionByCve is absent', () => {
    const out = buildCrossingStream({
      partidas: [{ cve_producto: 'SKU-A', cve_proveedor: 'P', folio: 1 }],
      links: resolved([[1, link()]]),
    })
    expect(out[0].fraccion).toBeNull()
  })
})

describe('projection helpers', () => {
  const stream: CrossingStreamRow[] = [
    { cve_producto: 'A', cve_proveedor: 'P1', fraccion: '39.20.01', fecha_cruce: '2026-04-18', semaforo: 0 },
    { cve_producto: null, cve_proveedor: 'P1', fraccion: null, fecha_cruce: '2026-04-17', semaforo: 1 },
    { cve_producto: 'B', cve_proveedor: null, fraccion: null, fecha_cruce: '2026-04-16', semaforo: 0 },
  ]

  it('projectForPartStreaks drops rows without cve_producto', () => {
    const p = projectForPartStreaks(stream)
    expect(p).toHaveLength(2)
    expect(p.every((r) => typeof r.cve_producto === 'string')).toBe(true)
  })

  it('projectForProveedorHealth drops rows without cve_proveedor', () => {
    const p = projectForProveedorHealth(stream)
    expect(p).toHaveLength(2)
    expect(p.every((r) => typeof r.cve_proveedor === 'string')).toBe(true)
  })

  it('projectForFraccionHealth keeps all rows (nulls allowed)', () => {
    const p = projectForFraccionHealth(stream)
    expect(p).toHaveLength(3)
  })

  it('projectForVolumeSummary keeps all rows with fecha_cruce + semaforo', () => {
    const p = projectForVolumeSummary(stream)
    expect(p).toHaveLength(3)
    expect(p[0].fecha_cruce).toBe('2026-04-18')
  })
})
