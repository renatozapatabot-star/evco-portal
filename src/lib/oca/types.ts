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
