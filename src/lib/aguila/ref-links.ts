/**
 * Map a canonical data-ref string to the deep-link that renders its detail.
 *
 * Phase 5 — the CRUZ AI chips in `CruzAskPanel` need tappable destinations.
 * Every helper below returns a route that already exists in the app tree
 * today; see Phase 5 notes in the handoff for the routing decisions:
 *
 *   - `/embarques/[id]`            → existing detail page
 *   - `/catalogo/fraccion/[code]`  → existing fracción detail page
 *   - `/pedimentos?q=...`          → list page, prefills its search box
 *                                    from the `q` param on mount
 *   - `/catalogo?q=...`            → list page, `q` is the generic catalog
 *                                    search already wired server-side
 *
 * All helpers `encodeURIComponent` the input so pedimentos keep their
 * spaces (invariant #7), fracciones keep their dots (invariant #8), and
 * any RFC / PRV_ / Y-id with reserved characters survives the round-trip.
 */

export function traficoHref(id: string): string {
  return `/embarques/${encodeURIComponent(id)}`
}

export function fraccionHref(code: string): string {
  return `/catalogo/fraccion/${encodeURIComponent(code)}`
}

export function pedimentoHref(pedimento: string): string {
  return `/pedimentos?q=${encodeURIComponent(pedimento)}`
}

export function supplierHref(term: string): string {
  return `/catalogo?q=${encodeURIComponent(term)}`
}
