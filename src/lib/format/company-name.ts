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

/**
 * Display-name cleaner — strips Mexican corporate legal suffixes + title-
 * cases the result for UI headers. Keeps `companies.name` untouched; this
 * is the render-time transform for client cockpits so "EVCO PLASTICS DE
 * MEXICO, S.DE R.L.DE C.V." reads as "EVCO Plastics de México" on a 393px
 * mobile header (2026-04-20 audit: the full legal name wrapped to three
 * ugly lines at 48px display).
 *
 * Strategy: iterate over a set of suffix patterns, peeling one at a time
 * until nothing else strips. That handles compound cases where a first
 * pass lifts "DE C.V." and a second lifts "S. DE R.L."
 *
 * Handles variations in spacing + punctuation:
 *   · "EVCO PLASTICS DE MEXICO, S.DE R.L.DE C.V."   → "EVCO Plastics de México"
 *   · "EVCO PLASTICS DE MEXICO,S.DE R.L.DE C.V."    (no space after comma)
 *   · "Company, S.A. DE C.V."                        → "Company"
 *   · "Foo S.A.P.I. de C.V."                         → "Foo"
 *   · "ACME S.C."                                    → "ACME"
 */
// Each pattern requires at least one period in the suffix — without this
// guard, the regex would over-match words like "MAFESA" where trailing
// letters happen to spell out a legal-suffix shape. Periods are the
// word-boundary marker corporate legal suffixes always carry.
const SUFFIX_PATTERNS: RegExp[] = [
  // Full compound S. DE R.L. DE C.V. (at least one period required on the
  // R/L/C/V side so this doesn't grab plain-word suffixes)
  /,?\s*S\.?\s*DE\s*R\.\s*L\.?\s*DE\s*C\.?\s*V\.?\s*$/i,
  /,?\s*S\.\s*DE\s*R\.?\s*L\.?\s*DE\s*C\.?\s*V\.?\s*$/i,
  // Half-compound: DE C.V. (requires C. or V. to carry period)
  /,?\s*DE\s*C\.\s*V\.?\s*$/i,
  /,?\s*DE\s*C\.?\s*V\.\s*$/i,
  // S. DE R.L. alone (R. required for the boundary)
  /,?\s*S\.?\s*DE\s*R\.\s*L\.?\s*$/i,
  /,?\s*S\.\s*DE\s*R\.?\s*L\.?\s*$/i,
  // S.A.P.I. — requires at least the S-period and the final I-period
  /,?\s*S\.\s*A\.?\s*P\.?\s*I\.?\s*$/i,
  /,?\s*S\.?\s*A\.?\s*P\.?\s*I\.\s*$/i,
  // S.A.B. — requires periods
  /,?\s*S\.\s*A\.?\s*B\.?\s*$/i,
  /,?\s*S\.?\s*A\.?\s*B\.\s*$/i,
  // S.A. — requires at least one period to avoid stripping "...SA"
  /,?\s*S\.\s*A\.?\s*$/i,
  /,?\s*S\.?\s*A\.\s*$/i,
  // S.C. — requires period
  /,?\s*S\.\s*C\.?\s*$/i,
  /,?\s*S\.?\s*C\.\s*$/i,
  // A.C. — requires period
  /,?\s*A\.\s*C\.?\s*$/i,
  /,?\s*A\.?\s*C\.\s*$/i,
  // S. EN C. — requires S-period and C-period
  /,?\s*S\.\s*EN\s*C\.?\s*$/i,
  /,?\s*S\.?\s*EN\s*C\.\s*$/i,
  // R.L. alone — both periods required since "RL" could be a trailing
  // abbreviation in other contexts.
  /,?\s*R\.\s*L\.\s*$/i,
  // Stray trailing comma after any of the above
  /,\s*$/,
]

const FIXED_CASE: Record<string, string> = {
  MEXICO: 'México',
  MÉXICO: 'México',
  USA: 'USA',
  EEUU: 'EEUU',
}
const CONNECTORS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e'])

function prettifyCase(s: string): string {
  const words = s.split(/\s+/)
  return words.map((w, i) => {
    if (!w) return w
    const upper = w.toUpperCase()
    if (FIXED_CASE[upper]) return FIXED_CASE[upper]
    const lower = w.toLowerCase()
    // Connectors lowercased except when leading — runs BEFORE the
    // acronym check so "DE" / "LA" / etc. don't get stuck uppercase.
    if (i > 0 && CONNECTORS.has(lower)) return lower
    // Short acronyms stay all-caps (EVCO, SAT, RFC) — cap at 4 so
    // that "GRUPO" still title-cases, and so we don't capture
    // words that only look acronym-shaped.
    if (w.length >= 3 && w.length <= 4 && w === upper && /^[A-Z]+$/.test(w)) return w
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }).join(' ')
}

export function cleanCompanyDisplayName(raw: string | null | undefined): string {
  if (!raw) return ''
  let out = String(raw).trim()
  let guard = 8
  while (guard-- > 0) {
    let matched = false
    for (const pattern of SUFFIX_PATTERNS) {
      const stripped = out.replace(pattern, '').trim()
      if (stripped !== out && stripped.length > 0) {
        out = stripped
        matched = true
      }
    }
    if (!matched) break
  }
  // Single-word all-caps inputs (MAFESA, DURATECH-style acronyms with no
  // legal suffix to strip) stay as-is — the user's intent is a brand
  // wordmark, not a title-cased phrase.
  if (!/\s/.test(out) && out === out.toUpperCase() && /^[A-Z]+$/.test(out)) {
    return out
  }
  return prettifyCase(out)
}
