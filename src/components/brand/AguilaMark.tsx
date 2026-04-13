// AguilaMark — eagle mark for the AGUILA brand.
// Renders /public/brand/aguila-eagle.svg as an <img>. The SVG carries its own
// silver chrome fills, so the `tone` prop is retained only for call-site
// compatibility and has no visual effect.

'use client'

import type { CSSProperties } from 'react'

export type AguilaMarkTone = 'silver' | 'silver-bright' | 'gold' | 'mono'

export interface AguilaMarkProps {
  size?: number
  /** @deprecated Retained for call-site compatibility; visual effect baked into SVG. */
  tone?: AguilaMarkTone
  className?: string
  style?: CSSProperties
  'aria-label'?: string
}

export function AguilaMark({
  size = 48,
  className,
  style,
  'aria-label': ariaLabel = 'AGUILA',
}: AguilaMarkProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/aguila-eagle.svg"
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

export default AguilaMark
