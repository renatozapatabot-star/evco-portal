/**
 * Pure helpers extracted from TraficoDetail.tsx so the eyebrow + badge
 * composition is testable in isolation.
 *
 * Why: the prior code rendered `${(trafico.tipo_operacion ?? 'A1').toUpperCase() · DEFINITIVO}`
 * on every detail page. The `traficos` schema doesn't have a
 * `tipo_operacion` column (page.tsx hardcodes null), so the `?? 'A1'`
 * always fired and labeled every record as A1 — wrong for ITE / IMD /
 * RT régimens. These helpers omit the segment when the value is
 * absent, telling the truthful empty state instead of a fabricated A1.
 *
 * Reference: ~/Desktop/data-integrity-investigation-2026-05-06.md A2.
 */

export interface HeroComposeInput {
  /** From traficos.tipo_operacion. Currently always null in production
   * because the column doesn't exist in the live schema; left typed as
   * string for forward-compat once the join lands. */
  tipo_operacion: string | null | undefined
  clientName: string
}

/**
 * Compose the small uppercase eyebrow line that sits above the
 * pedimento number on the detail hero. Format:
 *
 *   PEDIMENTO[ · {OP}] · {CLIENT}
 *
 * The middle OP segment renders only when `tipo_operacion` is a
 * non-empty trimmed string. Otherwise the line collapses to
 * "PEDIMENTO · {CLIENT}".
 */
export function composeDetailEyebrow(input: HeroComposeInput): string {
  const op = input.tipo_operacion?.trim()
  const opSegment = op ? ` · ${op.toUpperCase()}` : ''
  return `PEDIMENTO${opSegment} · ${input.clientName.toUpperCase()}`
}

/**
 * Compose the optional clave-pedimento chip label, e.g. "A1 · DEFINITIVO".
 * Returns null when there is no truthful value to render — the caller
 * should skip pushing the badge entirely on null.
 *
 * The "DEFINITIVO" suffix is technically only correct when the clave
 * is A1; once a real clave→prose dictionary is wired, this helper
 * should be replaced with a lookup that returns the right Spanish
 * prose per clave (A1→Definitiva, IMD→Definitiva (IMMEX), etc.).
 */
export function composeTipoOpBadgeLabel(input: HeroComposeInput): string | null {
  const op = input.tipo_operacion?.trim()
  if (!op) return null
  return `${op.toUpperCase()} · DEFINITIVO`
}
