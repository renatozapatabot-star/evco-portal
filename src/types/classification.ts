/**
 * Block 5 — Classification Sheet Generator types.
 *
 * 9 grouping modes × 4 ordering modes × 12 print toggles — matches the
 * GlobalPC "Hoja de clasificación" config surface so existing operators
 * recognise every knob when they open the generator in ZAPATA.
 */

export type GroupingMode =
  | 'none'
  | 'fraction_country_umc'
  | 'fraction_umc_country'
  | 'fraction_umc_country_certified'
  | 'fraction_umc_country_cert_invoice'
  | 'fraction_umc_country_product_key'
  | 'fraction_umc_country_product_desc'
  | 'fraction_umc_country_desc_cert'
  | 'subheading_fraction_umc_country'

export const GROUPING_MODES: readonly GroupingMode[] = [
  'none',
  'fraction_country_umc',
  'fraction_umc_country',
  'fraction_umc_country_certified',
  'fraction_umc_country_cert_invoice',
  'fraction_umc_country_product_key',
  'fraction_umc_country_product_desc',
  'fraction_umc_country_desc_cert',
  'subheading_fraction_umc_country',
] as const

export type OrderingMode =
  | 'fraction_asc'
  | 'invoice_capture_item'
  | 'invoice_number_asc'
  | 'fraction_country_desc_umc'

export const ORDERING_MODES: readonly OrderingMode[] = [
  'fraction_asc',
  'invoice_capture_item',
  'invoice_number_asc',
  'fraction_country_desc_umc',
] as const

export type SpecificDescriptionOption =
  | 'none'
  | 'marca_modelo'
  | 'marca_modelo_serie'
  | 'full_detail'

export type RestrictionPrintMode =
  | 'inline'
  | 'separate_annex'
  | 'omit'

/**
 * 12 print toggles — control which columns/sections surface on the
 * generated PDF + Excel. All default to true on a fresh config.
 */
export type PrintToggles = {
  print_fraction: boolean
  print_description: boolean
  print_umc: boolean
  print_country_origin: boolean
  print_quantity: boolean
  print_unit_value: boolean
  print_total_value: boolean
  print_invoice_number: boolean
  print_supplier: boolean
  print_tmec: boolean
  print_marca_modelo: boolean
  print_restrictions: boolean
}

export const DEFAULT_PRINT_TOGGLES: PrintToggles = {
  print_fraction: true,
  print_description: true,
  print_umc: true,
  print_country_origin: true,
  print_quantity: true,
  print_unit_value: true,
  print_total_value: true,
  print_invoice_number: true,
  print_supplier: false,
  print_tmec: true,
  print_marca_modelo: false,
  print_restrictions: false,
}

export interface ClassificationSheetConfig {
  grouping_mode: GroupingMode
  ordering_mode: OrderingMode
  specific_description: SpecificDescriptionOption
  restriction_print_mode: RestrictionPrintMode
  print_toggles: PrintToggles
  email_recipients: string[]
}

export const DEFAULT_CONFIG: ClassificationSheetConfig = {
  grouping_mode: 'fraction_umc_country',
  ordering_mode: 'fraction_asc',
  specific_description: 'none',
  restriction_print_mode: 'separate_annex',
  print_toggles: DEFAULT_PRINT_TOGGLES,
  email_recipients: [],
}

/**
 * Input row shape. Mirrors globalpc_productos + partida fields.
 * All optional because productos rows arrive with varying completeness —
 * the engine surfaces warnings on missing fields rather than throwing.
 */
export interface Producto {
  id?: string
  cve_producto?: string | null
  fraccion_arancelaria?: string | null
  fraccion?: string | null
  descripcion?: string | null
  descripcion_especifica?: string | null
  umc?: string | null
  pais_origen?: string | null
  cantidad?: number | null
  valor_comercial?: number | null
  valor_unitario?: number | null
  invoice_number?: string | null
  factura_numero?: string | null
  supplier?: string | null
  proveedor?: string | null
  certificado_origen_tmec?: boolean | null
  marca?: string | null
  modelo?: string | null
  serie?: string | null
  restriccion?: string | null
  capture_order?: number | null
}

export interface Partida {
  fraction: string
  description: string
  country: string
  umc: string
  quantity: number
  unit_value: number | null
  total_value: number
  invoice_number: string | null
  supplier: string | null
  certified_tmec: boolean
  marca_modelo: string | null
  restrictions: string[]
  products_count: number
  grouping_key: string
}

export interface PartidaGrouping {
  key: string
  partidas: Partida[]
}

export interface GeneratedSheet {
  partidas: Partida[]
  summary: {
    total_value: number
    partidas_count: number
    products_count: number
  }
  warnings: string[]
}

export interface GeneratedSheetMeta {
  trafico_id: string
  cliente_id: string
  cliente_name: string
  company_id: string
  operator_name: string
  regimen: string | null
  tipo_operacion: string | null
  generated_at: string
}
