/**
 * Lookup helpers for expediente_documents that handle the dual-keyed
 * `pedimento_id` column.
 *
 * Why this exists:
 *
 * `expediente_documentos.pedimento_id` is populated by two different
 * sync paths and ends up holding two different shapes of the same
 * concept:
 *
 *   - Trafico-slug shape (e.g. "9254-Y4568") — 98.4% of EVCO rows
 *   - Numeric pedimento shape (e.g. "6500313") — 0.024% of EVCO rows
 *
 * A renderer that joins by ONE shape silently misses docs filed under
 * the other shape. The /expedientes list page joined by trafico slug
 * only — for any trafico whose docs were filed under the numeric
 * pedimento, the page rendered 0/6 even though the docs existed.
 *
 * This helper takes a doc map keyed by `pedimento_id` (whatever shape)
 * plus a trafico (which knows BOTH its slug and its pedimento number)
 * and returns the union of docs found under either key — deduped by
 * doc id.
 *
 * The proper long-term fix is canonicalizing the column on a single
 * shape via a backfill + sync-writer hardening; this helper is the
 * smaller bridge fix that makes the list correct today. See
 * ~/Desktop/data-integrity-investigation-2026-05-06.md finding A4 +
 * the "Option A vs Option B" decision in the morning summary.
 */

export interface DocFile {
  id: string
  doc_type: string | null
  file_name: string | null
  file_url: string | null
  uploaded_at: string | null
}

export interface TraficoLookupKey {
  /** The trafico slug — e.g. "9254-Y4568". */
  trafico: string
  /** The pedimento number stored on the trafico — e.g. "6500313". May be empty/null. */
  pedimento: string | null | undefined
}

/**
 * Given a Map keyed by `pedimento_id` (whatever shape was stored) and
 * a trafico, return the union of docs reachable via:
 *   - the trafico slug (if pedimento_id rows of that shape exist), AND
 *   - the trafico's pedimento number (if pedimento_id rows of that shape exist).
 *
 * Deduped by doc.id. Order preserved: trafico-shape matches first,
 * then any pedimento-shape matches the slug lookup missed.
 */
export function lookupDocsForTrafico(
  docMap: Map<string, DocFile[]>,
  trafico: TraficoLookupKey,
): DocFile[] {
  const seen = new Set<string>()
  const out: DocFile[] = []

  // Primary key: trafico slug. Most rows in expediente_documentos are
  // shaped this way, so the hot path is a single lookup.
  const bySlug = docMap.get(trafico.trafico) ?? []
  for (const d of bySlug) {
    if (d.id && !seen.has(d.id)) {
      seen.add(d.id)
      out.push(d)
    }
  }

  // Fallback key: pedimento number. Catches the 0.024% of rows whose
  // sync path stored the numeric pedimento string instead of the
  // trafico slug. We trim and skip empty values so a NULL pedimento
  // doesn't accidentally collide with the empty-string bucket.
  const pedKey = trafico.pedimento ? String(trafico.pedimento).trim() : ''
  if (pedKey && pedKey !== trafico.trafico) {
    const byPed = docMap.get(pedKey) ?? []
    for (const d of byPed) {
      if (d.id && !seen.has(d.id)) {
        seen.add(d.id)
        out.push(d)
      }
    }
  }

  return out
}
