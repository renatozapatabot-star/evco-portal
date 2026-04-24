import { describe, it, expect } from 'vitest'
import { detectMissingNom, buildNomMensajeria } from '../detectors/missing-nom'
import {
  detectHighValueRisk,
  __internal as HV,
} from '../detectors/high-value-risk'
import {
  detectDuplicateShipment,
  scoreDuplicate,
  __internal as DUP,
} from '../detectors/duplicate-shipment'
import type { DetectorContext, PartidaRow, TraficoRow } from '../types'
import { NOM_REGULATED_FRACTION_PREFIXES, fractionPrefix4, isNomRegulated } from '../nom-registry'

function makeContext(
  traficos: TraficoRow[],
  partidasByTrafico: Map<string, PartidaRow[]> = new Map(),
  entradas: DetectorContext['entradas'] = [],
): DetectorContext {
  return {
    companyId: 'evco',
    traficos,
    partidasByTrafico,
    entradas,
    nomRegulatedFracciones: NOM_REGULATED_FRACTION_PREFIXES,
  }
}

function trafico(partial: Partial<TraficoRow>): TraficoRow {
  return {
    trafico: 'T001',
    estatus: 'En Proceso',
    fecha_llegada: '2026-04-20T10:00:00Z',
    pedimento: null,
    proveedores: 'Duratech',
    valor_aduana_mxn: null,
    valor_comercial_usd: null,
    company_id: 'evco',
    ...partial,
  }
}

function partida(partial: Partial<PartidaRow>): PartidaRow {
  return {
    trafico: 'T001',
    fraccion: '3901.20.01',
    descripcion: 'Resina de polietileno',
    valor_comercial_usd: 1000,
    cantidad: 100,
    unidad: 'KG',
    nom_certificate: null,
    ...partial,
  }
}

describe('nom-registry', () => {
  it('extracts 4-digit prefix while preserving fraction format', () => {
    expect(fractionPrefix4('6101.10.01')).toBe('6101')
    expect(fractionPrefix4('3901.20.01')).toBe('3901')
    expect(fractionPrefix4('invalid')).toBeNull()
    expect(fractionPrefix4(null)).toBeNull()
  })

  it('flags NOM-regulated fracciones', () => {
    expect(isNomRegulated('6101.10.01')).toBe(true) // textiles
    expect(isNomRegulated('8516.50.01')).toBe(true) // electrical
    expect(isNomRegulated('9999.99.99')).toBe(false)
    expect(isNomRegulated(null)).toBe(false)
  })
})

describe('detectMissingNom', () => {
  it('flags an active trafico with a NOM fracción and no certificate', () => {
    const t = trafico({ trafico: '26-24-3596-001', proveedores: 'Duratech', estatus: 'En Proceso' })
    const p = partida({ trafico: t.trafico, fraccion: '6101.10.01', nom_certificate: null })
    const ctx = makeContext([t], new Map([[t.trafico, [p]]]))
    const out = detectMissingNom(ctx)
    expect(out).toHaveLength(1)
    expect(out[0]!.kind).toBe('missing_nom')
    expect(out[0]!.severity).toBe('warning')
    expect(out[0]!.signature).toContain(t.trafico)
    expect(out[0]!.signature).toContain('6101.10.01')
    if (out[0]!.proposal.action !== 'draft_mensajeria') {
      throw new Error('expected mensajeria proposal')
    }
    expect(out[0]!.proposal.body_es).toContain('Duratech')
    expect(out[0]!.proposal.body_es).toContain('6101.10.01')
  })

  it('skips non-NOM fracciones', () => {
    const t = trafico({})
    const p = partida({ fraccion: '3901.20.01' }) // plastics raw material, not on NOM registry
    const ctx = makeContext([t], new Map([[t.trafico, [p]]]))
    expect(detectMissingNom(ctx)).toHaveLength(0)
  })

  it('skips Cruzado / cerrado traficos', () => {
    const t = trafico({ estatus: 'Cruzado' })
    const p = partida({ fraccion: '6101.10.01', nom_certificate: null })
    const ctx = makeContext([t], new Map([[t.trafico, [p]]]))
    expect(detectMissingNom(ctx)).toHaveLength(0)
  })

  it('skips when nom_certificate is already present', () => {
    const t = trafico({})
    const p = partida({ fraccion: '6101.10.01', nom_certificate: 'NOM-004/2026/A' })
    const ctx = makeContext([t], new Map([[t.trafico, [p]]]))
    expect(detectMissingNom(ctx)).toHaveLength(0)
  })

  it('builds a supplier-specific Mensajería draft', () => {
    const t = trafico({ trafico: 'T-abc', proveedores: 'Milacron' })
    const p = partida({ fraccion: '9405.40.01', descripcion: 'Luminaria LED' })
    const draft = buildNomMensajeria(t, p)
    expect(draft.subject_es).toContain('T-abc')
    expect(draft.body_es).toContain('Milacron')
    expect(draft.body_es).toContain('9405.40.01')
    expect(draft.attach_doc_types).toEqual(['nom_certificate'])
  })
})

