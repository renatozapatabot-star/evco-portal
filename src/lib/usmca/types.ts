export type CertifierRole = 'exporter' | 'importer' | 'producer'
export type OriginCriterion = 'A' | 'B' | 'C' | 'D'
export type UsmcaStatus = 'draft' | 'approved' | 'superseded'

export interface UsmcaCertRow {
  id: string
  certificate_number: string
  company_id: string | null
  trafico_id: string | null
  certifier_role: CertifierRole
  certifier_name: string
  certifier_title: string | null
  certifier_address: string | null
  certifier_email: string | null
  certifier_phone: string | null
  exporter_name: string | null
  exporter_address: string | null
  producer_name: string | null
  producer_address: string | null
  importer_name: string | null
  importer_address: string | null
  goods_description: string
  hs_code: string
  origin_criterion: OriginCriterion
  rvc_method: string | null
  country_of_origin: string
  blanket_from: string | null
  blanket_to: string | null
  status: UsmcaStatus
  generated_by: string | null
  approved_by: string | null
  approved_at: string | null
  pdf_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface UsmcaCertInput {
  trafico_id?: string
  certifier_role: CertifierRole
  certifier_name: string
  certifier_title?: string
  certifier_address?: string
  certifier_email?: string
  certifier_phone?: string
  exporter_name?: string
  exporter_address?: string
  producer_name?: string
  producer_address?: string
  importer_name?: string
  importer_address?: string
  goods_description: string
  hs_code: string
  origin_criterion: OriginCriterion
  rvc_method?: string
  country_of_origin?: string
  blanket_from?: string
  blanket_to?: string
  notes?: string
}

export const ORIGIN_CRITERION_LABELS: Record<OriginCriterion, string> = {
  A: 'A · Totalmente obtenido u originario del territorio',
  B: 'B · Producido enteramente con materiales originarios',
  C: 'C · Cambio arancelario + contenido regional',
  D: 'D · Producido enteramente en territorio de una o más Partes',
}
