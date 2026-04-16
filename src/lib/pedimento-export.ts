// PLACEHOLDER AduanaNet M3 format. Replace this function body when a real M3
// sample is available. Spec: docs/recon/V2_ADUANET_RECON.md.
//
// CRUZ · Block 9 — Pedimento Interface Export (structure only).
// Pure function. Serializes a FullPedimento into a JSON string with es-MX
// field names. No I/O. The API route is the only place storage/DB writes
// happen; this module stays hot-swappable.

import type { FullPedimento, ValidationError } from './pedimento-types'
import { validatePedimento } from './pedimento-validation'

export type ExportFormat = 'aduanet_m3_v1_placeholder'

export const EXPORT_FORMAT_VERSION: ExportFormat = 'aduanet_m3_v1_placeholder'

export const EXPORT_FORMAT_LABEL_ES = 'AduanaNet M3 v1 · placeholder'

export interface PedimentoExportEnvelope {
  formato: ExportFormat
  generado_en: string
  aviso: string
  encabezado: {
    pedimento: string | null
    patente: string
    aduana: string
    pre_validador: string | null
    tipo_documento: string | null
    regimen: string | null
    rfc_cliente: string | null
    tipo_cambio: number | null
    origen_destino: string | null
  }
  partidas: Array<{
    fraccion: string | null
    cantidad: number | null
    pais_origen: string | null
    valor_comercial_mxn: number | null
  }>
  facturas: Array<{
    numero: string | null
    proveedor: string | null
    rfc_proveedor: string | null
    fecha: string | null
    moneda: string | null
    monto: number | null
  }>
  destinatarios: Array<{ razon_social: string | null; rfc: string | null }>
  transportistas: Array<{ tipo: string; nombre: string | null }>
  contribuciones: Array<{
    tipo: string | null
    tasa: number | null
    base: number | null
    monto: number | null
  }>
  pagos_virtuales: Array<{
    banco: string | null
    forma_pago: string | null
    monto: number | null
    referencia: string | null
  }>
}

/**
 * Build the envelope (object) — exposed for tests + callers that want
 * structured data rather than a JSON string.
 */
export function buildAduanetPlaceholderEnvelope(
  ped: FullPedimento,
): PedimentoExportEnvelope {
  const parent = ped.parent
  return {
    formato: EXPORT_FORMAT_VERSION,
    generado_en: new Date().toISOString(),
    aviso:
      'Formato AduanaNet M3 pendiente — estructura placeholder. ' +
      'Reemplazar cuando tengamos archivo de referencia.',
    encabezado: {
      pedimento: parent.pedimento_number,
      patente: parent.patente,
      aduana: parent.aduana,
      pre_validador: parent.pre_validador,
      tipo_documento: parent.document_type,
      regimen: parent.regime_type,
      rfc_cliente: parent.cliente_rfc,
      tipo_cambio: parent.exchange_rate,
      origen_destino: parent.destination_origin,
    },
    partidas: ped.partidas.map(p => ({
      fraccion: p.fraccion,
      cantidad: p.cantidad,
      pais_origen: p.pais_origen,
      valor_comercial_mxn: p.valor_comercial,
    })),
    facturas: ped.facturas.map(f => ({
      numero: f.invoice_number,
      proveedor: f.supplier_name,
      rfc_proveedor: f.supplier_tax_id,
      fecha: f.invoice_date,
      moneda: f.currency,
      monto: f.amount,
    })),
    destinatarios: ped.destinatarios.map(d => ({
      razon_social: d.razon_social,
      rfc: d.rfc,
    })),
    transportistas: ped.transportistas.map(t => ({
      tipo: t.carrier_type,
      nombre: t.carrier_name,
    })),
    contribuciones: ped.contribuciones.map(c => ({
      tipo: c.contribution_type,
      tasa: c.rate,
      base: c.base,
      monto: c.amount,
    })),
    pagos_virtuales: ped.pagos_virtuales.map(pv => ({
      banco: pv.bank_code,
      forma_pago: pv.payment_form,
      monto: pv.amount,
      referencia: pv.reference,
    })),
  }
}

/**
 * Serialize a pedimento as an AduanaNet M3 placeholder JSON string.
 * Pretty-printed (2-space indent) so operators can eyeball the output while
 * the real format is pending.
 */
export function exportPedimentoAduanetPlaceholder(ped: FullPedimento): string {
  return JSON.stringify(buildAduanetPlaceholderEnvelope(ped), null, 2)
}

/**
 * Runs the validation engine and splits errors/warnings. Callers use this
 * to refuse export when blocking errors exist.
 */
export function getBlockingErrors(ped: FullPedimento): ValidationError[] {
  return validatePedimento(ped).filter(e => e.severity === 'error')
}

/**
 * Storage path convention. Tested so the contract stays stable when the
 * real M3 format lands.
 */
export function buildExportStoragePath(params: {
  companyId: string
  pedimentoId: string
  timestamp?: number
}): string {
  const ts = params.timestamp ?? Date.now()
  return `${params.companyId}/${params.pedimentoId}/${ts}_v1_placeholder.json`
}
