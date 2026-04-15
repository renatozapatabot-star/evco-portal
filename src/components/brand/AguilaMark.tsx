// AguilaMark — brand mark for ZAPATA AI (April 2026 rebrand).
// Renders the gold Z with circuit traces from /public/brand/z-mark.svg.
// Filename preserved for import stability across 30+ call sites.

'use client'

import type { CSSProperties } from 'react'

export type AguilaMarkTone = 'silver' | 'silver-bright' | 'gold' | 'mono'

export interface AguilaMarkProps {
  size?: number
  /** @deprecated — ZAPATA AI mark is gold by design; tone is accepted for
   *  call-site compatibility but has no visual effect. */
  tone?: AguilaMarkTone
  className?: string
  style?: CSSProperties
  'aria-label'?: string
}

export function AguilaMark({
  size = 48,
  className,
  style,
  'aria-label': ariaLabel = 'ZAPATA AI',
}: AguilaMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/z-mark.svg"
      alt=""
      aria-label={ariaLabel}
      role="img"
      width={size}
      height={size}
      className={className}
      style={{ display: 'block', height: 'auto', ...style }}
    />
  )
}

export const ZapataMark = AguilaMark

export default AguilaMark
