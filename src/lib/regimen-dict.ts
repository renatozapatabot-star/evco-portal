/**
 * Régimen aduanal dictionary — maps SAT clave codes to human-readable
 * Spanish labels.
 *
 * Audit Cluster E (2026-05-05): the portal rendered raw claves like
 * "ITE" / "IMD" / "A1" everywhere. Clients have no way to interpret
 * these without the SAT codebook. This module is the single source of
 * truth — render sites compose `formatRegimen()` to show "ITE — Importación Temporal de Empresa"
 * (clave + dash + label) so the operational truth stays visible.
 *
 * Adding a new clave: append to REGIMEN_DICT below; consumers update
 * automatically.
 */

const REGIMEN_DICT: Record<string, string> = {
  // Importación
  IMD: 'Importación Definitiva',
  ITE: 'Importación Temporal de Empresa',
  ITR: 'Importación Temporal de Reparación',
  ITT: 'Importación Temporal con Transformación',
  // Exportación
  EXD: 'Exportación Definitiva',
  ETE: 'Exportación Temporal',
  // Depósito + tránsito
  DFI: 'Depósito Fiscal Industrial',
  TIM: 'Tránsito Interno Mercancías',
  TIN: 'Tránsito Internacional',
  RFE: 'Recinto Fiscalizado Estratégico',
  // SAT canonical 2-char claves (most common for Patente 3596)
  A1: 'Importación Definitiva',
  AF: 'Importación Definitiva (franja fronteriza)',
  C1: 'Exportación Definitiva',
  F4: 'Retorno de Mercancías',
  F5: 'Retorno de Exportación Temporal',
  F8: 'Tránsito Interno',
  F9: 'Tránsito Internacional',
  IN: 'Importación Temporal',
  K1: 'Cambio de Régimen',
}

/** Human-readable Spanish label for a régimen clave, or null if unknown. */
export function getRegimenLabel(clave: string | null | undefined): string | null {
  if (!clave) return null
  const trimmed = String(clave).trim().toUpperCase()
  if (!trimmed) return null
  return REGIMEN_DICT[trimmed] ?? null
}

/**
 * Format a régimen for display. When a label is known, returns
 * "{clave} — {label}". When unknown, returns the raw clave (so SAT
 * truth stays visible — never silently drop). When falsy, returns
 * the supplied fallback (default: '—').
 */
export function formatRegimen(
  clave: string | null | undefined,
  fallback = '—',
): string {
  if (!clave) return fallback
  const trimmed = String(clave).trim()
  if (!trimmed) return fallback
  const label = getRegimenLabel(trimmed)
  if (!label) return trimmed.toUpperCase()
  return `${trimmed.toUpperCase()} — ${label}`
}
