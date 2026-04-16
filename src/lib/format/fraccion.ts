/**
 * Fracción formatting — SAT standard `XXXX.XX.XX`.
 *
 * Core invariant #8 (CLAUDE.md): "Fracciones preserve dots. Never strip."
 * This helper tolerates either the already-dotted form or the bare
 * 8-digit form (GlobalPC sometimes stores fracciones without separators).
 *
 * Returns null if the input can't be coerced into a valid fracción shape.
 */

const DOTTED = /^(\d{4})\.(\d{2})\.(\d{2})$/
const BARE = /^(\d{4})(\d{2})(\d{2})$/

export function formatFraccion(input: string | null | undefined): string | null {
  if (!input) return null
  const trimmed = String(input).trim()
  if (!trimmed) return null
  if (DOTTED.test(trimmed)) return trimmed
  const m = trimmed.match(BARE)
  if (!m) return null
  return `${m[1]}.${m[2]}.${m[3]}`
}
