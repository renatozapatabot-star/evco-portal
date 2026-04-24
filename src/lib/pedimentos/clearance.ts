/**
 * Pedimento clearance derivation — V1 Clean Visibility (2026-04-24).
 *
 * The client surface expresses customs status as a single binary:
 * "Cleared" or "Not cleared". No semáforo colors, no progress bars,
 * no timelines. This helper encodes the single source of truth for
 * that derivation, used by both the /pedimentos list and detail pages
 * plus any future PDF/report generator that needs to render the same
 * status consistently.
 *
 * Signal hierarchy (first match wins):
 *   1. `traficos.fecha_cruce` is non-null  → Cleared (physically crossed)
 *   2. `traficos.estatus` in the cleared set (Cruzado / Pedimento Pagado
 *      / Completo / Cerrado) → Cleared
 *   3. else → Not cleared
 *
 * Expanding the cleared set requires a code review + test. Today
 * (2026-04-24) these four values are the ones GlobalPC + our sync
 * emit to indicate a trafico has crossed. Adding values silently
 * would inflate the "Cleared" bucket and lie to the shipper.
 */

const CLEARED_STATUSES = new Set([
  'Cruzado',
  'Pedimento Pagado',
  'Completo',
  'Cerrado',
])

export interface TraficoClearanceInput {
  /** Trafico estatus string from globalpc_traficos / traficos. */
  estatus?: string | null
  /** Physical crossing timestamp from traficos. Non-null = cleared. */
  fecha_cruce?: string | null
}

/**
 * Returns true when the trafico has physically cleared customs OR
 * carries a status value that GlobalPC uses to mark clearance.
 */
export function isCleared(t: TraficoClearanceInput): boolean {
  if (t.fecha_cruce) return true
  if (t.estatus && CLEARED_STATUSES.has(t.estatus.trim())) return true
  return false
}

/**
 * Render-ready Spanish label for the client UI. Plain text; no color.
 *
 * The English-looking "Cleared" is intentional — that's the industry
 * term shipping ops use in Laredo day to day ("cleared customs",
 * "cleared the bridge"). Keeping it in English avoids a false
 * Spanish register; "Liberado" / "Despachado" carry subtly different
 * regulatory meanings that would confuse a shipper.
 */
export function clearanceLabel(t: TraficoClearanceInput): 'Cleared' | 'Not cleared' {
  return isCleared(t) ? 'Cleared' : 'Not cleared'
}
