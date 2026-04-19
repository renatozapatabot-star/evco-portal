/**
 * Fracción formatting — SAT standard `XXXX.XX.XX` (optionally `.NN` for NICO).
 *
 * Core invariant #8 (CLAUDE.md): "Fracciones preserve dots. Never strip."
 * This helper accepts the dotted form, the bare 8-digit form (GlobalPC
 * sometimes stores without separators), and the 10-digit NICO-extended form
 * (post-2022 SAT schedule introduced two-digit NICO suffixes for regulatory
 * subdivision — e.g. `3901.20.01.99` vs `3901.20.01`).
 *
 * Returns null if the input can't be coerced into a valid fracción shape.
 */

const DOTTED_BASE = /^(\d{4})\.(\d{2})\.(\d{2})$/
const DOTTED_NICO = /^(\d{4})\.(\d{2})\.(\d{2})\.(\d{2})$/
const BARE_BASE = /^(\d{4})(\d{2})(\d{2})$/
const BARE_NICO = /^(\d{4})(\d{2})(\d{2})(\d{2})$/

export function formatFraccion(input: string | null | undefined): string | null {
  if (!input) return null
  const trimmed = String(input).trim()
  if (!trimmed) return null
  if (DOTTED_NICO.test(trimmed)) return trimmed
  if (DOTTED_BASE.test(trimmed)) return trimmed
  const mNico = trimmed.match(BARE_NICO)
  if (mNico) return `${mNico[1]}.${mNico[2]}.${mNico[3]}.${mNico[4]}`
  const mBase = trimmed.match(BARE_BASE)
  if (mBase) return `${mBase[1]}.${mBase[2]}.${mBase[3]}`
  return null
}