describe('detectHighValueRisk', () => {
  it('flags an unusual value vs supplier median', () => {
    const base = Array.from({ length: 5 }, (_, i) =>
      trafico({ trafico: `T-normal-${i}`, valor_comercial_usd: 10_000, pedimento: '26 24 3596 000' + i }),
    )
    const outlier = trafico({
      trafico: 'T-outlier',
      valor_comercial_usd: 60_000,
      pedimento: null,
    })
    const ctx = makeContext([...base, outlier])
    const out = detectHighValueRisk(ctx).filter((f) => f.signature.includes('unusual_value'))
    expect(out.some((f) => f.subject_id === 'T-outlier')).toBe(true)
    const outlierFinding = out.find((f) => f.subject_id === 'T-outlier')!
    expect(outlierFinding.evidence.pattern).toBe('unusual_value')
    expect((outlierFinding.evidence.multiplier as number) >= 3).toBe(true)
  })

  it('flags duplicate pedimentos across distinct traficos', () => {
    const a = trafico({ trafico: 'T-A', pedimento: '26 24 3596 0001234' })
    const b = trafico({ trafico: 'T-B', pedimento: '26 24 3596 0001234' })
    const ctx = makeContext([a, b])
    const out = detectHighValueRisk(ctx).filter((f) => f.signature.includes('duplicate_pedimento'))
    expect(out).toHaveLength(2)
    expect(out[0]!.severity).toBe('critical')
    expect(out[0]!.subject_type).toBe('pedimento')
  })

  it('flags fracción mismatches across same description', () => {
    const a = trafico({ trafico: 'T-A' })
    const b = trafico({ trafico: 'T-B' })
    const partidas = new Map<string, PartidaRow[]>([
      [
        'T-A',
        [
          partida({ trafico: 'T-A', fraccion: '3901.20.01', descripcion: 'Resina PE de alta densidad' }),
          partida({ trafico: 'T-A', fraccion: '3901.20.01', descripcion: 'Resina PE de alta densidad' }),
          partida({ trafico: 'T-A', fraccion: '3901.20.01', descripcion: 'Resina PE de alta densidad' }),
        ],
      ],
      [
        'T-B',
        [
          partida({ trafico: 'T-B', fraccion: '3902.10.99', descripcion: 'Resina PE de alta densidad' }),
        ],
      ],
    ])
    const ctx = makeContext([a, b], partidas)
    const out = detectHighValueRisk(ctx).filter((f) => f.signature.includes('fraccion_mismatch'))
    expect(out).toHaveLength(1)
    expect(out[0]!.subject_id).toBe('T-B')
    expect(out[0]!.evidence.fraccion_canonica).toBe('3901.20.01')
  })

  it('emits no unusual_value findings when there is no history to compare', () => {
    const onlyOne = trafico({ trafico: 'T-solo', valor_comercial_usd: 10_000 })
    const ctx = makeContext([onlyOne])
    const out = detectHighValueRisk(ctx).filter((f) => f.signature.includes('unusual_value'))
    expect(out).toHaveLength(0)
  })

  it('median helper handles even + odd + empty inputs', () => {
    expect(HV.median([1, 2, 3])).toBe(2)
    expect(HV.median([1, 2, 3, 4])).toBe(2.5)
    expect(HV.median([])).toBeNull()
    expect(HV.median([0, -5])).toBeNull()
  })
})

