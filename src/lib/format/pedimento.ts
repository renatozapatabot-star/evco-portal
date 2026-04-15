/**
 * Pedimento formatting — the SAT-standard `DD AD PPPP SSSSSSS` format.
 *
 * Core invariant #7 (CLAUDE.md): "Pedimentos always have spaces. Store with
 * spaces. Display with spaces. Any code that strips spaces breaks every
 * downstream lookup."
 *
 * This is the single source of truth for pedimento rendering. All list
 * tables, info cards, detail pages, and PDFs should call `formatPedimento()`
 * instead of concatenating or interpolating raw pedimento strings.
 *
 * Accepts either a correctly-formatted pedimento (returns as-is), a bare
 * 15-digit string, or a pedimento with inconsistent whitespace. Returns
 * `null` for values that cannot be rendered.
 */

const PEDIMENTO_REGEX = /^(\d{2})\s*(\d{2})\s*(\d{4})\s*(\d{7})$/

export interface PedimentoParts {
  dd: string
  ad: string
  pppp: string
  sssssss: string
}

/**
 * Parse a pedimento into its four segments. Returns null if invalid.
 */
export function parsePedimento(raw: string | null | undefined): PedimentoParts | null {
  if (!raw) return null
  const trimmed = String(raw).trim()
  if (trimmed.length === 0) return null

  // Fast path: already has spaces.
  const spaced = trimmed.match(PEDIMENTO_REGEX)
  if (spaced) {
    return { dd: spaced[1], ad: spaced[2], pppp: spaced[3], sssssss: spaced[4] }
  }

  // Recover from bare 15-digit strings — the SAT format is always 2+2+4+7 = 15 digits.
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length === 15) {
    return {
      dd: digits.slice(0, 2),
      ad: digits.slice(2, 4),
      pppp: digits.slice(4, 8),
      sssssss: digits.slice(8, 15),
    }
  }

  return null
}

/**
 * Render a pedimento in the canonical `DD AD PPPP SSSSSSS` format.
 * Returns the fallback (default `—`) when the input can't be parsed.
 */
export function formatPedimento(
  raw: string | null | undefined,
  fallback = '—',
): string {
  const parts = parsePedimento(raw)
  if (!parts) return fallback
  return `${parts.dd} ${parts.ad} ${parts.pppp} ${parts.sssssss}`
}

/**
 * Compact format for dense tables: `3596-6500275` (patente-consecutivo).
 * Useful when row real estate is tight but the full format is overkill.
 */
export function formatPedimentoCompact(
  raw: string | null | undefined,
  fallback = '—',
): string {
  const parts = parsePedimento(raw)
  if (!parts) return fallback
  return `${parts.pppp}-${parts.sssssss}`
}

/**
 * Validate a pedimento string against the SAT format. Accepts either the
 * formatted or bare-15-digit shape.
 */
export function isValidPedimento(raw: string | null | undefined): boolean {
  return parsePedimento(raw) !== null
}
