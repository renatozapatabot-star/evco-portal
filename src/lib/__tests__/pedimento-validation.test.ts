/**
 * CRUZ · Block 6c — Pedimento validation engine tests.
 *
 * 14 tests cover the matrix called out in the plan:
 *   patente / aduana format, regime+document_type consistency, RFC,
 *   exchange rate range warning, partidas requirements, fracción format,
 *   cantidad, DTA+pago_virtual, partida sum vs declared total,
 *   transportista requirement, empty observations tolerated, complete
 *   valid pedimento returns zero errors.
 */

import { describe, it, expect } from 'vitest'
import { validatePedimento } from '@/lib/pedimento-validation'
import type {
  FullPedimento,
  PedimentoRow,
  PedimentoPartidaLite,
  ContribucionRow,
  PagoVirtualRow,
  TransportistaRow,
} from '@/lib/pedimento-types'

function makeParent(overrides: Partial<PedimentoRow> = {}): PedimentoRow {
  return {
    id: 'ped-1',
    trafico_id: 'TRF-TEST-001',
    company_id: 'TEST',
    cliente_id: 'TEST',
    pedimento_number: '26 24 3596 6500441',
    patente: '3596',
    aduana: '240',
    pre_validador: '010',
    document_type: 'IM',
    regime_type: 'A1',
    destination_origin: null,
    transport_entry: '3',
    transport_arrival: '3',
    transport_exit: '3',
    exchange_rate: 17.4321,
    cliente_rfc: 'EPM010203XYZ',
    validation_signature: null,
    bank_signature: null,
    sat_transaction_number: null,
    bank_operation_number: null,
    observations: null,
    identifiers: {},
    status: 'borrador',
    created_at: '2026-04-10T00:00:00Z',
    updated_at: '2026-04-10T00:00:00Z',
    ...overrides,
  }
}

function makePartida(overrides: Partial<PedimentoPartidaLite> = {}): PedimentoPartidaLite {
  return {
    fraccion: '3901.20.01',
    cantidad: 100,
    pais_origen: 'USA',
    valor_comercial: 5000,
    ...overrides,
  }
}

function makeTransportista(
  overrides: Partial<TransportistaRow> = {},
): TransportistaRow {
  return {
    id: 'trp-1',
    pedimento_id: 'ped-1',
    carrier_type: 'mx',
    carrier_id: null,
    carrier_name: 'Transportes Prueba',
    created_at: '2026-04-10T00:00:00Z',
    ...overrides,
  }
}

function makeFull(overrides: Partial<FullPedimento> = {}): FullPedimento {
  return {
    parent: makeParent(),
    destinatarios: [],
    compensaciones: [],
    pagos_virtuales: [],
    guias: [],
    transportistas: [makeTransportista()],
    candados: [],
    descargas: [],
    cuentas_garantia: [],
    contribuciones: [],
    facturas: [
      {
        id: 'f1',
        pedimento_id: 'ped-1',
        supplier_name: 'ACME Co',
        supplier_tax_id: null,
        invoice_number: 'INV-1',
        invoice_date: '2026-04-01',
        currency: 'USD',
        amount: 5000,
        created_at: '2026-04-10T00:00:00Z',
      },
    ],
    partidas: [makePartida()],
    exchange_rate_reference: 17.5,
    declared_total_mxn: undefined,
    ...overrides,
  }
}

