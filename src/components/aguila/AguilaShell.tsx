/**
 * AguilaShell — V1 page wrapper that ports the login's atmospheric DNA to
 * every authenticated cockpit.
 *
 * Four stacked layers (via globals.css `.aguila-canvas` + `.aguila-aura`):
 *   1. Pure #0A0A0C canvas
 *   2. Topo hairline SVG overlay (top-right, 12% opacity)
 *   3. Central radial silver halo (900×900)
 *   4. Drifting aura (500×500, 12s ease-in-out breath)
 *
 * Choreographed entrance: 4-step stagger (header → hero → content → footer)
 * using the `.aguila-reveal-delay-*` utility classes.
 *
 * Responsibility slots:
 *   header  — topbar / breadcrumb area
 *   hero    — identity + primary signal (HeroSignal card)
 *   children — the cockpit body
 *
 * `<AguilaFooter>` is rendered automatically at the bottom so every page
 * carries the patente 3596 · aduana 240 · est. 1941 identity stamp.
 */

import type { ReactNode } from 'react'
import { AguilaFooter } from './AguilaFooter'

export interface AguilaShellProps {
  header?: ReactNode
  hero?: ReactNode
  children: ReactNode
  /** Hide the auto-footer for surfaces that embed their own. Default false. */
  hideFooter?: boolean
  /** Hide the drifting aura (e.g. on PDF-preview-style detail pages). */
  stillAtmosphere?: boolean
}

export function AguilaShell({
  header,
  hero,
  children,
  hideFooter = false,
  stillAtmosphere = false,
}: AguilaShellProps) {
  return (
    <div className="aguila-canvas">
      {!stillAtmosphere && <div className="aguila-aura" aria-hidden="true" />}

      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
          padding: '24px 24px 48px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--aguila-gap-section, 32px)',
        }}
      >
        {header && <div className="aguila-reveal">{header}</div>}
        {hero && <div className="aguila-reveal-delay-1">{hero}</div>}
        <div className="aguila-reveal-delay-2">{children}</div>
        {!hideFooter && (
          <div className="aguila-reveal-delay-3">
            <AguilaFooter />
          </div>
        )}
      </div>
    </div>
  )
}
