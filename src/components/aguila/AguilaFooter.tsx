/**
 * AguilaFooter — the 9px monospace ghost identity strip.
 *
 * Copies the login's footer verbatim so every authenticated surface carries
 * the same heritage signal at the same visual weight. Intentionally faint
 * (55% opacity) — presence, not noise.
 *
 * Ownership rule (Cluster F · 2026-04-28): every page renders ONE
 * <AguilaFooter />. PageShell + AguilaShell mount it automatically;
 * pages that don't compose through a shell (PortalDashboard, the
 * pedimento detail page, the 404 page) render it inline. The previous
 * shell-level `AguilaFooterShellFallback` was removed because its
 * useEffect-based DOM dedupe was racy and produced double footers on
 * /catalogo, /embarques/[id], /pedimentos/[id], and 404.
 */

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