describe('detectDuplicateShipment', () => {
  it('flags two same-day same-supplier same-value traficos with overlapping invoices', () => {
    const a = trafico({
      trafico: 'T-A',
      proveedores: 'Duratech',
      fecha_llegada: '2026-04-21T09:00:00Z',
      valor_comercial_usd: 10_000,
    })
    const b = trafico({
      trafico: 'T-B',
      proveedores: 'Duratech',
      fecha_llegada: '2026-04-21T11:00:00Z',
      valor_comercial_usd: 10_050,
    })
    const entradas = [
      { id: 'e1', trafico: 'T-A', proveedor: 'Duratech', invoice_number: 'INV-2026/04-001', valor_usd: 10000, fecha_llegada_mercancia: '2026-04-21T09:00:00Z', company_id: 'evco' },
      { id: 'e2', trafico: 'T-B', proveedor: 'Duratech', invoice_number: 'INV 2026 04 001', valor_usd: 10050, fecha_llegada_mercancia: '2026-04-21T11:00:00Z', company_id: 'evco' },
    ]
    const ctx = makeContext([a, b], new Map(), entradas)
    const out = detectDuplicateShipment(ctx)
    expect(out).toHaveLength(1)
    expect(out[0]!.kind).toBe('duplicate_shipment')
    if (out[0]!.proposal.action !== 'merge_shipments') {
      throw new Error('expected merge proposal')
    }
    expect(out[0]!.proposal.primary_trafico).toBe('T-A')
    expect(out[0]!.proposal.duplicate_trafico).toBe('T-B')
    expect(out[0]!.proposal.fields_to_reconcile).toContain('invoice_number')
  })

  it('rejects pairs below the score threshold', () => {
    const a = trafico({ trafico: 'T-A', proveedores: 'Duratech', valor_comercial_usd: 10_000 })
    const b = trafico({ trafico: 'T-B', proveedores: 'Milacron', valor_comercial_usd: 99_999 })
    const ctx = makeContext([a, b])
    expect(detectDuplicateShipment(ctx)).toHaveLength(0)
  })

  it('scoreDuplicate is bounded in [0,1]', () => {
    const a = trafico({ trafico: 'T-A', proveedores: 'X', valor_comercial_usd: 100 })
    const b = trafico({ trafico: 'T-B', proveedores: 'X', valor_comercial_usd: 100 })
    const invA = new Set(['INV1'])
    const invB = new Set(['INV1'])
    const scored = scoreDuplicate(a, b, invA, invB)
    expect(scored.score).toBeGreaterThan(0.6)
    expect(scored.score).toBeLessThanOrEqual(1)
  })

  it('normalizes invoice numbers to collapse formatting variants', () => {
    expect(DUP.normalizeInvoice('INV-2026/04-001')).toBe('inv202604001')
    expect(DUP.normalizeInvoice('inv 2026 04 001')).toBe('inv202604001')
    expect(DUP.normalizeInvoice(null)).toBe('')
  })

  it('valueWithinTolerance uses a 2% band', () => {
    expect(DUP.valueWithinTolerance(100, 101)).toBe(true)
    expect(DUP.valueWithinTolerance(100, 110)).toBe(false)
    expect(DUP.valueWithinTolerance(null, 100)).toBe(false)
  })
})
