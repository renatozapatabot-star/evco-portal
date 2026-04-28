/**
 * Server-side counterpart to `useSupplierNames` (client hook).
 * Given a raw proveedor identifier (cve_proveedor from globalpc_partidas)
 * and an optional canonical name (from globalpc_proveedores.nombre),
 * return a guaranteed-human display string. Never leaks raw PRV_####
 * codes to the UI.
 *
 * The hook and this helper share the same coalesce contract so every
 * surface resolves the same way — list pages, detail APIs, PDFs, chat.
 */

// Cluster K · 2026-04-28: globalpc_proveedores stores placeholder rows
// for tenants who haven't yet identified their actual provider. These
// rows have a generic cve_proveedor (e.g. PRV_GENERICO, PRV_GENERICO_PR)
// and a `nombre` like "PROVEEDOR DE <tenant legal name>". The string
// previously surfaced to clients on /entradas. Detect + suppress.
const TENANT_NAME_PLACEHOLDER_RE = /^\s*PROVEEDOR\s+DE\s+/i

export function isTenantPlaceholderName(name: string | null | undefined): boolean {
  if (!name) return false
  return TENANT_NAME_PLACEHOLDER_RE.test(name)
}

export function resolveProveedorName(
  rawCode: string | null | undefined,
  canonicalName?: string | null,
): string {
  if (canonicalName && canonicalName.trim().length > 0) {
    if (isTenantPlaceholderName(canonicalName)) return 'Proveedor pendiente de identificar'
    return canonicalName
  }
  const code = (rawCode ?? '').trim()
  if (!code) return 'Proveedor pendiente de identificar'
  if (code.startsWith('PRV_')) return code.replace(/^PRV_/, 'Proveedor ')
  // Non-PRV codes (legacy or numeric) — surface a calm placeholder instead
  // of the raw code. If callers want the raw code for diagnostics they can
  // still read the code field separately.
  if (/^\d+$/.test(code) || code.length <= 5) return 'Proveedor pendiente de identificar'
  return code
}
