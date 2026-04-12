/**
 * AGUILA · Block 6a — Pedimento types.
 *
 * Shapes for the 14-tab pedimento editor. FK convention:
 * `trafico_id` is TEXT matching `traficos.trafico`; `pedimento_id` is UUID.
 * All monetary fields denominated in MXN unless a sibling currency field says otherwise.
 */

export type PedimentoStatus =
  | 'borrador'
  | 'validado'
  | 'firmado'
  | 'pagado'
  | 'cruzado'
  | 'cancelado'

export type DocumentType = 'IM' | 'EX' | 'C1' | 'T1' | 'F4'

export type RegimeType =
  | 'A1' | 'IN' | 'EX' | 'H1' | 'F4' | 'T1' | 'V1'
  | 'ITE' | 'ITR' | 'IMD' | 'RT'

export type CarrierType = 'mx' | 'transfer' | 'foreign'

export type TabId =
  | 'inicio'
  | 'datos_generales'
  | 'cliente_observaciones'
  | 'facturas_proveedores'
  | 'destinatarios'
  | 'partidas'
  | 'compensaciones'
  | 'pagos_virtuales'
  | 'guias_contenedores'
  | 'transportistas'
  | 'candados'
  | 'descargas'
  | 'cuentas_garantia'
  | 'contribuciones'

export const TAB_LABELS_ES: Record<TabId, string> = {
  inicio: 'Inicio',
  datos_generales: 'Datos Generales',
  cliente_observaciones: 'Cliente / Observaciones',
  facturas_proveedores: 'Facturas / Proveedores',
  destinatarios: 'Destinatarios',
  partidas: 'Partidas',
  compensaciones: 'Compensaciones',
  pagos_virtuales: 'Formas de Pago Virtuales',
  guias_contenedores: 'Guías / Contenedores',
  transportistas: 'Transportistas',
  candados: 'Candados',
  descargas: 'Descargas',
  cuentas_garantia: 'Cuentas de Garantía',
  contribuciones: 'Contribuciones',
}

export const TAB_ORDER: readonly TabId[] = [
  'inicio',
  'datos_generales',
  'cliente_observaciones',
  'facturas_proveedores',
  'destinatarios',
  'partidas',
  'compensaciones',
  'pagos_virtuales',
  'guias_contenedores',
  'transportistas',
  'candados',
  'descargas',
  'cuentas_garantia',
  'contribuciones',
] as const

export interface PedimentoRow {
  id: string
  trafico_id: string
  company_id: string
  cliente_id: string
  pedimento_number: string | null
  patente: string
  aduana: string
  pre_validador: string | null
  document_type: DocumentType | null
  regime_type: RegimeType | null
  destination_origin: string | null
  transport_entry: string | null
  transport_arrival: string | null
  transport_exit: string | null
  exchange_rate: number | null
  cliente_rfc: string | null
  validation_signature: string | null
  bank_signature: string | null
  sat_transaction_number: string | null
  bank_operation_number: string | null
  observations: string | null
  status: PedimentoStatus
  created_at: string
  updated_at: string
}

export interface DestinatarioRow {
  id: string
  pedimento_id: string
  razon_social: string | null
  rfc: string | null
  address: Record<string, unknown>
  created_at: string
}

export interface CompensacionRow {
  id: string
  pedimento_id: string
  compensacion_type: string | null
  amount: number | null
  reference: string | null
  created_at: string
}

export interface PagoVirtualRow {
  id: string
  pedimento_id: string
  bank_code: string | null
  payment_form: string | null
  amount: number | null
  reference: string | null
  created_at: string
}

export interface GuiaRow {
  id: string
  pedimento_id: string
  guia_type: string | null
  guia_number: string | null
  carrier: string | null
  container_number: string | null
  created_at: string
}

export interface TransportistaRow {
  id: string
  pedimento_id: string
  carrier_type: CarrierType
  carrier_id: string | null
  carrier_name: string | null
  created_at: string
}

export interface CandadoRow {
  id: string
  pedimento_id: string
  seal_number: string | null
  verification_status: string | null
  created_at: string
}

export interface DescargaRow {
  id: string
  pedimento_id: string
  dock_assignment: string | null
  unloaded_at: string | null
  notes: string | null
  created_at: string
}

export interface CuentaGarantiaRow {
  id: string
  pedimento_id: string
  account_reference: string | null
  amount: number | null
  created_at: string
}

export interface ContribucionRow {
  id: string
  pedimento_id: string
  contribution_type: string | null
  rate: number | null
  base: number | null
  amount: number | null
  created_at: string
}

export interface PedimentoFacturaRow {
  id: string
  pedimento_id: string
  supplier_name: string | null
  supplier_tax_id: string | null
  invoice_number: string | null
  invoice_date: string | null
  currency: string | null
  amount: number | null
  created_at: string
}

/**
 * Partidas are currently sourced from `globalpc_partidas` via `cve_trafico`.
 * Represented loosely here so the validation engine can consume them without
 * coupling to Block 1's full PartidaRow shape.
 */
export interface PedimentoPartidaLite {
  fraccion: string | null
  cantidad: number | null
  pais_origen: string | null
  valor_comercial: number | null
}

export interface FullPedimento {
  parent: PedimentoRow
  destinatarios: DestinatarioRow[]
  compensaciones: CompensacionRow[]
  pagos_virtuales: PagoVirtualRow[]
  guias: GuiaRow[]
  transportistas: TransportistaRow[]
  candados: CandadoRow[]
  descargas: DescargaRow[]
  cuentas_garantia: CuentaGarantiaRow[]
  contribuciones: ContribucionRow[]
  facturas: PedimentoFacturaRow[]
  partidas: PedimentoPartidaLite[]
  declared_total_mxn?: number | null
  exchange_rate_reference?: number | null
}

export type ChildTable =
  | 'pedimento_destinatarios'
  | 'pedimento_compensaciones'
  | 'pedimento_pagos_virtuales'
  | 'pedimento_guias'
  | 'pedimento_transportistas'
  | 'pedimento_candados'
  | 'pedimento_descargas'
  | 'pedimento_cuentas_garantia'
  | 'pedimento_contribuciones'
  | 'pedimento_facturas'

export interface ValidationError {
  tab: TabId
  field: string
  severity: 'error' | 'warning'
  message: string
}
