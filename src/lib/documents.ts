// src/lib/documents.ts
// Single source of truth for required document types.
// Only documents truly required for a pedimento to clear SAT.

/** Always required for a standard A1 import pedimento */
export const REQUIRED_DOC_TYPES = [
  'FACTURA',          // Factura comercial
  'COVE',             // Comprobante de Valor Electrónico
  'PEDIMENTO',        // The filing itself
]

/** Conditionally required — only count if the condition applies */
export const CONDITIONAL_DOC_TYPES: { type: string; condition: string }[] = [
  { type: 'CERTIFICADO DE ORIGEN', condition: 'tmec' },      // Only if claiming T-MEC
  { type: 'NOM', condition: 'nom_required' },                // Only if fracción requires NOM
  { type: 'CARTA PORTE', condition: 'land_transport' },      // Only if land transport
  { type: 'BILL OF LADING', condition: 'ocean_air' },        // Only if ocean/air
  { type: 'LISTA DE EMPAQUE', condition: 'multiple_bultos' }, // Only if >1 bulto
  { type: 'MVE', condition: 'always_post_2026' },            // Always post March 2026
]

/** NOT required for compliance scoring — internal artifacts only */
// ACUSE DE COVE — receipt, not a document
// ACUSE DE E-DOCUMENT — validation artifact
// Photos, internal memos, duplicate copies

/**
 * Get missing REQUIRED documents using fuzzy first-word matching.
 * Only checks truly required docs — not receipts or internal artifacts.
 */
export function getMissingDocs(
  existingDocs: Array<{ tipo?: string | null; document_type?: string | null; doc_type?: string | null }>
): string[] {
  const existingNormalized = existingDocs
    .map(d => (d.tipo ?? d.document_type ?? d.doc_type)?.toUpperCase().trim())
    .filter(Boolean) as string[]

  return REQUIRED_DOC_TYPES.filter(req => {
    const reqUpper = req.toUpperCase().trim()
    const reqFirstWord = reqUpper.split(' ')[0]
    return !existingNormalized.some(e =>
      e === reqUpper ||
      e.startsWith(reqFirstWord) ||
      reqUpper.startsWith(e.split(' ')[0])
    )
  })
}

/**
 * Calculate compliance score: required docs present / required docs expected.
 * Conditional docs only counted if condition applies.
 * Extra docs (acuse, photos, memos) don't inflate or penalize.
 */
export function calculateDocCompliance(
  existingDocs: Array<{ tipo?: string | null; document_type?: string | null; doc_type?: string | null }>,
  conditions: { tmec?: boolean; nom_required?: boolean; land_transport?: boolean; ocean_air?: boolean; multiple_bultos?: boolean }
): { score: number; required: number; present: number; missing: string[] } {
  const existingNormalized = existingDocs
    .map(d => (d.tipo ?? d.document_type ?? d.doc_type)?.toUpperCase().trim())
    .filter(Boolean) as string[]

  function hasDoc(req: string): boolean {
    const reqFirstWord = req.split(' ')[0]
    return existingNormalized.some(e => e === req || e.startsWith(reqFirstWord) || req.startsWith(e.split(' ')[0]))
  }

  // Always required
  const requiredList = [...REQUIRED_DOC_TYPES]

  // Add conditional docs if condition applies
  // MVE is always required post March 2026
  requiredList.push('MVE')

  for (const cond of CONDITIONAL_DOC_TYPES) {
    if (cond.condition === 'always_post_2026') continue // Already added
    const condKey = cond.condition as keyof typeof conditions
    if (conditions[condKey]) requiredList.push(cond.type)
  }

  const missing = requiredList.filter(r => !hasDoc(r))
  const present = requiredList.length - missing.length
  const score = requiredList.length > 0 ? Math.round((present / requiredList.length) * 100) : 100

  return { score, required: requiredList.length, present, missing }
}
