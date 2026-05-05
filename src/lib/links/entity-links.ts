/**
 * Entity cross-link URL helpers — V1 Clean Visibility (2026-04-24).
 *
 * Every ID rendered on the 5 core client surfaces (Entradas · Pedimentos
 * · Expediente · Catálogo · Anexo 24) must be clickable and land on the
 * canonical record page. This file is the single source of truth for
 * those URLs so a route rename only touches one place.
 *
 * These helpers do NOT access the DB or session — they are pure URL
 * builders. Tenant isolation is still enforced on the destination page
 * via `session.companyId`; these helpers never bypass that.
 *
 * When a new entity gains a canonical page (e.g. a future /facturas/[id]
 * route), add the helper here and audit existing render sites.
 */

/** Shipment parent record — reached by cross-link from entradas/pedimentos. */
export function linkForTrafico(traficoId: string | null | undefined): string | null {
  if (!traficoId) return null
  return `/embarques/${encodeURIComponent(traficoId)}`
}

/** Customs filing — new V1 detail page at /pedimentos/[id].
 *  Routed by trafico slug for back-compat; prefer
 *  `linkForPedimentoByNumber` when the SAT pedimento number is available. */
export function linkForPedimento(traficoId: string | null | undefined): string | null {
  if (!traficoId) return null
  return `/pedimentos/${encodeURIComponent(traficoId)}`
}

/** Pedimento detail keyed by SAT pedimento number — preferred when the
 *  caller has the pedimento string. The /pedimentos/[id] route resolves
 *  the trafico in-place and renders without changing the URL. */
export function linkForPedimentoByNumber(
  pedimentoNumber: string | null | undefined,
): string | null {
  if (!pedimentoNumber) return null
  // Pedimento numbers are always stored with spaces (`DD AD PPPP SSSSSSS`).
  // The route accepts either spaced or compact-numeric forms; we send the
  // sequential portion (last block) for cleanest URLs and let the route's
  // numeric-resolver match by `pedimento.ilike`. Falls back to the raw
  // string when we can't extract a sequential.
  const trimmed = String(pedimentoNumber).trim()
  const m = /^\d{2}\s\d{2}\s\d{4}\s(\d{7})$/.exec(trimmed)
  const slug = m?.[1] ?? trimmed.replace(/\s+/g, '')
  return `/pedimentos/${encodeURIComponent(slug)}`
}

/** Warehouse entrada detail page. */
export function linkForEntrada(cveEntrada: string | null | undefined): string | null {
  if (!cveEntrada) return null
  return `/entradas/${encodeURIComponent(cveEntrada)}`
}

/** Product / part catalog detail page. */
export function linkForProducto(cveProducto: string | null | undefined): string | null {
  if (!cveProducto) return null
  return `/catalogo/partes/${encodeURIComponent(cveProducto)}`
}

/** Fracción arancelaria — deep link into catalogo filtered by fraction. */
export function linkForFraccion(fraccion: string | null | undefined): string | null {
  if (!fraccion) return null
  return `/catalogo?fraccion=${encodeURIComponent(fraccion)}`
}

/** Proveedor — filtered entradas list (no standalone proveedor page yet). */
export function linkForProveedor(cveProveedor: string | null | undefined): string | null {
  if (!cveProveedor) return null
  return `/entradas?proveedor=${encodeURIComponent(cveProveedor)}`
}

/** Factura — row-anchored entradas list (no standalone factura page yet). */
export function linkForFactura(facturaNumber: string | null | undefined): string | null {
  if (!facturaNumber) return null
  return `/entradas?q=${encodeURIComponent(facturaNumber)}`
}
