/**
 * AGUILA · Block 9 — Pedimento export structure tests.
 *
 * Four tests: envelope shape, missing-required rejection via validation,
 * storage path convention, placeholder marker + JSON round-trip.
 */

import { describe, it, expect } from 'vitest'
import {
  exportPedimentoAduanetPlaceholder,
  buildAduanetPlaceholderEnvelope,
  getBlockingErrors,
  buildExportStoragePath,
  EXPORT_FORMAT_VERSION,
} from '@/lib/pedimento-export'
import type {
  FullPedimento,
  PedimentoRow,
  PedimentoPartidaLite,
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
    destination_origin: 'MX → US',
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

function makePartida(o: Partial<PedimentoPartidaLite> = {}): PedimentoPartidaLite {
  return {
    fraccion: '3901.20.01',
    cantidad: 100,
    pais_origen: 'USA',
    valor_comercial: 5000,
    ...o,
  }
}

function makeTransportista(o: Partial<TransportistaRow> = {}): TransportistaRow {
  return {
    id: 'trp-1',
    pedimento_id: 'ped-1',
    carrier_type: 'mx',
    carrier_id: null,
    carrier_name: 'Transportes Prueba',
    created_at: '2026-04-10T00:00:00Z',
    ...o,
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

describe('exportPedimentoAduanetPlaceholder', () => {
  it('produces the placeholder envelope with es-MX keys and the pedimento number preserved with spaces', () => {
    const env = buildAduanetPlaceholderEnvelope(makeFull())
    expect(env.formato).toBe(EXPORT_FORMAT_VERSION)
    expect(env.encabezado.pedimento).toBe('26 24 3596 6500441')
    expect(env.encabezado.patente).toBe('3596')
    expect(env.encabezado.aduana).toBe('240')
    expect(env.partidas[0].fraccion).toBe('3901.20.01')
    expect(env.facturas[0].numero).toBe('INV-1')
    expect(env.transportistas[0].nombre).toBe('Transportes Prueba')
    expect(env.aviso.toLowerCase()).toContain('placeholder')
  })

  it('getBlockingErrors flags missing partidas on a goods regime so export refuses', () => {
    const ped = makeFull({ partidas: [] })
    const errors = getBlockingErrors(ped)
    expect(errors.length).toBeGreaterThan(0)
    expect(errors.some(e => e.tab === 'partidas')).toBe(true)
  })

  it('buildExportStoragePath returns the tenant-scoped path the API writes to', () => {
    const path = buildExportStoragePath({
      companyId: 'TEST',
      pedimentoId: 'ped-1',
      timestamp: 1700000000000,
    })
    expect(path).toBe('TEST/ped-1/1700000000000_v1_placeholder.json')
  })

  it('produces valid JSON that round-trips and marks itself as a placeholder', () => {
    const json = exportPedimentoAduanetPlaceholder(makeFull())
    const parsed = JSON.parse(json) as { formato: string; aviso: string }
    expect(parsed.formato).toBe(EXPORT_FORMAT_VERSION)
    expect(parsed.aviso).toMatch(/placeholder/i)
  })
})
