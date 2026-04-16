/**
 * CRUZ · V1.5 F17 — Pedimento PDF pure render tests.
 *
 * Validates the pure render pipeline:
 *  1. renderPedimentoPdf returns a PDF buffer (starts with %PDF-).
 *  2. Produces non-empty output even when children tables are empty.
 *  3. No I/O is required (pure function — no DB, no network).
 */

import { describe, it, expect } from 'vitest'
import { renderPedimentoPdf } from '@/lib/pedimento/render-pdf'
import type {
  FullPedimento,
  PedimentoRow,
} from '@/lib/pedimento-types'

function makeParent(): PedimentoRow {
  return {
    id: 'ped-f17',
    trafico_id: 'TRF-F17',
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
  }
}

function makeFull(): FullPedimento {
  return {
    parent: makeParent(),
    destinatarios: [],
    compensaciones: [],
    pagos_virtuales: [],
    guias: [],
    transportistas: [],
    candados: [],
    descargas: [],
    cuentas_garantia: [],
    contribuciones: [],
    facturas: [],
    partidas: [
      { fraccion: '3901.20.01', cantidad: 100, pais_origen: 'USA', valor_comercial: 5000 },
    ],
    exchange_rate_reference: 17.5,
    declared_total_mxn: undefined,
  }
}

describe('renderPedimentoPdf', () => {
  it('returns a PDF buffer with the %PDF- magic header', async () => {
    const full = makeFull()
    const buf = await renderPedimentoPdf(full, '2026-04-12T00:00:00Z')
    expect(Buffer.isBuffer(buf)).toBe(true)
    expect(buf.length).toBeGreaterThan(200)
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  }, 20000)

  it('renders even with zero child rows (all optional sections empty)', async () => {
    const full: FullPedimento = { ...makeFull(), partidas: [], facturas: [] }
    const buf = await renderPedimentoPdf(full, '2026-04-12T00:00:00Z')
    expect(buf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(200)
  }, 20000)
})
