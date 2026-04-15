/**
 * AguilaFooter — the 9px monospace ghost identity strip.
 *
 * Copies the login's footer verbatim so every authenticated surface carries
 * the same heritage signal at the same visual weight. Intentionally faint
 * (55% opacity) — presence, not noise.
 */

import { LS_FOOTER } from '@/lib/design-system'

export function AguilaFooter() {
  return (
    <p
      style={{
        margin: '32px 0 0',
        fontSize: 9,
        color: 'rgba(122,126,134,0.55)',
        letterSpacing: LS_FOOTER,
        fontFamily: 'var(--font-mono), var(--font-jetbrains-mono), monospace',
        textAlign: 'center',
        textTransform: 'none',
      }}
    >
      Patente 3596 · Aduana 240 · Laredo TX · Est. 1941
    </p>
  )
}
