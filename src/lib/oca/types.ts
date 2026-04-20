export interface OcaRow {
  id: string
  opinion_number: string
  company_id: string | null
  trafico_id: string | null
  product_description: string
  fraccion_recomendada: string
  pais_origen: string
  uso_final: string | null
  fundamento_legal: string | null
  nom_aplicable: string | null
  tmec_elegibilidad: boolean | null
  vigencia_hasta: string | null
  model_used: string | null
  input_tokens: number | null
  output_tokens: number | null
  cost_usd: number | null
  generated_by: string | null
  approved_by: string | null
  approved_at: string | null
  pdf_url: string | null
  status: 'draft' | 'approved' | 'superseded'
  created_at: string
  updated_at: string
}

export interface OcaGenerateInput {
  product_description: string
  fraccion_sugerida?: string
  pais_origen: string
  uso_final?: string
  trafico_id?: string
  company_id?: string
}

export interface OcaOpinionDraft {
  fraccion_recomendada: string
  fundamento_legal: string
  nom_aplicable: string | null
  tmec_elegibilidad: boolean
  vigencia_hasta: string
  razonamiento: string
}

export interface OcaTmecDiscrepancy {
  certificate_line: number
  certificate_shows: string
  correct_fraccion: string
  message_es: string
}

/**
 * Classifier-enriched OCA draft — adds the full I/II/III/IV template
 * from the OCA skill (~/.claude/skills/oca-opinion.md) plus NICO + T-MEC
 * discrepancy flags + GRI citations. Returned by the Classifier pipeline
 * (generateOcaClassifierDraft / generateOcaBatch). The legacy
 * `OcaOpinionDraft` stays untouched for back-compat with existing callers.
 */
export interface OcaClassifierDraft extends OcaOpinionDraft {
  nico: string
  antecedentes: string
  analisis: string
  clasificacion_descripcion_tigie: string
  arancel_general: string
  tmec_discrepancies: OcaTmecDiscrepancy[]
  gri_applied: string[]
}

export interface OcaClassifierInput extends OcaGenerateInput {
  item_no?: string
  invoice_ref?: string
  /** Optional pre-printed fraccion from the invoice itself (XXXX.XX or XXXX.XX.XX). */
  certificate_fraccion_hint?: string
  /** Country of origin in ISO-2 form (US, MX, CA, CN, JP, DE, KR, TW, IT, OTHER). */
  pais_origen_iso?: string
  /** Extended price in USD from the invoice line, for context. */
  extended_price_usd?: number
  /** Unit of measure (EA, PZ, KG, LB, ...). */
  uom?: string
}
