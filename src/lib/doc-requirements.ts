/**
 * V1 Polish Pack · Block 10 — Required doc lists by régimen aduanero.
 *
 * Consolidates the two ad-hoc arrays previously inlined at:
 *   - src/app/documentos/subir/page.tsx (~54)
 *   - src/app/pedimentos/nuevo/page.tsx (~35)
 *
 * The checklist UI and the solicitation composer (Block 5) both read
 * from this single source so operators see one consistent list.
 *
 * Conservative by design: unknown régimen codes return [] rather than
 * throwing. Failing closed prevents false "missing doc" reds on
 * tráficos whose régimen is not yet in the map.
 */

/**
 * Canonical doc type identifiers. These match the slugs produced by
 * Block 3's vision classifier (`vision-classifier.ts`) so the
 * checklist can diff directly against `expediente_documentos.document_type`.
 */
export type DocType =
  | 'factura'
  | 'packing_list'
  | 'bill_of_lading'
  | 'carta_porte'
  | 'certificado_origen'
  | 'pedimento'
  | 'rfc_constancia'
  | 'encargo_conferido'
  | 'cove'
  | 'mve'

export const DOC_TYPE_LABELS_ES: Record<DocType, string> = {
  factura: 'Factura comercial',
  packing_list: 'Lista de empaque',
  bill_of_lading: 'Conocimiento de embarque',
  carta_porte: 'Carta porte',
  certificado_origen: 'Certificado de origen (T-MEC)',
  pedimento: 'Pedimento',
  rfc_constancia: 'Constancia RFC',
  encargo_conferido: 'Encargo conferido',
  cove: 'COVE (Comprobante de Valor Electrónico)',
  mve: 'MVE (Manifestación de Valor)',
}

/**
 * Régimen → required docs. Keys are the four canonical régimen slugs.
 * The numeric/letter régimen codes from GlobalPC (A1, IN, EX, etc.)
 * are mapped in `normalizeRegimen` below.
 */
export const REQUIRED_DOCS_BY_REGIMEN: Record<string, DocType[]> = {
  importacion_definitiva: [
    'factura',
    'packing_list',
    'bill_of_lading',
    'pedimento',
    'cove',
    'mve',
    'certificado_origen',
    'rfc_constancia',
    'encargo_conferido',
  ],
  exportacion_definitiva: [
    'factura',
    'packing_list',
    'carta_porte',
    'pedimento',
    'cove',
    'certificado_origen',
    'encargo_conferido',
  ],
  importacion_temporal: [
    'factura',
    'packing_list',
    'bill_of_lading',
    'pedimento',
    'cove',
    'mve',
    'encargo_conferido',
  ],
  exportacion_temporal: [
    'factura',
    'packing_list',
    'carta_porte',
    'pedimento',
    'cove',
    'encargo_conferido',
  ],
}

/**
 * Map a régimen code from traficos.regimen into one of the four
 * canonical buckets. Unknown codes return null — callers get [].
 *
 * GlobalPC uses single-letter/number codes (A1, IN, EX, etc.).
 * SAT canonical régimenes also accepted as plain strings.
 */
function normalizeRegimen(regimen: string | null | undefined): string | null {
  if (!regimen) return null
  const r = regimen.trim().toUpperCase()
  if (!r) return null

  // Direct canonical keys
  if (r === 'IMPORTACION_DEFINITIVA' || r === 'IMP_DEFINITIVA' || r === 'IMPDEF') return 'importacion_definitiva'
  if (r === 'EXPORTACION_DEFINITIVA' || r === 'EXP_DEFINITIVA' || r === 'EXPDEF') return 'exportacion_definitiva'
  if (r === 'IMPORTACION_TEMPORAL' || r === 'IMP_TEMPORAL' || r === 'IMPTMP') return 'importacion_temporal'
  if (r === 'EXPORTACION_TEMPORAL' || r === 'EXP_TEMPORAL' || r === 'EXPTMP') return 'exportacion_temporal'

  // SAT letter-number régimenes (most common on traficos.regimen)
  // A1 = importación definitiva; A3 = importación de retornos; C1 = exportación definitiva
  // IN = importación temporal IMMEX; EX = exportación temporal IMMEX
  if (r === 'A1' || r === 'A3') return 'importacion_definitiva'
  if (r === 'C1') return 'exportacion_definitiva'
  if (r === 'IN' || r === 'BA' || r === 'BB') return 'importacion_temporal'
  if (r === 'EX' || r === 'H1') return 'exportacion_temporal'

  return null
}

/**
 * Resolve required docs for a tráfico's régimen. Never throws.
 * Unknown régimen → [] (UI renders an info message instead of a checklist).
 */
export function getRequiredDocs(regimen: string | null | undefined): DocType[] {
  const key = normalizeRegimen(regimen)
  if (!key) return []
  return REQUIRED_DOCS_BY_REGIMEN[key] ?? []
}

/**
 * Human-readable label lookup. Falls back to the slug itself so the
 * UI still renders something meaningful for new doc types introduced
 * before the label map is updated.
 */
export function labelForDocType(type: string): string {
  if (type in DOC_TYPE_LABELS_ES) return DOC_TYPE_LABELS_ES[type as DocType]
  return type.replace(/_/g, ' ')
}
