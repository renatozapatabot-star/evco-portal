'use client'

import { useEffect, useState } from 'react'
import { PortalGlobe } from './PortalGlobe'

export interface PortalCruzMarkProps {
  /** Font size in pixels. Default 14. Reference uses 15 in the TopBar. */
  size?: number
  /** Letter-spacing. Default '0.8em' matches the login; TopBar uses '0.45em'. */
  tracking?: string
  /** Font weight. Default 200 (hairline). */
  weight?: number | string
  /** Animate letter-by-letter reveal on first mount (120ms stagger). */
  animate?: boolean
  /** Render a rotating globe to the left of the wordmark. */
  globe?: boolean
  /** Override globe size. Default `round(size * 1.5)`. */
  globeSize?: number
  /** Wordmark text. Default "PORTAL". */
  text?: string
}

/**
 * PORTAL wordmark — editorial display font, hairline weight, wide tracking.
 * Optional rotating globe to the left. Letter-stagger reveal animation.
 *
 * Ported from .planning/design-handoff/cruz-portal/project/src/primitives.jsx:252-281
 * (original text "CRUZ"; swapped to "PORTAL" per Block DD rebrand).
 *
 * 2026-04-28 audit: handoff `<CruzMark>` is defined-but-unused; every
 * rendered handoff screen uses literal "PORTAL" — keeping our default.
 */
export function PortalCruzMark({
  size = 14,
  tracking = '0.8em',
  weight = 200,
  animate = false,
  globe = true,
  globeSize,
  text = 'PORTAL',
}: PortalCruzMarkProps) {
  const [show, setShow] = useState(!animate)

  useEffect(() => {
    if (animate) {
      const t = setTimeout(() => setShow(true), 100)
      return () => clearTimeout(t)
    }
  }, [animate])

  const letters = text.split('')

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size * 0.65,
        position: 'relative',
      }}
    >
      {globe && <PortalGlobe size={globeSize ?? Math.round(size * 1.5)} accent />}
      <span
        style={{
          fontFamily: 'var(--portal-font-display)',
          fontWeight: weight,
          fontSize: size,
          letterSpacing: tracking,
          color: 'var(--portal-fg-1)',
          paddingLeft: globe ? 0 : '0.8em',
          display: 'inline-block',
        }}
      >
        {letters.map((l, i) => (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: show ? 1 : 0,
              transform: show ? 'translateY(0)' : 'translateY(6px)',
              transition: animate
                ? `opacity 500ms cubic-bezier(0.22,1,0.36,1) ${i * 120}ms, transform 500ms cubic-bezier(0.22,1,0.36,1) ${i * 120}ms`
                : undefined,
            }}
          >
            {l}
          </span>
        ))}
      </span>
    </div>
  )
}
