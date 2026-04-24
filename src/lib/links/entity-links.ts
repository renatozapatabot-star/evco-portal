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

/** Customs filing — new V1 detail page at /pedimentos/[id]. */
export function linkForPedimento(traficoId: string | null | undefined): string | null {
  if (!traficoId) return null
  return `/pedimentos/${encodeURIComponent(traficoId)}`
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
