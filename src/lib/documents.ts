// src/lib/documents.ts
// Single source of truth for required document types.
// Values are EXACT from Phase 0D query on the documents table.

export const REQUIRED_DOC_TYPES = [
  'FACTURA',
  'LISTA DE EMPAQUE',
  'PEDIMENTO',
  'ACUSE DE COVE',
  'ACUSE DE E-DOCUMENT',
  'CARTA',
]

/**
 * Get missing documents using fuzzy first-word matching.
 * Handles: 'FACTURA' matching 'FACTURA COMERCIAL' and vice versa.
 */
export function getMissingDocs(
  existingDocs: Array<{ tipo?: string | null; document_type?: string | null }>
): string[] {
  const existingNormalized = existingDocs
    .map(d => (d.tipo ?? d.document_type)?.toUpperCase().trim())
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
 * Get missing docs accounting for client template docs (permanent docs on file).
 * Template docs count as "present" — they reduce the missing count.
 */
export function getMissingDocsWithTemplates(
  existingDocs: Array<{ tipo?: string | null; document_type?: string | null }>,
  templateDocTypes: string[]
): string[] {
  const templateNormalized = templateDocTypes.map(t => t.toUpperCase().trim())
  const combined = [
    ...existingDocs,
    ...templateNormalized.map(t => ({ document_type: t })),
  ]
  return getMissingDocs(combined)
}
