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
 *   2. `traficos.estatus` in the cleared set (Cruzado / Entregado /
 *      Pedimento Pagado / Completo) → Cleared
 *   3. else → Not cleared
 *
 *   Note: `E1` is NOT in the cleared set on its own. See the
 *   CLEARED_STATUSES block below for the full reasoning. An E1 trafico
 *   is only marked cleared when it ALSO has a fecha_cruce set.
 *
 * Expanding the cleared set requires a code review + test. Today
 * (2026-04-24) these four values are the ones GlobalPC + our sync
 * emit to indicate a trafico has crossed. Adding values silently
 * would inflate the "Cleared" bucket and lie to the shipper.
 */

/**
 * Cleared-state status values. Intentionally divergent from
 * `src/lib/cockpit/success-rate.ts` SUCCESS_ESTATUSES — that set
 * answers the broker-performance question ("did our work complete?"),
 * which counts `E1` (pedimento paid). This set answers the
 * client-display question ("has the cargo physically crossed?"),
 * which does NOT count `E1` alone.
 *
 * Why E1 is NOT cleared here (2026-05-06 fix · SEV-2):
 *   E1 is the SAT-accepted code that fires when the pedimento is
 *   paid. Many of those traficos have not yet physically crossed
 *   (fecha_cruce IS NULL). Treating E1 alone as "Liberado" lied to
 *   the client — the badge said cleared, the body said pago pendiente,
 *   the timeline said pendiente de cruzar. This file is the binary
 *   visual source-of-truth; we now only mark Liberado when fecha_cruce
 *   is set OR when estatus carries an unambiguous post-crossing signal.
 *
 *   When fecha_cruce IS set on an E1 trafico, isCleared() returns
 *   true via the fecha_cruce branch — that's the correct path and
 *   covers the 14 of 691 EVCO E1 rows that have actually crossed.
 *
 *   See ~/Desktop/data-integrity-investigation-2026-05-06.md finding A1.
 *
 * `Cerrado` is intentionally EXCLUDED — in some GlobalPC configurations
 * it means "administratively closed (cancelled/abandoned)", not
 * "successfully cleared". Leave out until Tito confirms semantics for
 * Patente 3596.
 */
const CLEARED_STATUSES = new Set([
  'Cruzado',
  'Entregado',
  'Pedimento Pagado',
  'Completo',
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

/**
 * Spanish render label — used on the six V1 client surfaces per the
 * audit lock-in (2026-04-25). The English `clearanceLabel()` stays for
 * back-compat with older operator-internal surfaces that still consume it.
 */
export function clearanceLabelES(t: TraficoClearanceInput): 'Liberado' | 'No liberado' {
  return isCleared(t) ? 'Liberado' : 'No liberado'
}
