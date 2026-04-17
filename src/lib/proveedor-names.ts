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
export function resolveProveedorName(
  rawCode: string | null | undefined,
  canonicalName?: string | null,
): string {
  if (canonicalName && canonicalName.trim().length > 0) return canonicalName
  const code = (rawCode ?? '').trim()
  if (!code) return 'Proveedor pendiente de identificar'
  if (code.startsWith('PRV_')) return code.replace(/^PRV_/, 'Proveedor ')
  // Non-PRV codes (legacy or numeric) — surface a calm placeholder instead
  // of the raw code. If callers want the raw code for diagnostics they can
  // still read the code field separately.
  if (/^\d+$/.test(code) || code.length <= 5) return 'Proveedor pendiente de identificar'
  return code
}