describe('validatePedimento', () => {
  it('1 · flags invalid patente format', () => {
    const errs = validatePedimento(makeFull({ parent: makeParent({ patente: '59' }) }))
    expect(errs.some((e) => e.field === 'patente' && e.severity === 'error')).toBe(true)
  })

  it('2 · flags invalid aduana format', () => {
    const errs = validatePedimento(makeFull({ parent: makeParent({ aduana: '24' }) }))
    expect(errs.some((e) => e.field === 'aduana' && e.severity === 'error')).toBe(true)
  })

  it('3 · flags regime+document_type inconsistency (EX + IM)', () => {
    const errs = validatePedimento(
      makeFull({
        parent: makeParent({ regime_type: 'EX', document_type: 'IM' }),
        transportistas: [makeTransportista()],
      }),
    )
    expect(
      errs.some((e) => e.field === 'document_type' && e.severity === 'error'),
    ).toBe(true)
  })

  it('4 · accepts IM + A1 as consistent (no document_type error)', () => {
    const errs = validatePedimento(makeFull())
    expect(errs.filter((e) => e.field === 'document_type')).toHaveLength(0)
  })

  it('5 · flags malformed RFC', () => {
    const errs = validatePedimento(
      makeFull({ parent: makeParent({ cliente_rfc: 'no-es-rfc' }) }),
    )
    expect(
      errs.some((e) => e.field === 'cliente_rfc' && e.severity === 'error'),
    ).toBe(true)
  })

  it('6 · warns when exchange_rate is far from reference', () => {
    const errs = validatePedimento(
      makeFull({
        parent: makeParent({ exchange_rate: 40 }),
        exchange_rate_reference: 17.5,
      }),
    )
    expect(
      errs.some((e) => e.field === 'exchange_rate' && e.severity === 'warning'),
    ).toBe(true)
  })

  it('7 · requires at least one partida for goods regime', () => {
    const errs = validatePedimento(makeFull({ partidas: [] }))
    expect(
      errs.some((e) => e.field === 'partidas' && e.severity === 'error'),
    ).toBe(true)
  })

  it('8 · enforces fracción format XXXX.XX.XX', () => {
    const errs = validatePedimento(
      makeFull({ partidas: [makePartida({ fraccion: '39012001' })] }),
    )
    expect(
      errs.some((e) => e.field.endsWith('.fraccion') && e.severity === 'error'),
    ).toBe(true)
  })

  it('9 · requires cantidad > 0 on every partida', () => {
    const errs = validatePedimento(
      makeFull({ partidas: [makePartida({ cantidad: 0 })] }),
    )
    expect(
      errs.some((e) => e.field.endsWith('.cantidad') && e.severity === 'error'),
    ).toBe(true)
  })

  it('10 · flags DTA > 0 without pago virtual', () => {
    const contribuciones: ContribucionRow[] = [
      {
        id: 'c1',
        pedimento_id: 'ped-1',
        contribution_type: 'DTA',
        rate: 0.008,
        base: 100000,
        amount: 800,
        created_at: '2026-04-10T00:00:00Z',
      },
    ]
    const pagos_virtuales: PagoVirtualRow[] = []
    const errs = validatePedimento(makeFull({ contribuciones, pagos_virtuales }))
    expect(
      errs.some((e) => e.field === 'pago_virtual' && e.severity === 'error'),
    ).toBe(true)
  })

  it('11 · detects partida sum mismatch vs declared total', () => {
    const errs = validatePedimento(
      makeFull({
        partidas: [makePartida({ valor_comercial: 1000 })],
        declared_total_mxn: 5000,
      }),
    )
    expect(
      errs.some((e) => e.tab === 'partidas' && e.field === 'total'),
    ).toBe(true)
  })

  it('12 · requires at least one transportista for goods regime', () => {
    const errs = validatePedimento(makeFull({ transportistas: [] }))
    expect(
      errs.some(
        (e) => e.field === 'transportistas' && e.severity === 'error',
      ),
    ).toBe(true)
  })

  it('13 · empty observations field is accepted (not required)', () => {
    const errs = validatePedimento(
      makeFull({ parent: makeParent({ observations: null }) }),
    )
    expect(errs.filter((e) => e.field === 'observations')).toHaveLength(0)
  })

  it('14 · complete valid pedimento returns zero errors (warnings allowed)', () => {
    const errs = validatePedimento(makeFull())
    const errorCount = errs.filter((e) => e.severity === 'error').length
    expect(errorCount).toBe(0)
  })

  it('15 · import (IM) without facturas fails validation', () => {
    const errs = validatePedimento(makeFull({ facturas: [] }))
    expect(
      errs.some((e) => e.tab === 'facturas_proveedores' && e.field === 'facturas'),
    ).toBe(true)
  })
})
