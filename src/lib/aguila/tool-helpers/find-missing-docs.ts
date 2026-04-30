/**
 * find_missing_documents — given a tráfico, return the expected expediente
 * document types that are missing from `expediente_documentos`.
 *
 * Schema notes (enforced by .claude/memory/learned-rules.md):
 *   - `expediente_documentos.pedimento_id` holds the trafico slug, NOT
 *     a uuid and NOT a `trafico_id` field (which is a phantom).
 *   - `file_url` is NOT NULL on this table — absence of a doc_type is
 *     the signal for "missing", not null file_url.
 *
 * Required doc types are derived from the minimum SAT expediente contract
 * plus Mensajería-observable artifacts. The list is conservative: tools
 * that go beyond these belong in an OCA workflow, not an expediente check.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const REQUIRED_DOC_TYPES: ReadonlyArray<{ key: string; label_es: string }> = [
  { key: 'invoice', label_es: 'Factura comercial' },
  { key: 'cove', label_es: 'COVE' },
  { key: 'packing_list', label_es: 'Lista de empaque' },
  { key: 'bl_awb', label_es: 'BL o guía aérea' },
  { key: 'certificate_of_origin', label_es: 'Certificado de origen' },
] as const

export interface MissingDocsResult {
  trafico_id: string
  documents_on_file: Array<{ doc_type: string; file_name: string; uploaded_at: string | null }>
  missing_types_es: Array<{ key: string; label_es: string }>
  completeness_pct: number
  rationale_es: string
}

export interface FindMissingDocsResponse {
  success: boolean
  data: MissingDocsResult | null
  error: string | null
}

const DOC_TYPE_ALIASES: Record<string, string> = {
  invoice: 'invoice',
  factura: 'invoice',
  factura_comercial: 'invoice',
  cove: 'cove',
  packing_list: 'packing_list',
  packinglist: 'packing_list',
  empaque: 'packing_list',
  bl: 'bl_awb',
  awb: 'bl_awb',
  bl_awb: 'bl_awb',
  bill_of_lading: 'bl_awb',
  certificate_of_origin: 'certificate_of_origin',
  certificado_origen: 'certificate_of_origin',
  certificate: 'certificate_of_origin',
  tmec_certificate: 'certificate_of_origin',
}

function canonicalizeDocType(raw: string | null | undefined): string | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_')
  return DOC_TYPE_ALIASES[key] ?? key
}

export async function findMissingDocuments(
  supabase: SupabaseClient,
  companyId: string,
  input: { traficoId: string },
): Promise<FindMissingDocsResponse> {
  const traficoId = (input.traficoId ?? '').trim()
  if (!companyId) return { success: false, data: null, error: 'invalid_companyId' }
  if (!traficoId) return { success: false, data: null, error: 'invalid_traficoId' }

  const { data, error } = await supabase
    .from('expediente_documentos')
    .select('doc_type, file_name, uploaded_at')
    .eq('company_id', companyId)
    .eq('pedimento_id', traficoId)
    .limit(200)

  if (error) return { success: false, data: null, error: `expediente:${error.message}` }

  const rows = (data ?? []) as Array<{
    doc_type: string | null
    file_name: string | null
    uploaded_at: string | null
  }>

  const presentCanonical = new Set<string>()
  const documentsOnFile: Array<{ doc_type: string; file_name: string; uploaded_at: string | null }> = []
  for (const r of rows) {
    const canon = canonicalizeDocType(r.doc_type)
    if (canon) presentCanonical.add(canon)
    documentsOnFile.push({
      doc_type: r.doc_type ?? 'sin_clasificar',
      file_name: r.file_name ?? '',
      uploaded_at: r.uploaded_at,
    })
  }

  const missing = REQUIRED_DOC_TYPES.filter(t => !presentCanonical.has(t.key))
  const completenessPct = Math.round(
    ((REQUIRED_DOC_TYPES.length - missing.length) / REQUIRED_DOC_TYPES.length) * 100,
  )

  const rationale =
    missing.length === 0
      ? `Expediente completo · los ${REQUIRED_DOC_TYPES.length} tipos requeridos están en archivo.`
      : `Faltan ${missing.length} de ${REQUIRED_DOC_TYPES.length} tipos · ${missing.map(m => m.label_es).join(', ')}.`

  return {
    success: true,
    data: {
      trafico_id: traficoId,
      documents_on_file: documentsOnFile,
      missing_types_es: missing.map(m => ({ key: m.key, label_es: m.label_es })),
      completeness_pct: completenessPct,
      rationale_es: rationale,
    },
    error: null,
  }
}
