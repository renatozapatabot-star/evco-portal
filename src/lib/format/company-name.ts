/**
 * Company name display — the canonical source-of-truth helper.
 *
 * Screenshots revealed `companies.name` can carry typos (e.g. `R.I.DE`
 * instead of `R.L.DE`) that the PDF path avoids because it reads a
 * different source. This helper prefers the validated `razon_social`
 * field from client-config when available and falls back to `name`
 * otherwise, so the canonical legal entity string renders everywhere.
 *
 * It also handles basic normalization:
 *   · trims whitespace
 *   · collapses internal multi-space
 *   · capitalizes the first letter of each word for operator names
 *     (used in greetings like "Buenos días, renato" → "Renato")
 */

export interface NameSources {
  razon_social?: string | null
  name?: string | null
}

/**
 * Preferred company legal name for display. `razon_social` wins when
 * populated; otherwise `name` is used as a fallback.
 */
export function displayCompanyName(sources: NameSources, fallback = ''): string {
  const primary = (sources.razon_social ?? '').trim()
  if (primary.length > 0) return primary
  const secondary = (sources.name ?? '').trim()
  if (secondary.length > 0) return secondary
  return fallback
}

/**
 * Capitalize the first letter of each word in a person's name.
 * Safe on already-capitalized input.
 */
export function capitalizeName(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * Normalize whitespace inside a company name — useful when DB values
 * have inconsistent spaces around commas or periods.
 */
export function normalizeCompanyName(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw.trim().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ')
}
