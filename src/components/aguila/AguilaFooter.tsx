/**
 * AguilaFooter — the 9px monospace ghost identity strip.
 *
 * Copies the login's footer verbatim so every authenticated surface carries
 * the same heritage signal at the same visual weight. Intentionally faint
 * (55% opacity) — presence, not noise.
 *
 * Dedupe via `data-identity-footer` — if multiple footers are mounted
 * (PageShell renders one AND DashboardShellClient renders one), only
 * the first paints. `AguilaFooterShellFallback` uses a client-only
 * effect to suppress the second.
 */

'use client'

import { useEffect, useState } from 'react'
import { LS_FOOTER } from '@/lib/design-system'

export function AguilaFooter() {
  return (
    <p
      data-identity-footer
      style={{
        margin: '32px 0 0',
        fontSize: 9,
        color: 'var(--portal-fg-5)',
        letterSpacing: LS_FOOTER,
        fontFamily: 'var(--portal-font-mono), monospace',
        opacity: 0.85,
        textAlign: 'center',
        textTransform: 'none',
      }}
    >
      Patente 3596 · Aduana 240 · Laredo TX · Est. 1941
    </p>
  )
}

/**
 * Shell-level fallback: renders an AguilaFooter ONLY if no other
 * footer is already present on the page. Prevents double-render when
 * a page composes through PageShell (which mounts its own footer) AND
 * through DashboardShellClient (which also wants a footer on non-
 * PageShell pages).
 *
 * First render yields null (state starts "undecided"); a layout-effect
 * counts existing `[data-identity-footer]` elements and flips on if
 * there's 0 of them. Second render shows/hides accordingly.
 */
export function AguilaFooterShellFallback() {
  const [shouldRender, setShouldRender] = useState(false)
  useEffect(() => {
    const count = document.querySelectorAll('[data-identity-footer]').length
    if (count === 0) setShouldRender(true)
  }, [])
  if (!shouldRender) return null
  return <AguilaFooter />
}
